import type { World } from 'koota';
import { flushPlaytime } from './profile';
import { useProtectionStore } from './protection';
import { getWorldSeed, snapshotSaddledHorses, snapshotVehicles, snapshotWorldEdits } from './chunks';
import type { WorldSave } from './chunks';
import { useGameStore } from './store';
import { Environment, Player, PlayerHealth, PlayerPosition, PlayerState } from './traits';

const LEGACY_SAVE_KEY = 'louisblox-save-v1';
const WORLDS_KEY = 'louisblox-worlds-v1';
const DEFAULT_WORLD_ID = 'main-room';

export type WorldMeta = { id: string; name: string; gameplayMode: WorldSave['gameplayMode']; updatedAt: number };

function worldKey(worldId: string) {
  return `louisblox-world-${worldId}`;
}

export function readWorldSave(worldId = DEFAULT_WORLD_ID): WorldSave | null {
  try {
    const raw = localStorage.getItem(worldKey(worldId)) ?? (worldId === DEFAULT_WORLD_ID ? localStorage.getItem(LEGACY_SAVE_KEY) : null);
    if (!raw) return null;
    const save = JSON.parse(raw) as WorldSave;
    return save.version === 1 || save.version === 2 || save.version === 3 || save.version === 4 || save.version === 5 ? { ...save, worldId: save.worldId ?? worldId } : null;
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
  const save = createWorldSave(world);
  if (!save) return;
  const store = useGameStore.getState();
  try {
    localStorage.setItem(worldKey(store.worldId), JSON.stringify(save));
    const worlds = listWorlds().filter((world) => world.id !== store.worldId);
    worlds.unshift({ id: store.worldId, name: store.worldName || store.worldId, gameplayMode: store.gameplayMode, updatedAt: Date.now() });
    localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
  } catch {
    return;
  }
}

export function initPersistence(world: World) {
  let saveTimer: number | undefined;
  const flush = () => {
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    saveTimer = undefined;
    saveWorld(world);
    flushPlaytime();
  };
  useGameStore.subscribe((state, previous) => {
    if (state.selected === previous.selected && state.hotbarSlots === previous.hotbarSlots && state.itemCounts === previous.itemCounts
      && state.equippedArmor === previous.equippedArmor && state.apples === previous.apples && state.meat === previous.meat) return;
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      saveWorld(world);
    }, 200);
  });
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
