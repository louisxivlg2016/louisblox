import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { CHUNK_SIZE, MAX_BUILD_Y, VIEW_DISTANCE, biomeAt, generateChunk, heightAt } from './levels';
import type { LevelData } from './levels';
import { spawnAnimal, spawnChunkAnimals } from './animals';
import { spawnBomb } from './bombLifecycle';
import { spawnSapling } from './saplingLifecycle';
import { isChest, isCrop, isDoor, isLadder, isSapling, isTrapdoor } from './extraBlocks';
import { DEFAULT_ITEM_COUNTS, isSelectedKind } from './items';
import type { ArmorKind, ItemKind, SelectedKind } from './items';
import {
  Animal, AnimalPosition, MeatDrop, Bomb, Explosion, Sapling, BlockTarget, Chunk, ChunkData,
  Environment, Sleep, HorseRider, Player, PlayerBody, PlayerCollider, PlayerHealth, PlayerMesh, PlayerMount,
  PlayerPosition, PlayerState, PlayerVelocity, Projectile, RainMaterial, SnowMaterial, TargetMesh,
  Vehicle, VehicleMesh, VehicleMotion, VehiclePosition,
} from './traits';
import { createMeatInventory } from './meats';
import { useGameStore } from './store';
import { BlockKind, voxelKey } from './voxel';
import type { Voxel, VoxelHit } from './voxel';

type ChunkEdit = BlockKind | { kind: BlockKind; open?: boolean; growth?: number; items?: SelectedKind[]; facing?: Voxel['facing'] } | null;
export type SavedCar = { x: number; y: number; z: number; yaw: number; color: string };
export type SavedHorse = { x: number; y: number; z: number };
export type WorldSave = {
  version: 1 | 2 | 3;
  generation: number;
  seed: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number; flying: boolean };
  selected: SelectedKind;
  lives?: number;
  hotbar?: SelectedKind[];
  itemCounts?: Partial<Record<ItemKind, number>>;
  equippedArmor?: ArmorKind | null;
  vehicles?: SavedCar[];
  saddledHorses?: SavedHorse[];
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
  saddledHorses: SavedHorse[];
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

export function snapshotVehicles(world: World): SavedCar[] {
  return world.query(Vehicle, VehiclePosition, VehicleMotion).map((entity) => {
    const position = entity.get(VehiclePosition)!;
    const motion = entity.get(VehicleMotion)!;
    return { x: position.x, y: position.y, z: position.z, yaw: motion.yaw, color: entity.get(Vehicle)!.color };
  });
}

