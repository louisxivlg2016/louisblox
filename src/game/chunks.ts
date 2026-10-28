import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { CHUNK_SIZE, VIEW_DISTANCE, generateChunk, heightAt } from './levels';
import type { LevelData } from './levels';
import { spawnChunkAnimals } from './animals';
import {
  Animal,
  BlockTarget,
  Chunk,
  ChunkData,
  Environment,
  Player,
  PlayerBody,
  PlayerCollider,
  PlayerPosition,
  PlayerState,
  PlayerVelocity,
  RainMaterial,
  SnowMaterial,
  TargetMesh,
} from './traits';
import { createMeatInventory } from './meats';
import { useGameStore } from './store';
import { voxelKey } from './voxel';
import type { BlockKind, Voxel, VoxelHit } from './voxel';

type ChunkEdit = BlockKind | null;
export type WorldSave = {
  version: 1 | 2;
  generation: number;
  seed: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number; flying: boolean };
  selected: BlockKind;
  apples: number;
  meat?: Record<import('./animals').AnimalKind, number>;
  elapsed: number;
  edits: Array<[string, Array<[string, ChunkEdit]>]>;
};

type WorldChunks = {
  seed: number;
  chunks: Map<string, Entity>;
  blocks: Map<string, Voxel>;
  edits: Map<string, Map<string, ChunkEdit>>;
};

const worlds = new WeakMap<World, WorldChunks>();
const chunkKey = (x: number, z: number) => `${x},${z}`;
export const chunkCoordinate = (value: number) => Math.floor((value + 0.5) / CHUNK_SIZE);

function stateFor(world: World) {
  const state = worlds.get(world);
  if (!state) throw new Error('Le monde de chunks n’est pas initialisé');
  return state;
}

export function snapshotWorldEdits(world: World): WorldSave['edits'] {
  return [...stateFor(world).edits].map(([chunk, edits]) => [chunk, [...edits]]);
}

function touchChunk(entity: Entity | undefined) {
  if (!entity) return;
  const chunk = entity.get(Chunk);
  if (chunk) entity.set(Chunk, { revision: chunk.revision + 1 });
}

function touchNeighbors(state: WorldChunks, cx: number, cz: number) {
  touchChunk(state.chunks.get(chunkKey(cx + 1, cz)));
  touchChunk(state.chunks.get(chunkKey(cx - 1, cz)));
  touchChunk(state.chunks.get(chunkKey(cx, cz + 1)));
  touchChunk(state.chunks.get(chunkKey(cx, cz - 1)));
}

function editsFor(state: WorldChunks, cx: number, cz: number) {
  const key = chunkKey(cx, cz);
  let edits = state.edits.get(key);
  if (!edits) {
    edits = new Map();
    state.edits.set(key, edits);
  }
  return edits;
}

function loadChunk(world: World, cx: number, cz: number) {
  const state = stateFor(world);
  const key = chunkKey(cx, cz);
  if (state.chunks.has(key)) return;

  const generated = generateChunk(cx, cz, state.seed);
  const blockMap = new Map(generated.blocks.map((block) => [voxelKey(block.x, block.y, block.z), block]));
  const edits = state.edits.get(key);
  if (edits) {
    for (const [position, kind] of edits) {
      if (kind === null) blockMap.delete(position);
      else {
        const [x, y, z] = position.split(',').map(Number);
        blockMap.set(position, { x, y, z, kind });
      }
    }
  }

  const entity = world.spawn(Chunk({ x: cx, z: cz }), ChunkData());
  const data = entity.get(ChunkData)!;
  data.blocks = [...blockMap.values()];
  data.water = generated.water;
  state.chunks.set(key, entity);

  for (const block of data.blocks) {
    state.blocks.set(voxelKey(block.x, block.y, block.z), block);
  }
  data.animals = spawnChunkAnimals(world, cx, cz, generated.water, state.seed);

  touchNeighbors(state, cx, cz);
}

function unloadChunk(world: World, entity: Entity) {
  const state = stateFor(world);
  const chunk = entity.get(Chunk);
  const data = entity.get(ChunkData);
  if (!chunk || !data) return;

  for (const block of data.blocks) {
    state.blocks.delete(voxelKey(block.x, block.y, block.z));
  }
  for (const animal of data.animals) animal.destroy();
  data.animals = [];
  state.chunks.delete(chunkKey(chunk.x, chunk.z));
  entity.destroy();
  touchNeighbors(state, chunk.x, chunk.z);
}

