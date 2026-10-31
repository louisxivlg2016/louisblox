import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { CHUNK_SIZE, MAX_BUILD_Y, MIN_WORLD_Y, VIEW_DISTANCE, biomeAt, generateChunk, heightAt } from './levels';
import type { LevelData } from './levels';
import { battleSpawn, generateBattleChunk } from './battleArena';
import type { GameplayMode } from './worldMode';
import { spawnAnimal, spawnChunkAnimals } from './animals';
import { spawnChunkFish } from './fish';
import { spawnBomb } from './bombLifecycle';
import { spawnSapling } from './saplingLifecycle';
import { isChest, isCrop, isDoor, isFireBlock, isLadder, isRail, isSapling, isSign, isTrapdoor } from './extraBlocks';
import { clearFires, extinguishFireAt, extinguishFiresInChunk, spawnFire } from './fireLifecycle';
import { DEFAULT_ITEM_COUNTS, isSelectedKind } from './items';
import type { ArmorKind, SelectedKind } from './items';
import {
  Animal, AnimalPosition, Fish, MeatDrop, Bomb, Explosion, Sapling, BlockTarget, Chunk, ChunkData,
  Environment, Sleep, HorseRider, Player, PlayerBody, PlayerCollider, PlayerHealth, PlayerMesh, PlayerMount,
  PlayerPosition, PlayerState, PlayerVelocity, Projectile, RainMaterial, SnowMaterial, TargetMesh,
  Vehicle, VehicleHealth, VehicleMesh, VehicleMotion, VehiclePosition,
} from './traits';
import { createMeatInventory } from './meats';
import { useGameStore } from './store';
import { BlockKind, voxelKey } from './voxel';
import type { Voxel, VoxelHit } from './voxel';

export type ChunkEdit = BlockKind | { kind: BlockKind; open?: boolean; growth?: number; items?: SelectedKind[]; facing?: Voxel['facing']; text?: string } | null;
export type SavedCar = { id?: string; x: number; y: number; z: number; yaw: number; color: string; kind?: 'car' | 'plane' | 'train' | 'boat' };
export type SavedHorse = { x: number; y: number; z: number };
export type WorldSave = {
  version: 1 | 2 | 3 | 4;
  generation: number;
  gameplayMode?: GameplayMode;
  seed: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number; flying: boolean };
  selected: SelectedKind;
  lives?: number;
  hotbar?: SelectedKind[];
  itemCounts?: Partial<Record<string, number>>;
  equippedArmor?: ArmorKind | null;
  vehicles?: SavedCar[];
  saddledHorses?: SavedHorse[];
  apples: number;
  meat?: Record<import('./animals').AnimalKind, number>;
  elapsed: number;
  edits: Array<[string, Array<[string, ChunkEdit]>]>;
};

type WorldChunks = {
  world: World;
  seed: number;
  chunks: Map<string, Entity>;
  blocks: Map<string, Voxel>;
  water: Map<string, Voxel>;
  tops: Map<string, number>;
  edits: Map<string, Map<string, ChunkEdit>>;
  saddledHorses: SavedHorse[];
  streamCenter: string | null;
  streamOrder: Array<{ x: number; z: number }>;
  batchDepth: number;
  pendingRevisions: Set<Entity>;
};

const worlds = new WeakMap<World, WorldChunks>();
const editListeners = new WeakMap<World, Set<(position: string, edit: ChunkEdit) => void>>();
const chunkKey = (x: number, z: number) => `${x},${z}`;