export function snapshotSaddledHorses(world: World): SavedHorse[] {
  const state = stateFor(world);
  const horses = [...state.saddledHorses];
  for (const entity of world.query(Animal, AnimalPosition, HorseRider)) {
    if (!entity.get(HorseRider)!.saddled) continue;
    const position = entity.get(AnimalPosition)!;
    for (let index = horses.length - 1; index >= 0; index -= 1) {
      if (Math.hypot(horses[index].x - position.x, horses[index].z - position.z) < 3) horses.splice(index, 1);
    }
    horses.push({ x: position.x, y: position.y, z: position.z });
  }
  state.saddledHorses = horses;
  return horses;
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
        const data = typeof kind === 'number' ? { kind, open: false } : kind;
        blockMap.set(position, { x, y, z, kind: data.kind, open: data.open, growth: data.growth, items: data.items, facing: data.facing });
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
  for (const savedHorse of state.saddledHorses) {
    if (chunkCoordinate(savedHorse.x) !== cx || chunkCoordinate(savedHorse.z) !== cz) continue;
    const existing = data.animals.find((animal) => {
      if (animal.get(Animal)?.kind !== 'horse') return false;
      const position = animal.get(AnimalPosition)!;
      return Math.hypot(position.x - savedHorse.x, position.z - savedHorse.z) < 2;
    });
    if (existing) existing.add(HorseRider({ saddled: true }));
    else {
      const horse = spawnAnimal(world, 'horse', savedHorse.x, savedHorse.y, savedHorse.z, state.seed);
      horse.add(HorseRider({ saddled: true }));
      data.animals.push(horse);
    }
  }
  for (const block of data.blocks) {
    if (block.kind === BlockKind.Tnt) data.bombs.push(spawnBomb(world, block.x, block.y, block.z));
    if (isSapling(block.kind) || (isCrop(block.kind) && (block.growth ?? 3) < 3)) data.saplings.push(spawnSapling(world, block.kind, block.x, block.y, block.z));
  }

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
  const playerEntity = world.queryFirst(Player);
  const mounted = playerEntity?.get(PlayerMount)?.vehicle;
  const playerPosition = playerEntity?.get(PlayerPosition);
  for (const animal of data.animals) {
    const position = animal.get(AnimalPosition);
    const nearby = playerPosition && position && position.distanceToSquared(playerPosition) < 48 * 48;
    if (animal !== mounted && !nearby) animal.destroy();
  }
  for (const bomb of data.bombs) bomb.destroy();
  for (const sapling of data.saplings) sapling.destroy();
  data.animals = [];
  data.bombs = [];
  data.saplings = [];
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

export function explodeVoxels(world: World, x: number, y: number, z: number, radius: number) {
  const state = stateFor(world);
  const touched = new Set<Entity>();
  let destroyed = 0;

  for (const entity of world.query(Chunk, ChunkData)) {
    const chunk = entity.get(Chunk)!;
    const data = entity.get(ChunkData)!;
    const remaining = [];
    let changed = false;
    for (const block of data.blocks) {
      const distance = Math.hypot(block.x - x, block.y - y, block.z - z);
      if (distance <= radius && block.kind !== BlockKind.Bedrock) {
        const position = voxelKey(block.x, block.y, block.z);
        state.blocks.delete(position);
        editsFor(state, chunk.x, chunk.z).set(position, null);
        destroyed += 1;
        changed = true;
      } else {
        remaining.push(block);
      }
    }
    if (changed) {
      data.blocks = remaining;
      touched.add(entity);
    }
  }

  for (const entity of touched) {
    const chunk = entity.get(Chunk)!;
    touchChunk(entity);
    touchNeighbors(state, chunk.x, chunk.z);
  }
  return destroyed;
}

export function growSapling(world: World, kind: BlockKind, x: number, y: number, z: number) {
  const block = getBlockIndex(world).get(voxelKey(x, y, z));
  if (!block) return;
  replaceVoxel(world, { block, x, y, z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, BlockKind.Wood);
  for (let trunk = 1; trunk <= 4 && y + trunk <= MAX_BUILD_Y; trunk += 1) {
    addVoxel(world, x, y + trunk, z, BlockKind.Wood);
  }

  const leafKind = kind === BlockKind.PineSapling
    ? BlockKind.PineLeaves
    : kind === BlockKind.AutumnSapling ? BlockKind.AutumnLeaves : BlockKind.Leaves;
  const winter = biomeAt(x, z, getWorldSeed(world)) === 'winter';
  if (kind === BlockKind.PineSapling) {
    for (let layer = 0; layer <= 4; layer += 1) {
      const radius = Math.max(0, 2 - Math.floor(layer / 2));
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          if (dx === 0 && dz === 0) continue;
          addVoxel(world, x + dx, y + 2 + layer, z + dz, BlockKind.PineLeaves);
          if (winter && layer >= 2 && Math.abs(dx * 7 + dz * 11 + layer) % 3 === 0) {
            addVoxel(world, x + dx, y + 3 + layer, z + dz, BlockKind.Snow);
          }
        }
      }
    }
    addVoxel(world, x, y + 6, z, BlockKind.PineLeaves);
    return;
  }
  for (let dx = -2; dx <= 2; dx += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 4 || (dx === 0 && dz === 0)) continue;
        const leafY = y + 4 + dy;
        if (leafY > MAX_BUILD_Y) continue;
        const apple = kind === BlockKind.OakSapling && Math.abs(dx * 13 + dz * 17 + dy * 19) % 9 === 0;
        addVoxel(world, x + dx, leafY, z + dz, apple ? BlockKind.Apple : leafKind);

      }
    }
  }
}

export function replaceVoxel(world: World, hit: VoxelHit, kind: BlockKind, open?: boolean, growth?: number, items?: SelectedKind[]) {
  const state = stateFor(world);
  const block = state.blocks.get(voxelKey(hit.x, hit.y, hit.z));
  if (!block) return;
  block.kind = kind;
  if (open !== undefined) block.open = open;
  if (isCrop(kind)) block.growth = growth ?? block.growth ?? 3;
  else delete block.growth;
  if (isChest(kind)) block.items = items ?? block.items ?? [];
  else delete block.items;
  if (!isLadder(kind)) delete block.facing;
  const cx = chunkCoordinate(hit.x);
  const cz = chunkCoordinate(hit.z);
  const chunkEntity = state.chunks.get(chunkKey(cx, cz));
  if (!chunkEntity) return;
  const door = isDoor(kind) || isTrapdoor(kind);
  const edit = door ? { kind, open: block.open ?? false }
    : isCrop(kind) ? { kind, growth: block.growth ?? 0 }
      : isChest(kind) ? { kind, items: block.items ?? [] }
        : isLadder(kind) ? { kind, facing: block.facing ?? 'north' } : kind;
  editsFor(state, cx, cz).set(voxelKey(hit.x, hit.y, hit.z), edit);
  touchChunk(chunkEntity);
  touchNeighbors(state, cx, cz);
}

