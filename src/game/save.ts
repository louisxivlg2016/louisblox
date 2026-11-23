import type { World } from 'koota';
import { flushPlaytime } from './profile';
import { useProtectionStore } from './protection';
import { getWorldSeed, onVoxelEdit, snapshotSaddledHorses, snapshotVehicles, snapshotWorldEdits } from './chunks';
import type { WorldSave } from './chunks';
import { useGameStore } from './store';
import { Environment, Player, PlayerHealth, PlayerPosition, PlayerState } from './traits';
import { sanitizeCustomWorld } from './worldCode';
import { translate } from './language';
import { snapshotPaintStrokes } from './paintball';
import { useSeasonStore } from './seasons';
import { useMultiplayerStore } from './multiplayerStore';
import { isMultiplayerOnlyMode } from './worldMode';

const LEGACY_SAVE_KEY = 'louisblox-save-v1';
const WORLDS_KEY = 'louisblox-worlds-v1';
const DEFAULT_WORLD_ID = 'main-room';

export type WorldMeta = { id: string; name: string; gameplayMode: WorldSave['gameplayMode']; multiplayer?: boolean; updatedAt: number };
export const MAX_WORLDS = 20;

export function isMultiplayerWorld(world: Pick<WorldMeta, 'id' | 'gameplayMode' | 'multiplayer'>) {
  return world.multiplayer ?? (world.id.startsWith('salon-') || isMultiplayerOnlyMode(world.gameplayMode ?? 'creative'));
}

export function canCreateWorld(_worldId?: string) {
  return true;
}

function worldKey(worldId: string) {
  return `louisblox-world-${worldId}`;
}

export function readWorldSave(worldId = DEFAULT_WORLD_ID, forLoad = false): WorldSave | null {
  try {
    const raw = localStorage.getItem(worldKey(worldId)) ?? (worldId === DEFAULT_WORLD_ID ? localStorage.getItem(LEGACY_SAVE_KEY) : null);
    if (!raw) {
      if (forLoad) worldRevisions.set(worldId, 0);
      return null;
    }
    const save = JSON.parse(raw) as WorldSave;
    const result = save.version === 1 || save.version === 2 || save.version === 3 || save.version === 4 || save.version === 5 ? { ...save, worldId: save.worldId ?? worldId, customWorld: sanitizeCustomWorld(save.customWorld) ?? undefined, revision: revisionOf(save.revision), savedAt: typeof save.savedAt === 'number' ? save.savedAt : 0 } : null;
    if (forLoad) {
      worldRevisions.set(worldId, result?.revision ?? 0);
      revisionWarningShown = false;
    }
    return result;
  } catch {
    if (forLoad) worldRevisions.set(worldId, 0);
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
    const mainSave = readWorldSave(DEFAULT_WORLD_ID);
    saved.push({ id: DEFAULT_WORLD_ID, name: translate('Monde principal', 'Main World'), gameplayMode: mainSave?.gameplayMode, multiplayer: mainSave?.multiplayer, updatedAt: 0 });
  }
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith('louisblox-world-')) continue;
      const id = key.slice('louisblox-world-'.length);
      if (saved.some((world) => world.id === id)) continue;
      const save = readWorldSave(id);
      if (save) saved.push({ id, name: save.worldName?.trim().slice(0, 80) || id, gameplayMode: save.gameplayMode, multiplayer: save.multiplayer, updatedAt: save.savedAt ?? 0 });
    }
  } catch {
  }
  return saved.sort((a, b) => b.updatedAt - a.updatedAt);
}

let storageWarningShown = false;
let revisionWarningShown = false;
const worldRevisions = new Map<string, number>();