export function streamChunks(world: World, x: number, z: number) {
  const state = stateFor(world);
  const centerX = chunkCoordinate(x);
  const centerZ = chunkCoordinate(z);
  const desired = new Map<string, { x: number; z: number }>();

  for (let dx = -VIEW_DISTANCE; dx <= VIEW_DISTANCE; dx += 1) {
    for (let dz = -VIEW_DISTANCE; dz <= VIEW_DISTANCE; dz += 1) {
      const cx = centerX + dx;
      const cz = centerZ + dz;
      desired.set(chunkKey(cx, cz), { x: cx, z: cz });
    }
  }

  for (const entity of [...world.query(Chunk)]) {
    const chunk = entity.get(Chunk)!;
    if (!desired.has(chunkKey(chunk.x, chunk.z))) unloadChunk(world, entity);
  }

  const ordered = [...desired.values()].sort((a, b) =>
    Math.hypot(a.x - centerX, a.z - centerZ) - Math.hypot(b.x - centerX, b.z - centerZ),
  );
  for (const chunk of ordered) {
    if (state.chunks.has(chunkKey(chunk.x, chunk.z))) continue;
    loadChunk(world, chunk.x, chunk.z);
    break;
  }
}

export function getBlockIndex(world: World) {
  return stateFor(world).blocks;
}

export function getWorldSeed(world: World) {
  return stateFor(world).seed;
}

export function removeVoxel(world: World, hit: VoxelHit) {
  const state = stateFor(world);
  const cx = chunkCoordinate(hit.x);
  const cz = chunkCoordinate(hit.z);
  const chunkEntity = state.chunks.get(chunkKey(cx, cz));
  const data = chunkEntity?.get(ChunkData);
  if (!chunkEntity || !data) return;

  const position = voxelKey(hit.x, hit.y, hit.z);
  data.blocks = data.blocks.filter((block) => voxelKey(block.x, block.y, block.z) !== position);
  state.blocks.delete(position);
  editsFor(state, cx, cz).set(position, null);
  touchChunk(chunkEntity);
  touchNeighbors(state, cx, cz);
}

export function addVoxel(world: World, x: number, y: number, z: number, kind: BlockKind) {
  const state = stateFor(world);
  const cx = chunkCoordinate(x);
  const cz = chunkCoordinate(z);
  const key = chunkKey(cx, cz);
  if (!state.chunks.has(key)) loadChunk(world, cx, cz);

  const chunkEntity = state.chunks.get(key)!;
  const data = chunkEntity.get(ChunkData)!;
  const position = voxelKey(x, y, z);
  if (state.blocks.has(position)) return;

  const block = { x, y, z, kind };
  data.blocks.push(block);
  state.blocks.set(position, block);
  editsFor(state, cx, cz).set(position, kind);
  touchChunk(chunkEntity);
  touchNeighbors(state, cx, cz);
}

export function loadLevel(world: World, generation = 0, saved: WorldSave | null = null): LevelData {
  for (const entity of [...world.query(Chunk)]) entity.destroy();
  for (const entity of [...world.query(Animal)]) entity.destroy();
  for (const entity of [...world.query(Player)]) entity.destroy();
  for (const entity of [...world.query(BlockTarget)]) entity.destroy();
  for (const entity of [...world.query(Environment)]) entity.destroy();

  const restore = saved && (saved.version === 1 || saved.version === 2) && saved.generation === generation ? saved : null;
  const seed = restore?.seed ?? 73421 + generation * 977;
  const edits: WorldChunks['edits'] = restore
    ? new Map(restore.edits.map(([chunk, values]) => [chunk, new Map(values)]))
    : new Map();
  worlds.set(world, { seed, chunks: new Map(), blocks: new Map(), edits });
  const restorePosition = restore?.version === 2;
  const spawn = restore && restorePosition
    ? { x: restore.player.x, y: restore.player.y, z: restore.player.z }
    : { x: 0, y: heightAt(0, 0, seed) + 1.01, z: 0 };

  world.spawn(
    Player,
    PlayerBody(),
    PlayerCollider(),
    PlayerPosition(new Vector3(spawn.x, spawn.y, spawn.z)),
    PlayerVelocity(),
    PlayerState({
      yaw: restore && restorePosition ? restore.player.yaw : Math.atan2(3, 8),
      pitch: restore && restorePosition ? restore.player.pitch : -0.15,
      flying: restore?.player.flying ?? false,
    }),
  );
  world.spawn(BlockTarget(), TargetMesh());
  const environmentEntity = world.spawn(Environment(), RainMaterial(), SnowMaterial());
  useGameStore.setState({ meat: { ...createMeatInventory(), ...restore?.meat } });
  if (restore) {
    environmentEntity.get(Environment)!.elapsed = restore.elapsed;
    useGameStore.setState({ selected: restore.selected, apples: restore.apples, flying: restore.player.flying });
  }
  streamChunks(world, spawn.x, spawn.z);
  return { spawn };
}