export function addVoxel(world: World, x: number, y: number, z: number, kind: BlockKind, growth?: number, facing?: Voxel['facing']) {
  const state = stateFor(world);
  const cx = chunkCoordinate(x);
  const cz = chunkCoordinate(z);
  const key = chunkKey(cx, cz);
  if (!state.chunks.has(key)) loadChunk(world, cx, cz);

  const chunkEntity = state.chunks.get(key)!;
  const data = chunkEntity.get(ChunkData)!;
  const position = voxelKey(x, y, z);
  const existing = state.blocks.get(position);
  if (existing && existing.kind !== BlockKind.Water) return;
  if (existing) data.blocks = data.blocks.filter((block) => voxelKey(block.x, block.y, block.z) !== position);

  const block: Voxel = { x, y, z, kind };
  if (isCrop(kind)) block.growth = growth ?? 3;
  if (isChest(kind)) block.items = [];
  if (isLadder(kind)) block.facing = facing ?? 'north';
  data.blocks.push(block);
  state.blocks.set(position, block);
  const edit = isCrop(kind) ? { kind, growth: block.growth ?? 0 }
    : isChest(kind) ? { kind, items: [] }
      : isLadder(kind) ? { kind, facing: block.facing ?? 'north' } : kind;
  editsFor(state, cx, cz).set(position, edit);
  touchChunk(chunkEntity);
  touchNeighbors(state, cx, cz);
}

export function loadLevel(world: World, generation = 0, saved: WorldSave | null = null): LevelData {
  for (const entity of [...world.query(Chunk)]) entity.destroy();
  for (const entity of [...world.query(Animal)]) entity.destroy();
  for (const entity of [...world.query(MeatDrop)]) entity.destroy();
  for (const entity of [...world.query(Bomb)]) entity.destroy();
  for (const entity of [...world.query(Explosion)]) entity.destroy();
  for (const entity of [...world.query(Sapling)]) entity.destroy();
  for (const entity of [...world.query(Player)]) entity.destroy();
  for (const entity of [...world.query(BlockTarget)]) entity.destroy();
  for (const entity of [...world.query(Environment)]) entity.destroy();
  for (const entity of [...world.query(Projectile)]) entity.destroy();
  for (const entity of [...world.query(Vehicle)]) entity.destroy();
  for (const entity of [...world.query(Sleep)]) entity.destroy();

  const restore = saved && (saved.version === 1 || saved.version === 2 || saved.version === 3) && saved.generation === generation ? saved : null;
  const seed = restore?.seed ?? 73421 + generation * 977;
  const edits: WorldChunks['edits'] = restore ? new Map(restore.edits.map(([chunk, values]) => [chunk, new Map(values)])) : new Map();
  worlds.set(world, { seed, chunks: new Map(), blocks: new Map(), edits, saddledHorses: restore?.saddledHorses ?? [] });
  const restorePosition = restore?.version === 2 || restore?.version === 3;
  const spawn = restore && restorePosition
    ? { x: restore.player.x, y: restore.player.y, z: restore.player.z }
    : { x: 0, y: heightAt(0, 0, seed) + 1.01, z: 0 };
  world.spawn(
    Player,
    PlayerBody(),
    PlayerCollider(),
    PlayerMesh(),
    PlayerMount(),
    PlayerHealth({ value: restore?.lives ?? 10, max: 10 }),
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
  if (restore) environmentEntity.get(Environment)!.elapsed = restore.elapsed;
  const hotbar = restore?.hotbar?.length === 10 && restore.hotbar.every(isSelectedKind)
    ? restore.hotbar
    : useGameStore.getState().hotbarSlots;
  useGameStore.setState({
    meat: { ...createMeatInventory(), ...restore?.meat },
    selected: restore && isSelectedKind(restore.selected) ? restore.selected : BlockKind.Grass,
    hotbarSlots: hotbar,
    itemCounts: { ...DEFAULT_ITEM_COUNTS, ...restore?.itemCounts },
    equippedArmor: restore?.equippedArmor ?? null,
    riding: null,
    lives: restore?.lives ?? 10,
    apples: restore?.apples ?? 0,
    flying: restore?.player.flying ?? false,
    notice: '',
  });
  for (const car of restore?.vehicles ?? []) {
    world.spawn(Vehicle({ color: car.color }), VehiclePosition(new Vector3(car.x, car.y, car.z)), VehicleMotion({ yaw: car.yaw }), VehicleMesh());
  }
  streamChunks(world, spawn.x, spawn.z);
  return { spawn };
}
