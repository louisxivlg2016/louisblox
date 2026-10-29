import type { World } from 'koota';
import { getWorldSeed, snapshotSaddledHorses, snapshotVehicles, snapshotWorldEdits } from './chunks';
import type { WorldSave } from './chunks';
import { useGameStore } from './store';
import { Environment, Player, PlayerHealth, PlayerPosition, PlayerState } from './traits';

const SAVE_KEY = 'louisblox-save-v1';

export function readWorldSave(): WorldSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as WorldSave;
    return save.version === 1 || save.version === 2 || save.version === 3 ? save : null;
  } catch {
    return null;
  }
}

export function saveWorld(world: World) {
  const playerEntity = world.queryFirst(Player);
  const environment = world.queryFirst(Environment)?.get(Environment);
  const position = playerEntity?.get(PlayerPosition);
  const state = playerEntity?.get(PlayerState);
  const health = playerEntity?.get(PlayerHealth);
  if (!position || !state || !environment) return;
  const store = useGameStore.getState();
  const save: WorldSave = {
    version: 3,
    generation: store.generation,
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
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    return;
  }
}

export function initPersistence(world: World) {
  window.addEventListener('pagehide', () => saveWorld(world));
}
