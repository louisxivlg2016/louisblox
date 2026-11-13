import type { World } from 'koota';
import { flushPlaytime } from './profile';
import { useProtectionStore } from './protection';
import { getWorldSeed, onVoxelEdit, snapshotSaddledHorses, snapshotVehicles, snapshotWorldEdits } from './chunks';
import type { WorldSave } from './chunks';
import { useGameStore } from './store';
import { isJoinOnlyRoom } from './roomJoin';
import { Environment, Player, PlayerHealth, PlayerPosition, PlayerState } from './traits';
import { sanitizeCustomWorld } from './worldCode';

const LEGACY_SAVE_KEY = 'louisblox-save-v1';
const WORLDS_KEY = 'louisblox-worlds-v1';
const DEFAULT_WORLD_ID = 'main-room';

export type WorldMeta = { id: string; name: string; gameplayMode: WorldSave['gameplayMode']; updatedAt: number };
export const MAX_WORLDS = 20;

export function canCreateWorld(worldId?: string) {
  const worlds = listWorlds();
  return worlds.length < MAX_WORLDS || worldId !== undefined && worlds.some((world) => world.id === worldId);
}

function worldKey(worldId: string) {
  return `louisblox-world-${worldId}`;
}

export function readWorldSave(worldId = DEFAULT_WORLD_ID): WorldSave | null {
  try {
    const raw = localStorage.getItem(worldKey(worldId)) ?? (worldId === DEFAULT_WORLD_ID ? localStorage.getItem(LEGACY_SAVE_KEY) : null);
    if (!raw) return null;
    const save = JSON.parse(raw) as WorldSave;
    return save.version === 1 || save.version === 2 || save.version === 3 || save.version === 4 || save.version === 5 ? { ...save, worldId: save.worldId ?? worldId, customWorld: sanitizeCustomWorld(save.customWorld) ?? undefined } : null;
  } catch {
    return null;
  }
}

export function listWorlds(): WorldMeta[] {
  let saved: WorldMeta[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(WORLDS_KEY) ?? '[]');
    if (Array.isArray(parsed)) saved = parsed.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.updatedAt === 'number');
  } catch {
  }
  if (readWorldSave(DEFAULT_WORLD_ID) && !saved.some((world) => world.id === DEFAULT_WORLD_ID)) {
    saved.push({ id: DEFAULT_WORLD_ID, name: 'Monde principal', gameplayMode: readWorldSave(DEFAULT_WORLD_ID)?.gameplayMode, updatedAt: 0 });
  }
  return saved.sort((a, b) => b.updatedAt - a.updatedAt);
}

let storageWarningShown = false;

export function writeWorldSave(worldId: string, save: WorldSave, name = worldId): WorldMeta | null {
  if (!canCreateWorld(worldId)) {
    useGameStore.getState().setNotice('Tu as déjà 20 mondes. Supprimes-en un dans Mes mondes pour libérer une place.');
    return null;
  }
  const metadata: WorldMeta = { id: worldId, name: name.trim().slice(0, 80) || worldId, gameplayMode: save.gameplayMode, updatedAt: Date.now() };
  try {
    localStorage.setItem(worldKey(worldId), JSON.stringify({ ...save, worldId }));
    const worlds = listWorlds().filter((world) => world.id !== worldId);
    worlds.unshift(metadata);
    localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
    storageWarningShown = false;
    return metadata;
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      useGameStore.getState().setNotice('Sauvegarde locale impossible. Va dans Mes mondes et clique sur Exporter pour conserver une copie de tes mondes.');
    }
    return null;
  }
}

export function deleteWorldSave(worldId: string) {
  try {
    localStorage.removeItem(worldKey(worldId));
    if (worldId === DEFAULT_WORLD_ID) localStorage.removeItem(LEGACY_SAVE_KEY);
    localStorage.setItem(WORLDS_KEY, JSON.stringify(listWorlds().filter((world) => world.id !== worldId)));
    return true;
  } catch {
    return false;
  }
}

export function createWorldSave(world: World): WorldSave | null {
  const playerEntity = world.queryFirst(Player);
  const environment = world.queryFirst(Environment)?.get(Environment);
  const position = playerEntity?.get(PlayerPosition);
  const state = playerEntity?.get(PlayerState);
  const health = playerEntity?.get(PlayerHealth);
  if (!position || !state || !environment) return null;
  const store = useGameStore.getState();
  return {
    version: 5,
    worldId: store.worldId,
    generation: store.generation,
    gameplayMode: store.gameplayMode,
    template: store.worldTemplate,
    customWorld: store.customWorld ?? undefined,
    seed: getWorldSeed(world),
    player: { x: position.x, y: position.y, z: position.z, yaw: state.yaw, pitch: state.pitch, flying: state.flying },
    selected: store.selected,
    lives: health?.value ?? 10,
    hotbar: store.hotbarSlots,
    itemCounts: store.itemCounts,
    equippedArmor: store.equippedArmor,
    vehicles: snapshotVehicles(world),
    saddledHorses: snapshotSaddledHorses(world),
    apples: store.apples,
    meat: store.meat,
    elapsed: environment.elapsed,
    edits: snapshotWorldEdits(world),
    protection: useProtectionStore.getState().protection ?? undefined,
  };
}

export function saveWorld(world: World) {
  const store = useGameStore.getState();
  if (isJoinOnlyRoom(store.worldId)) return false;
  const save = createWorldSave(world);
  if (!save) return false;
  return writeWorldSave(store.worldId, save, store.worldName || store.worldId) !== null;
}

export function initPersistence(world: World) {
  let saveTimer: number | undefined;
  const flush = () => {
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    saveTimer = undefined;
    saveWorld(world);
    flushPlaytime();
  };
  const schedule = () => {
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      saveWorld(world);
    }, 100);
  };
  useGameStore.subscribe((state, previous) => {
    if (state.selected === previous.selected && state.hotbarSlots === previous.hotbarSlots && state.itemCounts === previous.itemCounts
      && state.equippedArmor === previous.equippedArmor && state.apples === previous.apples && state.meat === previous.meat) return;
    schedule();
  });
  onVoxelEdit(world, schedule);
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