export function onVoxelEdit(world: World, listener: (position: string, edit: ChunkEdit) => void) {
  let listeners = editListeners.get(world);
  if (!listeners) {
    listeners = new Set();
    editListeners.set(world, listeners);
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const chunkCoordinate = (value: number) => Math.floor((value + 0.5) / CHUNK_SIZE);

const columnKey = (x: number, z: number) => `${x},${z}`;

function supportsGround(block: Voxel) {
  return block.kind !== BlockKind.Water && !isCrop(block.kind) && !isRail(block.kind)
    && !(block.open && block.kind >= 48 && block.kind <= 79);
}

function refreshTop(state: WorldChunks, x: number, z: number, fromY = MAX_BUILD_Y) {
  const column = columnKey(x, z);
  for (let y = fromY; y >= MIN_WORLD_Y; y -= 1) {
    const block = state.blocks.get(voxelKey(x, y, z));
    if (!block || !supportsGround(block)) continue;
    state.tops.set(column, y);
    return;
  }
  state.tops.delete(column);
}

function indexBlock(state: WorldChunks, block: Voxel) {
  const position = voxelKey(block.x, block.y, block.z);
  if (block.kind === BlockKind.Water) state.water.set(position, block);
  else state.water.delete(position);
  if (supportsGround(block)) {
    const column = columnKey(block.x, block.z);
    if ((state.tops.get(column) ?? MIN_WORLD_Y - 1) < block.y) state.tops.set(column, block.y);
  } else if (state.tops.get(columnKey(block.x, block.z)) === block.y) {
    refreshTop(state, block.x, block.z, block.y - 1);
  }
}

function unindexBlock(state: WorldChunks, block: Voxel, refresh = true) {
  state.water.delete(voxelKey(block.x, block.y, block.z));
  if (refresh && state.tops.get(columnKey(block.x, block.z)) === block.y) refreshTop(state, block.x, block.z, block.y - 1);
}

function stateFor(world: World) {
  const state = worlds.get(world);
  if (!state) throw new Error('Le monde de chunks n’est pas initialisé');
  return state;
}

export function snapshotWorldEdits(world: World): WorldSave['edits'] {
  return [...stateFor(world).edits].map(([chunk, edits]) => [chunk, [...edits]]);
}

export function groupVoxelEdits(edits: Array<[string, ChunkEdit]>): WorldSave['edits'] {
  const groups = new Map<string, Array<[string, ChunkEdit]>>();
  for (const entry of edits) {
    const [x, , z] = entry[0].split(',').map(Number);
    const key = chunkKey(chunkCoordinate(x), chunkCoordinate(z));
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return [...groups];
}

export function snapshotVehicles(world: World): SavedCar[] {
  return world.query(Vehicle, VehiclePosition, VehicleMotion).map((entity) => {
    const position = entity.get(VehiclePosition)!;
    const motion = entity.get(VehicleMotion)!;
    const vehicle = entity.get(Vehicle)!;
    const id = vehicle.id || crypto.randomUUID();
    if (!vehicle.id) entity.set(Vehicle, { id });
    return { id, x: position.x, y: position.y, z: position.z, yaw: motion.yaw, color: vehicle.color, kind: vehicle.kind };
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

function touchVoxel(state: WorldChunks, cx: number, cz: number, x: number, z: number, touched = new Set<Entity>()) {
  touched.add(state.chunks.get(chunkKey(cx, cz))!);
  if (x === cx * CHUNK_SIZE) touched.add(state.chunks.get(chunkKey(cx - 1, cz))!);
  if (x === cx * CHUNK_SIZE + CHUNK_SIZE - 1) touched.add(state.chunks.get(chunkKey(cx + 1, cz))!);
  if (z === cz * CHUNK_SIZE) touched.add(state.chunks.get(chunkKey(cx, cz - 1))!);
  if (z === cz * CHUNK_SIZE + CHUNK_SIZE - 1) touched.add(state.chunks.get(chunkKey(cx, cz + 1))!);
  return touched;
}

function blockEdit(block: Voxel): ChunkEdit {
  const edit = { kind: block.kind } as Exclude<ChunkEdit, number | null>;
  if (block.open !== undefined) edit.open = block.open;
  if (block.growth !== undefined) edit.growth = block.growth;
  if (block.items !== undefined) edit.items = block.items;
  if (block.facing !== undefined) edit.facing = block.facing;
  if (block.text !== undefined) edit.text = block.text;
  return Object.keys(edit).length === 1 ? block.kind : edit;
}

export function setVoxelText(world: World, position: { x: number; y: number; z: number }, text: string) {
  const state = stateFor(world);
  const block = state.blocks.get(voxelKey(position.x, position.y, position.z));
  if (!block) return false;
  block.text = text.replace(/\r/g, '').slice(0, 120);
  const cx = chunkCoordinate(position.x);
  const cz = chunkCoordinate(position.z);
  editsFor(state, cx, cz).set(voxelKey(position.x, position.y, position.z), blockEdit(block));
  recordVoxelEdit(state, cx, cz, position.x, position.y, position.z);
  return true;
}

function recordVoxelEdit(state: WorldChunks, cx: number, cz: number, x: number, y: number, z: number, removed = false) {
  if (state.batchDepth > 0) touchVoxel(state, cx, cz, x, z, state.pendingRevisions);
  else for (const entity of touchVoxel(state, cx, cz, x, z)) touchChunk(entity);
  const position = voxelKey(x, y, z);
  const block = state.blocks.get(position);
  const edit = removed || !block ? null : blockEdit(block);
  for (const listener of editListeners.get(state.world) ?? []) listener(position, edit);
}

export function batchVoxelEdits(world: World, edit: () => void) {
  const state = stateFor(world);
  state.batchDepth += 1;
  try {
    edit();
  } finally {
    state.batchDepth -= 1;
    if (state.batchDepth > 0) return;
    for (const entity of state.pendingRevisions) touchChunk(entity);
    state.pendingRevisions.clear();
  }
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

  const battle = useGameStore.getState().gameplayMode === 'battle';
  const generated = battle ? generateBattleChunk(cx, cz) : generateChunk(cx, cz, state.seed);
  const blockMap = new Map(generated.blocks.map((block) => [voxelKey(block.x, block.y, block.z), block]));
  const edits = state.edits.get(key);
  if (edits) {
    for (const [position, kind] of edits) {
      if (kind === null) blockMap.delete(position);
      else {
        const [x, y, z] = position.split(',').map(Number);
        const data = typeof kind === 'number' ? { kind, open: false } : kind;
        blockMap.set(position, { x, y, z, kind: data.kind, open: data.open, growth: data.growth, items: data.items, facing: data.facing, text: typeof data.text === 'string' ? data.text.replace(/\r/g, '').slice(0, 120) : undefined });
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
    indexBlock(state, block);
  }
  data.animals = battle ? [] : spawnChunkAnimals(world, cx, cz, generated.water, state.seed);
  data.fish = battle ? [] : spawnChunkFish(world, cx, cz, generated.water, state.seed);
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
    if (isFireBlock(block.kind)) spawnFire(world, block);
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
    unindexBlock(state, block, false);
    state.tops.delete(columnKey(block.x, block.z));
  }
  const playerEntity = world.queryFirst(Player);
  const mounted = playerEntity?.get(PlayerMount)?.vehicle;
  const playerPosition = playerEntity?.get(PlayerPosition);
  for (const animal of data.animals) {
    const position = animal.get(AnimalPosition);
    const nearby = playerPosition && position && position.distanceToSquared(playerPosition) < 48 * 48;
    if (animal !== mounted && !nearby) animal.destroy();
  }
  for (const fish of data.fish) fish.destroy();
  for (const bomb of data.bombs) bomb.destroy();
  for (const sapling of data.saplings) sapling.destroy();
  extinguishFiresInChunk(world, chunk.x, chunk.z);
  data.animals = [];
  data.fish = [];
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
  const center = chunkKey(centerX, centerZ);
  const chunkCount = (VIEW_DISTANCE * 2 + 1) ** 2;
  if (state.streamCenter === center && state.chunks.size === chunkCount) return;

  if (state.streamCenter !== center) {
    state.streamCenter = center;
    state.streamOrder = [];
    for (let dx = -VIEW_DISTANCE; dx <= VIEW_DISTANCE; dx += 1) {
      for (let dz = -VIEW_DISTANCE; dz <= VIEW_DISTANCE; dz += 1) {
        state.streamOrder.push({ x: centerX + dx, z: centerZ + dz });
      }
    }
    state.streamOrder.sort((a, b) =>
      (a.x - centerX) ** 2 + (a.z - centerZ) ** 2 - (b.x - centerX) ** 2 - (b.z - centerZ) ** 2,
    );
    for (const entity of [...world.query(Chunk)]) {
      const chunk = entity.get(Chunk)!;
      if (Math.abs(chunk.x - centerX) > VIEW_DISTANCE || Math.abs(chunk.z - centerZ) > VIEW_DISTANCE) unloadChunk(world, entity);
    }
  }

  for (const chunk of state.streamOrder) {
    if (state.chunks.has(chunkKey(chunk.x, chunk.z))) continue;
    loadChunk(world, chunk.x, chunk.z);
    break;
  }
}

export function getBlockIndex(world: World) {
  return stateFor(world).blocks;
}

export function getWaterIndex(world: World) {
  return stateFor(world).water;
}

export function getColumnTop(world: World, x: number, z: number) {
  return stateFor(world).tops.get(columnKey(x, z));
}

export function isChunkLoaded(world: World, x: number, z: number) {
  const state = stateFor(world);
  return state.chunks.has(chunkKey(chunkCoordinate(x), chunkCoordinate(z)));
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
  unindexBlock(state, hit.block);
  if (isFireBlock(hit.block.kind)) extinguishFireAt(world, hit.x, hit.y, hit.z);
  editsFor(state, cx, cz).set(position, null);
  recordVoxelEdit(state, cx, cz, hit.x, hit.y, hit.z, true);
}

export function explodeVoxels(world: World, x: number, y: number, z: number, radius: number) {
  let destroyed = 0;
  batchVoxelEdits(world, () => {
    const state = stateFor(world);
    for (const entity of world.query(Chunk, ChunkData)) {
      const chunk = entity.get(Chunk)!;
      const data = entity.get(ChunkData)!;
      if (Math.abs(chunk.x * CHUNK_SIZE + CHUNK_SIZE / 2 - x) > radius + CHUNK_SIZE || Math.abs(chunk.z * CHUNK_SIZE + CHUNK_SIZE / 2 - z) > radius + CHUNK_SIZE) continue;
      const remaining = [];
      let changed = false;
      for (const block of data.blocks) {
        const distance = Math.hypot(block.x - x, block.y - y, block.z - z);
        if (distance <= radius && block.kind !== BlockKind.Bedrock) {
          const position = voxelKey(block.x, block.y, block.z);
          state.blocks.delete(position);
          unindexBlock(state, block);
          if (isFireBlock(block.kind)) extinguishFireAt(world, block.x, block.y, block.z);
          editsFor(state, chunk.x, chunk.z).set(position, null);
          recordVoxelEdit(state, chunk.x, chunk.z, block.x, block.y, block.z, true);
          destroyed += 1;
          changed = true;
        } else {
          remaining.push(block);
        }
      }
      if (changed) data.blocks = remaining;
    }
  });
  return destroyed;
}

function growTree(world: World, kind: BlockKind, x: number, y: number, z: number) {
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

export function growSapling(world: World, kind: BlockKind, x: number, y: number, z: number) {
  batchVoxelEdits(world, () => growTree(world, kind, x, y, z));
}

export function replaceVoxel(world: World, hit: VoxelHit, kind: BlockKind, open?: boolean, growth?: number, items?: SelectedKind[], facing?: Voxel['facing']) {
  const state = stateFor(world);
  const block = state.blocks.get(voxelKey(hit.x, hit.y, hit.z));
  if (!block) return;
  const wasFire = isFireBlock(block.kind);
  block.kind = kind;
  if (open !== undefined) block.open = open;
  if (isCrop(kind)) block.growth = growth ?? block.growth ?? 3;
  else delete block.growth;
  if (isChest(kind)) block.items = items ?? block.items ?? [];
  else delete block.items;
  if (facing !== undefined) block.facing = facing;
  if (!isLadder(kind) && !isDoor(kind) && !isTrapdoor(kind) && !isRail(kind) && !isSign(kind)) delete block.facing;
  indexBlock(state, block);
  const cx = chunkCoordinate(hit.x);
  const cz = chunkCoordinate(hit.z);
  const chunkEntity = state.chunks.get(chunkKey(cx, cz));
  if (!chunkEntity) return;
  const door = isDoor(kind) || isTrapdoor(kind);
  const edit = door ? { kind, open: block.open ?? false, facing: block.facing ?? 'north' }
    : isCrop(kind) ? { kind, growth: block.growth ?? 0 }
      : isChest(kind) ? { kind, items: block.items ?? [] }
        : isLadder(kind) || isRail(kind) ? { kind, facing: block.facing ?? 'north' } : kind;
  editsFor(state, cx, cz).set(voxelKey(hit.x, hit.y, hit.z), edit);
  recordVoxelEdit(state, cx, cz, hit.x, hit.y, hit.z);
  if (wasFire || isFireBlock(kind)) {
    extinguishFireAt(world, hit.x, hit.y, hit.z);
    if (isFireBlock(kind)) spawnFire(world, block);
  }
}

export function addVoxel(world: World, x: number, y: number, z: number, kind: BlockKind, growth?: number, facing?: Voxel['facing'], fireGeneration = 0) {
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
  if (isSign(kind)) block.text = '';
  if (isLadder(kind) || isDoor(kind) || isTrapdoor(kind) || isRail(kind) || isSign(kind)) block.facing = facing ?? 'north';
  data.blocks.push(block);
  state.blocks.set(position, block);
  indexBlock(state, block);
  const edit = isCrop(kind) ? { kind, growth: block.growth ?? 0 }
    : isChest(kind) ? { kind, items: [] }
      : isSign(kind) ? { kind, text: '', facing: block.facing ?? 'north' }
        : isLadder(kind) || isRail(kind) ? { kind, facing: block.facing ?? 'north' } : kind;
  editsFor(state, cx, cz).set(position, edit);
  recordVoxelEdit(state, cx, cz, x, y, z);
  if (isFireBlock(kind)) spawnFire(world, block, fireGeneration);
  return block;
}

export function applyVoxelEdit(world: World, position: string, edit: ChunkEdit) {
  const [x, y, z] = position.split(',').map(Number);
  const state = stateFor(world);
  if (edit === null) {
    const block = state.blocks.get(position);
    if (block) removeVoxel(world, { block, x, y, z, normal: { x: 0, y: 1, z: 0 }, distance: 0 });
    else {
      const cx = chunkCoordinate(x);
      const cz = chunkCoordinate(z);
      editsFor(state, cx, cz).set(position, null);
      recordVoxelEdit(state, cx, cz, x, y, z, true);
    }
    return;
  }
  const data = typeof edit === 'number' ? { kind: edit } : edit;
  const block = state.blocks.get(position) ?? addVoxel(world, x, y, z, data.kind, data.growth, data.facing);
  if (block) {
    replaceVoxel(world, { block, x, y, z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, data.kind, data.open, data.growth, data.items, data.facing);
    if (typeof data.text === 'string') setVoxelText(world, { x, y, z }, data.text);
  }
}

export function applyVoxelEdits(world: World, edits: Array<[string, ChunkEdit]>) {
  batchVoxelEdits(world, () => {
    for (const [position, edit] of edits) applyVoxelEdit(world, position, edit);
  });
}

export function loadLevel(world: World, generation = 0, saved: WorldSave | null = null): LevelData {
  clearFires(world);
  for (const entity of [...world.query(Chunk)]) entity.destroy();
  for (const entity of [...world.query(Animal)]) entity.destroy();
  for (const entity of [...world.query(Fish)]) entity.destroy();
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

  const restore = saved && (saved.version === 1 || saved.version === 2 || saved.version === 3 || saved.version === 4) && saved.generation === generation ? saved : null;
  const seed = restore?.seed ?? 73421 + generation * 977;
  const edits: WorldChunks['edits'] = restore ? new Map(restore.edits.map(([chunk, values]) => [chunk, new Map(values)])) : new Map();
  worlds.set(world, {
    world,
    seed,
    chunks: new Map(),
    blocks: new Map(),
    water: new Map(),
    tops: new Map(),
    edits,
    saddledHorses: restore?.saddledHorses ?? [],
    streamCenter: null,
    streamOrder: [],
    batchDepth: 0,
    pendingRevisions: new Set(),
  });
  const restorePosition = restore !== null && restore.version >= 2;
  const gameplayMode = restore?.gameplayMode ?? (restore ? 'creative' : useGameStore.getState().gameplayMode);
  const spawn = restore && restorePosition
    ? { x: restore.player.x, y: restore.player.y, z: restore.player.z }
    : gameplayMode === 'battle' ? battleSpawn(null) : { x: 0, y: heightAt(0, 0, seed) + 1.01, z: 0 };
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
    gameplayMode,
    meat: { ...createMeatInventory(), ...restore?.meat },
    selected: restore && isSelectedKind(restore.selected) ? restore.selected : gameplayMode === 'survival' ? 'hand' : BlockKind.Grass,
    hotbarSlots: hotbar,
    itemCounts: gameplayMode === 'survival' ? { hand: 1, ...restore?.itemCounts } : { ...DEFAULT_ITEM_COUNTS, ...restore?.itemCounts },
    equippedArmor: restore?.equippedArmor ?? null,
    riding: null,
    ridingRole: null,
    seatChoice: null,
    bookOpen: false,
    lives: restore?.lives ?? 10,
    apples: restore?.apples ?? 0,
    flying: restore?.player.flying ?? false,
    notice: '',
  });
  for (const car of restore?.vehicles ?? []) {
    world.spawn(
      Vehicle({ id: car.id ?? crypto.randomUUID(), color: car.color, kind: car.kind ?? 'car' }),
      VehiclePosition(new Vector3(car.x, car.y, car.z)),
      VehicleMotion({ yaw: car.yaw, homeX: car.x, homeY: car.y, homeZ: car.z, homeYaw: car.yaw }),
      VehicleMesh(),
      VehicleHealth(),
    );
  }
  streamChunks(world, spawn.x, spawn.z);
  return { spawn };
}
