import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { DroppedItem } from './traits';
import { useEffectStore } from './effects';
import { CHUNK_SIZE, MAX_BUILD_Y, MIN_WORLD_Y, VIEW_DISTANCE, biomeAt, generateChunk, generateChunkDepth, safeSpawnAt } from './levels';
import type { GeneratedChunk, LevelData } from './levels';
import { battleSpawn, generateBattleChunk } from './battleArena';
import { generatePirateChunk, pirateSpawn } from './pirates';
import { generatePirateFortressChunk, pirateFortressSpawn } from './pirateFortress';
import { spawnPirateCannons } from './pirateCannons';
import { footballSpawn, generateFootballChunk } from './footballArena';
import { generateMazeChunk } from './maze';
import { generateHeistChunk, HEIST_HIDEOUT } from './heistCity';
import { DELIVERY_START, generateDeliveryChunk } from './deliveryCity';
import { generateSkyfallChunk, SKYFALL_SPAWN } from './skyfallArena';
import { generatePlanetChunk, PLANET_SPAWN } from './planetArena';
import { generateZombiePlanetChunk, ZOMBIE_PLANET_SPAWN } from './zombiePlanetArena';
import { ensurePlanetUniverse, getPlanetUniverse } from './planetUniverse';
import { generateDeepChunk, DEEP_SPAWN } from './deepArena';
import { generateRoleplayChunk, ROLEPLAY_SPAWN } from './roleplayCity';
import { mazePlaygroundSpawn } from './mazePlayground';
import type { GameplayMode } from './worldMode';
import { CITY_CENTER_LIMIT, isCityMode, isMinigameMode } from './worldMode';
import { CITY_SPAWN, generateCityChunk } from './cities';
import { spawnCountrysideAnimals } from './countryside';
import { generateVillageBlocks, removeVillageTrees } from './villages';
import { spawnAnimal, spawnChunkAnimals } from './animals';
import { spawnChunkFish } from './fish';
import { spawnBomb } from './bombLifecycle';
import { spawnSapling } from './saplingLifecycle';
import { hasWaterOpening, isBed, isCarpet, isChest, isCrop, isDoor, isFireBlock, isGrassPlate, isLadder, isPainting, isRail, isSapling, isSign, isSlab, isStair, isTrafficSign, isTrapdoor, PARIS_STREET_SIGN_TEXT } from './extraBlocks';
import { clearFires, extinguishFireAt, spawnFire } from './fireLifecycle';
import { DEFAULT_ITEM_COUNTS, isSelectedKind, storedAnimalIdFromSelection } from './items';
import type { ArmorKind, SelectedKind } from './items';
import {
  Animal, AnimalPosition, Fish, MeatDrop, Bomb, Explosion, Sapling, BlockTarget, Chunk, ChunkData,
  Environment, Sleep, HorseRider, Player, PlayerBody, PlayerCollider, PlayerHealth, PlayerMesh, PlayerMount,
  PlayerPosition, PlayerState, PlayerVelocity, Projectile, RainMaterial, SnowMaterial, TargetMesh,
  Vehicle, VehicleHealth, VehicleMesh, VehicleMotion, VehiclePosition, Trader, TraderMesh, TraderPosition, CamelLeash,
} from './traits';
import { createMeatInventory } from './meats';
import { clearPaintSplashAt, normalizePaintballCounts, normalizePaintballGun, restorePaintStrokes } from './paintball';
import { useGameStore } from './store';
import { BlockKind, cleanPaintingSize, cleanSignTextSize, DEFAULT_SIGN_TEXT_SIZE, isWaterBlock, voxelKey } from './voxel';
import { cleanPaintingImage } from './paintingImage';
import type { Voxel, VoxelHit } from './voxel';
import { canEditAt, newProtection, useProtectionStore } from './protection';
import type { WorldProtection } from './protection';
import type { VehicleKind } from './vehicleTypes';
import { resetBombLauncher } from './weaponAmmo';
import { customWorldSpawn, generateCustomChunk } from './customWorld';
import { createCustomWorld, DEFAULT_WORLD_SOURCE, sanitizeCustomWorld } from './worldCode';
import { initTaming } from './taming';
import { translate } from './language';
import { isSeason, useSeasonStore } from './seasons';
import { DAY_DURATION } from './dayNight';

export type ChunkEdit = BlockKind | { kind: BlockKind; open?: boolean; growth?: number; items?: SelectedKind[]; facing?: Voxel['facing']; text?: string; textSize?: number; image?: string; paintingSize?: number; food?: SelectedKind; meat?: import('./animals').AnimalKind; protected?: boolean; waterlogged?: boolean; floodSource?: boolean; floodDepth?: number; shop?: Voxel['shop']; season?: Voxel['season'] } | null;
export type SavedCar = { id?: string; x: number; y: number; z: number; yaw: number; color: string; kind?: VehicleKind };
export type SavedHorse = { x: number; y: number; z: number };
export type WorldSave = {
  version: 1 | 2 | 3 | 4 | 5;
  worldId?: string;
  worldName?: string;
  generation: number;
  gameplayMode?: GameplayMode;
  multiplayer?: boolean;
  template?: import('./worldMode').WorldTemplate;
  customWorld?: import('./worldCode').CustomWorldDefinition;
  thumbnail?: string;
  seed: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number; flying: boolean };
  selected: SelectedKind;
  lives?: number;
  hotbar?: Array<SelectedKind | null>;
  itemCounts?: Partial<Record<string, number>>;
  equippedArmor?: ArmorKind | null;
  vehicles?: SavedCar[];
  saddledHorses?: SavedHorse[];
  apples: number;
  coins?: number;
  meat?: Record<import('./animals').AnimalKind, number>;
  elapsed: number;
  edits: Array<[string, Array<[string, ChunkEdit]>]>;
  protection?: WorldProtection;
  paint?: import('./paintball').SavedPaintStroke[];
  season?: import('./seasons').Season;
  mixedSeasons?: import('./seasons').Season[];
  checkpoint?: { x: number; y: number; z: number };
  revision?: number;
  savedAt?: number;
};