function revisionOf(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function readStoredRevision(worldId: string) {
  try {
    const raw = localStorage.getItem(worldKey(worldId)) ?? (worldId === DEFAULT_WORLD_ID ? localStorage.getItem(LEGACY_SAVE_KEY) : null);
    return raw ? revisionOf((JSON.parse(raw) as WorldSave).revision) : 0;
  } catch {
    return 0;
  }
}

export function writeWorldSave(worldId: string, save: WorldSave, name = worldId): WorldMeta | null {
  if (!canCreateWorld(worldId)) {
    useGameStore.getState().setNotice(translate('Tu as déjà 20 mondes. Supprimes-en un dans Mes mondes pour libérer une place.', 'You already have 20 worlds. Delete one in My Worlds to free a slot.'));
    return null;
  }
  const storedRevision = readStoredRevision(worldId);
  const localRevision = worldRevisions.get(worldId) ?? storedRevision;
  if (storedRevision > localRevision) {
    if (!revisionWarningShown) {
      revisionWarningShown = true;
      useGameStore.getState().setNotice(translate('Ce monde a une version plus récente dans un autre onglet. Rouvre-le pour la charger avant de continuer.', 'A newer version of this world exists in another tab. Reopen it before continuing.', 'Existe una versión más reciente de este mundo en otra pestaña. Vuelve a abrirlo antes de continuar.'));
    }
    return null;
  }
  const revision = localRevision + 1;
  const savedAt = Date.now();
  const metadata: WorldMeta = { id: worldId, name: name.trim().slice(0, 80) || worldId, gameplayMode: save.gameplayMode, multiplayer: save.multiplayer, updatedAt: savedAt };
  try {
    localStorage.setItem(worldKey(worldId), JSON.stringify({ ...save, worldId, worldName: metadata.name, revision, savedAt }));
    worldRevisions.set(worldId, revision);
    const worlds = listWorlds().filter((world) => world.id !== worldId);
    worlds.unshift(metadata);
    localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
    storageWarningShown = false;
    revisionWarningShown = false;
    return metadata;
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      useGameStore.getState().setNotice(translate('Sauvegarde locale impossible. Va dans Mes mondes et clique sur Exporter pour conserver une copie de tes mondes.', 'Unable to save locally. Open My worlds and click Export to keep a copy of your worlds.', 'No se pudo guardar localmente. Abre Mis mundos y haz clic en Exportar para conservar una copia de tus mundos.'));
    }
    return null;
  }
}

export function deleteWorldSave(worldId: string) {
  try {
    localStorage.removeItem(worldKey(worldId));
    worldRevisions.delete(worldId);
    if (worldId === DEFAULT_WORLD_ID) localStorage.removeItem(LEGACY_SAVE_KEY);
    localStorage.setItem(WORLDS_KEY, JSON.stringify(listWorlds().filter((world) => world.id !== worldId)));
    return true;
  } catch {
    return false;
  }
}

type GameSnapshot = ReturnType<typeof useGameStore.getState>;

export function createWorldSave(world: World, store: GameSnapshot = useGameStore.getState()): WorldSave | null {
  const playerEntity = world.queryFirst(Player);
  const environment = world.queryFirst(Environment)?.get(Environment);
  const position = playerEntity?.get(PlayerPosition);
  const state = playerEntity?.get(PlayerState);
  const health = playerEntity?.get(PlayerHealth);
  if (!position || !state || !environment) return null;
  const switchingWorld = store.worldId !== useGameStore.getState().worldId;
  const storedSave = switchingWorld ? readWorldSave(store.worldId) : null;
  const multiplayer = switchingWorld
    ? isMultiplayerWorld({ id: store.worldId, gameplayMode: store.gameplayMode, multiplayer: storedSave?.multiplayer })
    : useMultiplayerStore.getState().enabled;
  return {
    version: 5,
    worldId: store.worldId,
    worldName: store.worldName,
    generation: store.generation,
    gameplayMode: store.gameplayMode,
    multiplayer,
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
    coins: store.coins,
    meat: store.meat,
    elapsed: environment.elapsed,
    edits: snapshotWorldEdits(world),
    protection: useProtectionStore.getState().protection ?? undefined,
    paint: snapshotPaintStrokes(world),
    season: useSeasonStore.getState().season,
    mixedSeasons: useSeasonStore.getState().mixedSeasons,
    checkpoint: store.checkpoint ?? undefined,
  };
}

export function saveWorld(world: World, store: GameSnapshot = useGameStore.getState()) {
  const save = createWorldSave(world, store);
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
    if (saveTimer !== undefined) return;
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      saveWorld(world);
    }, 0);
  };
  useGameStore.subscribe((state, previous) => {
    if (state.generation !== previous.generation) {
      saveWorld(world, previous);
      return;
    }
    if (state.mode !== previous.mode && previous.mode === 'play') {
      saveWorld(world);
      return;
    }
    if (state.selected === previous.selected && state.hotbarSlots === previous.hotbarSlots && state.itemCounts === previous.itemCounts
      && state.equippedArmor === previous.equippedArmor && state.apples === previous.apples && state.coins === previous.coins && state.meat === previous.meat && state.checkpoint === previous.checkpoint) return;
    schedule();
  });
  onVoxelEdit(world, schedule);
  useProtectionStore.subscribe(schedule);
  useSeasonStore.subscribe(schedule);
  window.setInterval(() => {
    if (useGameStore.getState().mode === 'play') saveWorld(world);
  }, 5000);
  window.addEventListener('blur', flush);
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