type SavedTrader = { data: { homeX: number; homeZ: number; targetX: number; targetZ: number; phase: number; walking: boolean; health: number; panic: number; fireIn: number }; position: Vector3; yaw: number };

type WorldChunks = {
  world: World;
  seed: number;
  chunks: Map<string, Entity>;
  chunkCache: Map<string, GeneratedChunk>;
  depths: Map<string, number>;
  blocks: Map<string, Voxel>;
  water: Map<string, Voxel>;
  tops: Map<string, number>;
  edits: Map<string, Map<string, ChunkEdit>>;
  saddledHorses: SavedHorse[];
  traderSnapshots: Map<string, SavedTrader>;
  streamCenter: string | null;
  cameraChunk: string | null;
  streamOrder: Array<{ x: number; z: number }>;
  unloadOrder: Entity[];
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
  return !isGrassPlate(block) && !isCarpet(block.kind) && (!isSlab(block.kind) || block.growth === 0) && !isWaterBlock(block.kind) && block.kind !== BlockKind.JungleVine && !isCrop(block.kind) && !isRail(block.kind)
    && !(block.open && (isDoor(block.kind) || isTrapdoor(block.kind)));
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
  if (block.kind === BlockKind.Water || block.waterlogged === true && hasWaterOpening(block)) state.water.set(position, block);
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
  if (!state) throw new Error(translate('Le monde de chunks n’est pas initialisé', 'Chunk world is not initialized'));
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

export function touchChunk(entity: Entity | undefined) {
  if (!entity) return;
  const chunk = entity.get(Chunk);
  if (chunk) entity.set(Chunk, { revision: chunk.revision + 1 });
}

function touchNeighbors(state: WorldChunks, cx: number, cz: number) {
  const neighbors = [state.chunks.get(chunkKey(cx + 1, cz)), state.chunks.get(chunkKey(cx - 1, cz)), state.chunks.get(chunkKey(cx, cz + 1)), state.chunks.get(chunkKey(cx, cz - 1))];
  for (const entity of neighbors) {
    if (!entity) continue;
    if (state.batchDepth > 0) state.pendingRevisions.add(entity);
    else touchChunk(entity);
  }
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
  if (block.textSize !== undefined) edit.textSize = block.textSize;
  if (block.image !== undefined) edit.image = block.image;
  if (block.paintingSize !== undefined) edit.paintingSize = block.paintingSize;
  if (block.food !== undefined) edit.food = block.food;
  if (block.meat !== undefined) edit.meat = block.meat;
  if (block.protected === true) edit.protected = true;
  if (block.waterlogged === true) edit.waterlogged = true;
  if (block.floodSource === true) edit.floodSource = true;
  if (block.floodDepth !== undefined) edit.floodDepth = block.floodDepth;
  if (block.shop !== undefined) edit.shop = block.shop;
  if (block.season !== undefined) edit.season = block.season;
  return Object.keys(edit).length === 1 ? block.kind : edit;
}

export function setVoxelText(world: World, position: { x: number; y: number; z: number }, text: string, textSize?: number, authoritative = false) {
  if (!authoritative && !canEditAt(position.x, position.z)) return false;
  const state = stateFor(world);
  const block = state.blocks.get(voxelKey(position.x, position.y, position.z));
  if (!block) return false;
  block.text = text.replace(/\r/g, '').slice(0, 120);
  if (textSize !== undefined) {
    const size = cleanSignTextSize(textSize);
    if (size === DEFAULT_SIGN_TEXT_SIZE) delete block.textSize;
    else block.textSize = size;
  }
  const cx = chunkCoordinate(position.x);
  const cz = chunkCoordinate(position.z);
  editsFor(state, cx, cz).set(voxelKey(position.x, position.y, position.z), blockEdit(block));
  recordVoxelEdit(state, cx, cz, position.x, position.y, position.z);
  return true;
}

export function setVoxelImage(world: World, position: { x: number; y: number; z: number }, image: string, authoritative = false) {
  if (!authoritative && !canEditAt(position.x, position.z)) return false;
  const value = cleanPaintingImage(image);
  if (!value) return false;
  const state = stateFor(world);
  const block = state.blocks.get(voxelKey(position.x, position.y, position.z));
  if (!block || block.kind !== BlockKind.PaintingCustom && block.kind !== BlockKind.DrawingPainting) return false;
  block.image = value;
  const cx = chunkCoordinate(position.x);
  const cz = chunkCoordinate(position.z);
  editsFor(state, cx, cz).set(voxelKey(position.x, position.y, position.z), blockEdit(block));
  recordVoxelEdit(state, cx, cz, position.x, position.y, position.z);
  return true;
}

export function setVoxelPaintingSize(world: World, position: { x: number; y: number; z: number }, value: number, authoritative = false) {
  if (!authoritative && !canEditAt(position.x, position.z)) return false;
  const state = stateFor(world);
  const block = state.blocks.get(voxelKey(position.x, position.y, position.z));
  if (!block || !isPainting(block.kind)) return false;
  const size = cleanPaintingSize(value);
  if (size === 1) delete block.paintingSize;
  else block.paintingSize = size;
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

export function ensureChunkDepth(world: World, cx: number, cz: number, fromY: number) {
  const mode = useGameStore.getState().gameplayMode;
  if (mode === 'skyfall' || mode === 'planet') return;
  const state = stateFor(world);
  const key = chunkKey(cx, cz);
  const entity = state.chunks.get(key);
  if (!entity) return;
  const current = state.depths.get(key) ?? MIN_WORLD_Y;
  if (fromY >= current - 2 || current <= MIN_WORLD_Y) return;
  const target = Math.max(MIN_WORLD_Y, Math.min(current - 1, Math.floor(fromY) - 4));
  const data = entity.get(ChunkData)!;
  const edits = state.edits.get(key);
  for (const block of generateChunkDepth(cx, cz, target, current - 1, state.seed)) {
    const position = voxelKey(block.x, block.y, block.z);
    if (state.blocks.has(position)) continue;
    const edit = edits?.get(position);
    if (edit === null) continue;
    const actual = typeof edit === 'object' ? { ...block, ...edit } : edit === undefined ? block : { ...block, kind: edit };
    data.blocks.push(actual);
    state.blocks.set(position, actual);
    indexBlock(state, actual);
  }
  state.depths.set(key, target);
  touchChunk(entity);
}

function collapseVerticalDoors(blocks: Voxel[]) {
  const doors = new Map<string, Voxel>();
  const result: Voxel[] = [];
  for (const block of blocks) {
    if (!isDoor(block.kind)) {
      result.push(block);
      continue;
    }
    const key = `${block.x},${block.z},${block.kind}`;
    const existing = doors.get(key);
    if (!existing || block.y < existing.y) doors.set(key, block);
  }
  for (const block of result) doors.set(`${block.x},${block.z},${block.kind}`, block);
  for (const block of blocks) {
    if (isDoor(block.kind)) continue;
    result.push(block);
  }
  return [...doors.values(), ...result];
}

export function loadChunk(world: World, cx: number, cz: number) {
  const state = stateFor(world);
  const key = chunkKey(cx, cz);
  if (state.chunks.has(key)) return;

  const mode = useGameStore.getState().gameplayMode;
  const template = useGameStore.getState().worldTemplate;
  const battle = mode === 'battle';
  const customWorld = template === 'custom' ? useGameStore.getState().customWorld : null;
  const cached = state.chunkCache.get(key);
  if (mode === 'planet') ensurePlanetUniverse(useGameStore.getState().worldId);
  const generated = cached ?? (mode === 'pirates' && template === 'fortress' ? generatePirateFortressChunk(cx, cz) : mode === 'pirates' ? generatePirateChunk(cx, cz) : mode === 'football' ? generateFootballChunk(cx, cz) : mode === 'maze' ? generateMazeChunk(cx, cz) : mode === 'heist' ? generateHeistChunk(cx, cz, state.seed) : mode === 'delivery' ? generateDeliveryChunk(cx, cz) : mode === 'skyfall' ? generateSkyfallChunk(cx, cz) : mode === 'planet' && getPlanetUniverse() === 'zombie' ? generateZombiePlanetChunk(cx, cz) : mode === 'planet' ? generatePlanetChunk(cx, cz) : mode === 'deep-dive' ? generateDeepChunk(cx, cz) : mode === 'roleplay' ? generateRoleplayChunk(cx, cz) : battle ? generateBattleChunk(cx, cz) : template === 'custom' ? generateCustomChunk(cx, cz, state.seed, customWorld ?? createCustomWorld(DEFAULT_WORLD_SOURCE, state.seed)) : template === 'city-ancient' || template === 'city-modern' ? generateCityChunk(cx, cz, state.seed, template === 'city-modern') : generateChunk(cx, cz, state.seed));
  if (!cached && !isMinigameMode(mode) && !isCityMode(mode) && template !== 'custom') {
    generated.blocks = removeVillageTrees(generated.blocks, cx, cz, state.seed);
    generated.blocks.push(...generateVillageBlocks(cx, cz, state.seed));
  }
  const blockMap = new Map(generated.blocks.map((block) => [voxelKey(block.x, block.y, block.z), block]));
  const edits = state.edits.get(key);
  if (edits) {
    for (const [position, kind] of edits) {
      if (kind === null) blockMap.delete(position);
      else {
        const [x, y, z] = position.split(',').map(Number);
        const data = typeof kind === 'number' ? { kind, open: false } : kind;
        blockMap.set(position, { x, y, z, kind: data.kind, open: data.open, growth: data.growth, items: data.items, facing: data.facing, text: typeof data.text === 'string' ? data.text.replace(/\r/g, '').slice(0, 120) : undefined, textSize: data.textSize === undefined ? undefined : cleanSignTextSize(data.textSize), image: cleanPaintingImage(data.image), paintingSize: data.paintingSize === undefined ? undefined : cleanPaintingSize(data.paintingSize), food: data.food, meat: data.meat, protected: data.protected, waterlogged: data.waterlogged, floodSource: data.floodSource, floodDepth: data.floodDepth, shop: data.shop, season: data.season });
      }
    }
  }
  const collapsedBlocks = collapseVerticalDoors([...blockMap.values()]);
  blockMap.clear();
  for (const block of collapsedBlocks) blockMap.set(voxelKey(block.x, block.y, block.z), block);
  for (const block of blockMap.values()) {
    if (isPirateSeabed(block)) block.protected = true;
  }
  if (template !== 'custom') {
    for (const [position, block] of blockMap) {
      if (block.kind === BlockKind.Watermelon) blockMap.delete(position);
    }
  }

  const entity = world.spawn(Chunk({ x: cx, z: cz }), ChunkData());
  const data = entity.get(ChunkData)!;
  data.blocks = [...blockMap.values()];
  data.water = generated.water;
  state.depths.set(key, data.blocks.reduce((minimum, block) => block.y > MIN_WORLD_Y && block.kind !== BlockKind.Bedrock ? Math.min(minimum, block.y) : minimum, MAX_BUILD_Y));
  state.chunks.set(key, entity);

  for (const block of data.blocks) {
    state.blocks.set(voxelKey(block.x, block.y, block.z), block);
    indexBlock(state, block);
  }
  const countryside = template === 'city-ancient' && Math.max(Math.abs(cx * 16 + 8), Math.abs(cz * 16 + 8)) > CITY_CENTER_LIMIT;
  data.animals = countryside ? spawnCountrysideAnimals(world, cx, cz, state.seed) : isMinigameMode(mode) || isCityMode(mode) || template === 'custom' && customWorld?.terrain === 'flat' ? [] : spawnChunkAnimals(world, cx, cz, generated.water, state.seed);
  for (const animal of data.animals) {
    const trader = animal.get(Trader);
    if (!trader?.villager) continue;
    const snapshot = state.traderSnapshots.get(columnKey(trader.homeX, trader.homeZ));
    if (!snapshot) continue;
    animal.set(Trader, { ...snapshot.data });
    animal.get(TraderPosition)!.copy(snapshot.position);
    const mesh = animal.get(TraderMesh)?.value;
    if (mesh) {
      mesh.position.copy(snapshot.position);
      mesh.rotation.y = snapshot.yaw;
    }
  }
  data.fish = isMinigameMode(mode) || isCityMode(mode) || template === 'custom' && customWorld?.terrain === 'flat' ? [] : spawnChunkFish(world, cx, cz, generated.water, state.seed);
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
      if (!horse) continue;
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

export function loadChunkForCamera(world: World, cx: number, cz: number) {
  const state = stateFor(world);
  state.cameraChunk = chunkKey(cx, cz);
  loadChunk(world, cx, cz);
}

export function releaseCameraChunk(world: World) {
  stateFor(world).cameraChunk = null;
}

function unloadChunk(world: World, entity: Entity) {
  const state = stateFor(world);
  const chunk = entity.get(Chunk);
  const data = entity.get(ChunkData);
  if (!chunk || !data || state.cameraChunk === chunkKey(chunk.x, chunk.z)) return;

  for (const block of data.blocks) {
    state.blocks.delete(voxelKey(block.x, block.y, block.z));
    unindexBlock(state, block, false);
    state.tops.delete(columnKey(block.x, block.z));
  }
  const playerEntity = world.queryFirst(Player);
  const mounted = playerEntity?.get(PlayerMount)?.vehicle;
  const playerPosition = playerEntity?.get(PlayerPosition);
  for (const animal of data.animals) {
    const trader = animal.get(Trader);
    if (trader?.villager) {
      const position = animal.get(TraderPosition);
      if (position) state.traderSnapshots.set(columnKey(trader.homeX, trader.homeZ), { data: { ...trader }, position: position.clone(), yaw: animal.get(TraderMesh)?.value?.rotation.y ?? 0 });
    }
    if (trader && !trader.villager) continue;
    if (animal.get(CamelLeash)) continue;
    if (trader) {
      if (animal.isAlive()) animal.destroy();
      continue;
    }
    const position = animal.get(AnimalPosition);
    const nearby = playerPosition && position && position.distanceToSquared(playerPosition) < 48 * 48;
    if (animal !== mounted && !nearby && animal.isAlive()) animal.destroy();
  }
  for (const fish of data.fish) fish.destroy();
  for (const bomb of data.bombs) bomb.destroy();
  for (const sapling of data.saplings) sapling.destroy();
  data.animals = [];
  data.fish = [];
  data.bombs = [];
  data.saplings = [];
  state.chunkCache.set(chunkKey(chunk.x, chunk.z), { blocks: data.blocks, water: data.water });
  if (state.chunkCache.size > 160) state.chunkCache.delete(state.chunkCache.keys().next().value!);
  state.chunks.delete(chunkKey(chunk.x, chunk.z));
  state.depths.delete(chunkKey(chunk.x, chunk.z));
  entity.destroy();
  touchNeighbors(state, chunk.x, chunk.z);
}

export function streamChunks(world: World, x: number, z: number, radius = VIEW_DISTANCE) {
  const state = stateFor(world);
  const centerX = chunkCoordinate(x);
  const centerZ = chunkCoordinate(z);
  const center = `${centerX},${centerZ}:${radius}`;
  const chunkCount = (radius * 2 + 1) ** 2;
  if (state.streamCenter === center && state.chunks.size === chunkCount && state.unloadOrder.length === 0) return;

  batchVoxelEdits(world, () => {
    if (state.streamCenter !== center) {
      state.streamCenter = center;
      state.streamOrder = [];
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          state.streamOrder.push({ x: centerX + dx, z: centerZ + dz });
        }
      }
      state.streamOrder.sort((a, b) =>
        (a.x - centerX) ** 2 + (a.z - centerZ) ** 2 - (b.x - centerX) ** 2 - (b.z - centerZ) ** 2,
      );
      state.unloadOrder = [...world.query(Chunk)].filter((entity) => {
        const chunk = entity.get(Chunk)!;
        return Math.abs(chunk.x - centerX) > radius || Math.abs(chunk.z - centerZ) > radius;
      });
    }

    if (state.chunks.size >= chunkCount && state.unloadOrder.length > 0) {
      const entity = state.unloadOrder.shift()!;
      if (entity.isAlive()) unloadChunk(world, entity);
      return;
    }
    for (const chunk of state.streamOrder) {
      if (state.chunks.has(chunkKey(chunk.x, chunk.z))) continue;
      loadChunk(world, chunk.x, chunk.z);
      break;
    }
  });
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

function isPirateSeabed(block: Voxel) {
  return useGameStore.getState().gameplayMode === 'pirates' && Math.abs(block.x) <= 48 && Math.abs(block.z) <= 48 && (block.kind === BlockKind.Sand && block.y === 2 || isWaterBlock(block.kind) && block.y === 4);
}

export function removeVoxel(world: World, hit: VoxelHit, authoritative = false) {
  if (isPirateSeabed(hit.block)) return;
  if (!authoritative && (hit.block.protected === true || !canEditAt(hit.x, hit.z, 'break'))) return;
  const state = stateFor(world);
  const cx = chunkCoordinate(hit.x);
  const cz = chunkCoordinate(hit.z);
  const chunkEntity = state.chunks.get(chunkKey(cx, cz));
  const data = chunkEntity?.get(ChunkData);
  if (!chunkEntity || !data) return;

  const position = voxelKey(hit.x, hit.y, hit.z);
  clearPaintSplashAt(world, hit.x, hit.y, hit.z);
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
        if (distance <= radius && block.kind !== BlockKind.Bedrock && block.protected !== true && !isPirateSeabed(block) && !(useGameStore.getState().gameplayMode === 'pirates' && block.kind === BlockKind.Chest)) {
          const position = voxelKey(block.x, block.y, block.z);
          clearPaintSplashAt(world, block.x, block.y, block.z);
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

export function setVoxelWaterlogged(world: World, target: Voxel, waterlogged: boolean, authoritative = false) {
  if (!authoritative && !canEditAt(target.x, target.z, 'interact')) return;
  const state = stateFor(world);
  const block = state.blocks.get(voxelKey(target.x, target.y, target.z));
  if (!block || block !== target || waterlogged && !hasWaterOpening(block)) return;
  if (waterlogged) block.waterlogged = true;
  else {
    delete block.waterlogged;
    delete block.floodSource;
  }
  indexBlock(state, block);
  const cx = chunkCoordinate(block.x);
  const cz = chunkCoordinate(block.z);
  editsFor(state, cx, cz).set(voxelKey(block.x, block.y, block.z), blockEdit(block));
  recordVoxelEdit(state, cx, cz, block.x, block.y, block.z);
  return block;
}

export function setVoxelFloodSource(world: World, target: Voxel, floodSource: boolean, authoritative = false) {
  if (!authoritative && !canEditAt(target.x, target.z, 'interact')) return;
  const state = stateFor(world);
  const block = state.blocks.get(voxelKey(target.x, target.y, target.z));
  if (!block || block !== target || !isWaterBlock(block.kind) && !block.waterlogged) return;
  if (floodSource) block.floodSource = true;
  else delete block.floodSource;
  const cx = chunkCoordinate(block.x);
  const cz = chunkCoordinate(block.z);
  editsFor(state, cx, cz).set(voxelKey(block.x, block.y, block.z), blockEdit(block));
  recordVoxelEdit(state, cx, cz, block.x, block.y, block.z);
  return block;
}

export function replaceVoxel(world: World, hit: VoxelHit, kind: BlockKind, open?: boolean, growth?: number, items?: SelectedKind[], facing?: Voxel['facing'], food?: SelectedKind, meat?: import('./animals').AnimalKind, protectedBlock?: boolean, authoritative = false) {
  if (!authoritative && !canEditAt(hit.x, hit.z, 'interact')) return;
  const state = stateFor(world);
  const block = state.blocks.get(voxelKey(hit.x, hit.y, hit.z));
  if (!block) return;
  const wasFire = isFireBlock(block.kind);
  if (block.kind !== kind) clearPaintSplashAt(world, hit.x, hit.y, hit.z);
  block.kind = kind;
  if (open !== undefined) block.open = open;
  if (isCrop(kind)) block.growth = growth ?? block.growth ?? 3;
  else if (isGrassPlate({ kind, growth }) || (isStair(kind) || isSlab(kind)) && growth !== undefined) block.growth = growth;
  else delete block.growth;
  if (isChest(kind)) block.items = items ?? block.items ?? [];
  else delete block.items;
  if (facing !== undefined) block.facing = facing;
  if (!isLadder(kind) && !isDoor(kind) && !isTrapdoor(kind) && !isRail(kind) && !isSign(kind) && !isBed(kind) && !isStair(kind) && !isSlab(kind) && !isPainting(kind) && kind !== BlockKind.TrafficLight && !isTrafficSign(kind)) delete block.facing;
  if (kind !== BlockKind.PaintingCustom && kind !== BlockKind.DrawingPainting) delete block.image;
  if (!isPainting(kind)) delete block.paintingSize;
  if (kind === BlockKind.Food) {
    block.food = food;
    block.meat = meat;
  } else {
    delete block.food;
    delete block.meat;
  }
  if (protectedBlock !== undefined) {
    if (protectedBlock) block.protected = true;
    else delete block.protected;
  }
  if (!hasWaterOpening(block)) delete block.waterlogged;
  if (!isWaterBlock(kind) && !block.waterlogged) delete block.floodSource;
  indexBlock(state, block);
  const cx = chunkCoordinate(hit.x);
  const cz = chunkCoordinate(hit.z);
  const chunkEntity = state.chunks.get(chunkKey(cx, cz));
  if (!chunkEntity) return;
  editsFor(state, cx, cz).set(voxelKey(hit.x, hit.y, hit.z), blockEdit(block));
  recordVoxelEdit(state, cx, cz, hit.x, hit.y, hit.z);
  if (wasFire || isFireBlock(kind)) {
    extinguishFireAt(world, hit.x, hit.y, hit.z);
    if (isFireBlock(kind)) spawnFire(world, block);
  }
}

export function addVoxel(world: World, x: number, y: number, z: number, kind: BlockKind, growth?: number, facing?: Voxel['facing'], fireGeneration = 0, food?: SelectedKind, meat?: import('./animals').AnimalKind, protectedBlock = false, authoritative = false) {
  if (!authoritative && !canEditAt(x, z, 'place', kind)) return;
  const state = stateFor(world);
  const cx = chunkCoordinate(x);
  const cz = chunkCoordinate(z);
  const key = chunkKey(cx, cz);
  if (!state.chunks.has(key)) loadChunk(world, cx, cz);

  const chunkEntity = state.chunks.get(key)!;
  const data = chunkEntity.get(ChunkData)!;
  const position = voxelKey(x, y, z);
  const existing = state.blocks.get(position);
  if (existing && isWaterBlock(kind) && hasWaterOpening(existing)) return setVoxelWaterlogged(world, existing, true, true);
  if (existing && isFireBlock(existing.kind) && isWaterBlock(kind)) extinguishFireAt(world, x, y, z);
  else if (existing && !isWaterBlock(existing.kind)) return;
  if (existing) data.blocks = data.blocks.filter((block) => voxelKey(block.x, block.y, block.z) !== position);
  if (isDoor(kind) && [...state.blocks.values()].some((other) => other.x === x && other.z === z && other.kind === kind)) return;

  const block: Voxel = { x, y, z, kind, ...(protectedBlock ? { protected: true } : {}) };
  if (isCrop(kind) || isGrassPlate({ kind, growth }) || (isStair(kind) || isSlab(kind)) && growth !== undefined) block.growth = growth ?? 3;
  if (isChest(kind)) block.items = [];
  if (isSign(kind)) block.text = kind === BlockKind.ParisStreetSign ? PARIS_STREET_SIGN_TEXT : '';
  if (isLadder(kind) || isDoor(kind) || isTrapdoor(kind) || isRail(kind) || isSign(kind) || isBed(kind) || isStair(kind) || isSlab(kind) || isPainting(kind) || kind === BlockKind.TrafficLight || isTrafficSign(kind)) block.facing = facing ?? (isBed(kind) || isStair(kind) || isSlab(kind) ? 'south' : 'north');
  if (kind === BlockKind.Food) {
    block.food = food;
    block.meat = meat;
  }
  data.blocks.push(block);
  state.blocks.set(position, block);
  indexBlock(state, block);
  editsFor(state, cx, cz).set(position, blockEdit(block));
  recordVoxelEdit(state, cx, cz, x, y, z);
  if (isWaterBlock(kind)) clearPaintSplashAt(world, x, y, z);
  if (isFireBlock(kind)) spawnFire(world, block, fireGeneration);
  return block;
}

export function applyVoxelEdit(world: World, position: string, edit: ChunkEdit, authoritative = false) {
  const [x, y, z] = position.split(',').map(Number);
  const state = stateFor(world);
  if (edit === null) {
    const block = state.blocks.get(position);
    if (block) removeVoxel(world, { block, x, y, z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, authoritative);
    else {
      const cx = chunkCoordinate(x);
      const cz = chunkCoordinate(z);
      editsFor(state, cx, cz).set(position, null);
      recordVoxelEdit(state, cx, cz, x, y, z, true);
    }
    return;
  }
  const data = typeof edit === 'number' ? { kind: edit } : edit;
  const existing = state.blocks.get(position);
  if (existing && isWaterBlock(data.kind) && isTrapdoor(existing.kind) && existing.open !== true) return;
  if (existing && isWaterBlock(data.kind) && hasWaterOpening(existing)) {
    setVoxelWaterlogged(world, existing, true, authoritative);
    setVoxelFloodSource(world, existing, data.floodSource === true, authoritative);
    clearPaintSplashAt(world, x, y, z);
    return;
  }
  const block = existing ?? addVoxel(world, x, y, z, data.kind, data.growth, data.facing, 0, data.food, data.meat, data.protected, authoritative);
  if (block) {
    replaceVoxel(world, { block, x, y, z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, data.kind, data.open, data.growth, data.items, data.facing, data.food, data.meat, data.protected, authoritative);
    if (hasWaterOpening(block) || block.waterlogged) setVoxelWaterlogged(world, block, data.waterlogged === true && hasWaterOpening(block), authoritative);
    if (isWaterBlock(data.kind) || block.waterlogged) setVoxelFloodSource(world, block, data.floodSource === true, authoritative);
    if (typeof data.text === 'string') setVoxelText(world, { x, y, z }, data.text, data.textSize ?? DEFAULT_SIGN_TEXT_SIZE, authoritative);
    if (cleanPaintingImage(data.image)) setVoxelImage(world, { x, y, z }, data.image!, authoritative);
    if (isPainting(data.kind)) setVoxelPaintingSize(world, { x, y, z }, cleanPaintingSize(data.paintingSize), authoritative);
  }
  if (isWaterBlock(data.kind)) clearPaintSplashAt(world, x, y, z);
}

export function applyVoxelEdits(world: World, edits: Array<[string, ChunkEdit]>, authoritative = false) {
  batchVoxelEdits(world, () => {
    for (const [position, edit] of edits) applyVoxelEdit(world, position, edit, authoritative);
  });
}

export function loadLevel(world: World, generation = 0, saved: WorldSave | null = null): LevelData {
  resetBombLauncher();
  clearFires(world);
  for (const entity of [...world.query(Chunk)]) entity.destroy();
  for (const entity of [...world.query(Animal)]) entity.destroy();
  for (const entity of [...world.query(Trader)]) entity.destroy();
  for (const entity of [...world.query(Fish)]) entity.destroy();
  for (const entity of [...world.query(MeatDrop)]) entity.destroy();
  for (const entity of [...world.query(DroppedItem)]) entity.destroy();
  for (const entity of [...world.query(Bomb)]) entity.destroy();
  for (const entity of [...world.query(Explosion)]) entity.destroy();
  for (const entity of [...world.query(Sapling)]) entity.destroy();
  for (const entity of [...world.query(Player)]) entity.destroy();
  for (const entity of [...world.query(BlockTarget)]) entity.destroy();
  for (const entity of [...world.query(Environment)]) entity.destroy();
  for (const entity of [...world.query(Projectile)]) entity.destroy();
  for (const entity of [...world.query(Vehicle)]) entity.destroy();
  for (const entity of [...world.query(Sleep)]) entity.destroy();

  const restore = saved && (saved.version === 1 || saved.version === 2 || saved.version === 3 || saved.version === 4 || saved.version === 5) ? saved : null;
  useEffectStore.getState().reset();
  useSeasonStore.getState().setSeason(isSeason(restore?.season) ? restore.season : 'auto');
  useSeasonStore.getState().setMixedSeasons(restore?.mixedSeasons?.filter(isSeason) ?? []);
  const worldTemplate = restore?.template ?? (restore ? restore.gameplayMode === 'city-ancient' || restore.gameplayMode === 'city-modern' ? restore.gameplayMode : 'nature' : useGameStore.getState().worldTemplate);
  const customWorld = worldTemplate === 'custom' ? (restore ? sanitizeCustomWorld(restore.customWorld) : sanitizeCustomWorld(useGameStore.getState().customWorld)) ?? createCustomWorld(DEFAULT_WORLD_SOURCE, restore?.seed ?? 73421) : null;
  Object.assign(useGameStore.getState(), { worldTemplate, customWorld });
  useProtectionStore.getState().setProtection(restore?.protection ?? (restore ? null : useProtectionStore.getState().protection ?? newProtection()));
  const seed = restore?.seed ?? (useGameStore.getState().worldId === 'main-room' && generation === 0 ? 73421 : [...useGameStore.getState().worldId].reduce((value, letter) => Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0, 2166136261) % 900000 + (worldTemplate === 'custom' ? 0 : generation * 977));
  const edits: WorldChunks['edits'] = restore ? new Map(restore.edits.map(([chunk, values]) => [chunk, new Map(values)])) : new Map();
  worlds.set(world, {
    world,
    seed,
    chunks: new Map(),
    chunkCache: new Map(),
    depths: new Map(),
    blocks: new Map(),
    water: new Map(),
    tops: new Map(),
    edits,
    saddledHorses: restore?.saddledHorses ?? [],
    traderSnapshots: new Map(),
    streamCenter: null,
    cameraChunk: null,
    streamOrder: [],
    unloadOrder: [],
    batchDepth: 0,
    pendingRevisions: new Set(),
  });
  restorePaintStrokes(world, restore?.paint);
  initTaming(world);
  const restorePosition = restore !== null && restore.version >= 2;
  const gameplayMode = restore?.gameplayMode ?? (restore ? 'creative' : useGameStore.getState().gameplayMode);
  if (gameplayMode === 'maze') edits.clear();
  const city = worldTemplate === 'city-ancient' || worldTemplate === 'city-modern';
  const legacyCitySignSpawn = city && restore !== null && Math.hypot(restore.player.x, restore.player.z) < 1;
  const spawn = gameplayMode === 'maze' ? mazePlaygroundSpawn(0) : restore && restorePosition && !legacyCitySignSpawn
    ? { x: restore.player.x, y: restore.player.y, z: restore.player.z }
    : gameplayMode === 'heist' ? { ...HEIST_HIDEOUT } : gameplayMode === 'delivery' ? { ...DELIVERY_START } : gameplayMode === 'skyfall' ? { ...SKYFALL_SPAWN } : gameplayMode === 'planet' ? getPlanetUniverse() === 'zombie' ? { ...ZOMBIE_PLANET_SPAWN } : { ...PLANET_SPAWN } : gameplayMode === 'deep-dive' ? { ...DEEP_SPAWN } : gameplayMode === 'roleplay' ? { ...ROLEPLAY_SPAWN } : gameplayMode === 'pirates' ? worldTemplate === 'fortress' ? pirateFortressSpawn('red') : pirateSpawn('red') : gameplayMode === 'football' ? footballSpawn(null) : gameplayMode === 'battle' ? battleSpawn(null) : city ? { ...CITY_SPAWN } : worldTemplate === 'custom' ? customWorldSpawn(customWorld ?? createCustomWorld(DEFAULT_WORLD_SOURCE, seed), seed) : safeSpawnAt(0, 0, seed);
  world.spawn(
    Player,
    PlayerBody(),
    PlayerCollider(),
    PlayerMesh(),
    PlayerMount(),
    PlayerHealth({ value: gameplayMode === 'creative' ? 10 : restore?.lives ?? 10, max: 10 }),
    PlayerPosition(new Vector3(spawn.x, spawn.y, spawn.z)),
    PlayerVelocity(),
    PlayerState({
      yaw: gameplayMode === 'maze' ? 0 : restore && restorePosition ? restore.player.yaw : Math.atan2(3, 8),
      pitch: gameplayMode === 'maze' ? -0.15 : restore && restorePosition ? restore.player.pitch : -0.15,
      flying: gameplayMode === 'maze' ? false : restore?.player.flying ?? false,
    }),
  );
  world.spawn(BlockTarget(), TargetMesh());
  const environmentEntity = world.spawn(Environment(), RainMaterial(), SnowMaterial());
  if (restore) environmentEntity.get(Environment)!.elapsed = restore.elapsed;
  if (customWorld?.environment?.time) environmentEntity.get(Environment)!.elapsed = customWorld.environment.time === 'night' ? (0.88 - 0.38) * DAY_DURATION : 0;
  const hotbar = restore?.hotbar?.length === 10 && restore.hotbar.every((kind) => kind === null || isSelectedKind(kind))
    ? restore.hotbar.map((kind) => kind === null ? null : normalizePaintballGun(kind))
    : useGameStore.getState().hotbarSlots;
  const inventoryMode = gameplayMode === 'survival' || gameplayMode === 'planet';
  const itemCounts: Record<string, number> = inventoryMode ? { hand: 1, ...normalizePaintballCounts(restore?.itemCounts) } : { ...DEFAULT_ITEM_COUNTS, ...normalizePaintballCounts(restore?.itemCounts) };
  const sports = gameplayMode === 'football' || gameplayMode === 'maze';
  const restoredSelection = sports ? 'hand' : restore && isSelectedKind(restore.selected) ? normalizePaintballGun(restore.selected) : inventoryMode ? 'hand' : BlockKind.Grass;
  const selected = inventoryMode && restoredSelection !== 'hand'
    && (itemCounts[typeof restoredSelection === 'number' ? `block_${restoredSelection}` : restoredSelection] ?? 0) <= 0 ? 'hand' : restoredSelection;
  const hotbarSlots = sports ? ['hand', ...Array(9).fill(null)] as Array<SelectedKind | null> : hotbar.map((kind, index) => !inventoryMode ? kind ?? BlockKind.Grass : index === 0 ? 'hand'
    : kind !== null && kind !== 'hand' && (storedAnimalIdFromSelection(kind) !== null || (itemCounts[typeof kind === 'number' ? `block_${kind}` : kind] ?? 0) > 0) ? kind : null);
  useGameStore.setState({
    gameplayMode,
    worldThumbnail: restore?.thumbnail,
    meat: { ...createMeatInventory(), ...restore?.meat },
    selected,
    selectedSlot: Math.max(0, hotbarSlots.indexOf(selected)),
    hotbarSlots,
    itemCounts,
    equippedArmor: restore?.equippedArmor ?? null,
    riding: null,
    ridingRole: null,
    seatChoice: null,
    bookOpen: false,
    lives: gameplayMode === 'creative' ? 10 : restore?.lives ?? 10,
    apples: restore?.apples ?? 0,
    coins: restore?.coins ?? 0,
    checkpoint: restore?.checkpoint ?? null,
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
  if (gameplayMode === 'pirates') spawnPirateCannons(world);
  for (let index = 0; index < 9; index += 1) streamChunks(world, spawn.x, spawn.z);
  if (gameplayMode === 'deep-dive') for (let cx = -3; cx <= 2; cx += 1) for (let cz = -3; cz <= 2; cz += 1) loadChunk(world, cx, cz);
  for (const animal of customWorld?.spawns ?? []) spawnAnimal(world, animal.kind, animal.x, animal.y, animal.z, seed);
  return { spawn };
}
