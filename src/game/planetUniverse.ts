import type { WorldSave } from './chunks';

export type PlanetUniverse = 'home' | 'zombie';
type PendingTravel = { worldId: string; universe: PlanetUniverse; save: WorldSave };

let universe: PlanetUniverse = 'home';
let loadedWorldId = '';
let pendingTravel: PendingTravel | null = null;

export function getPlanetUniverse() {
  return universe;
}

export function setPlanetUniverse(next: PlanetUniverse, worldId?: string) {
  universe = next;
  if (worldId !== undefined) loadedWorldId = worldId;
}

export function ensurePlanetUniverse(worldId: string) {
  if (loadedWorldId === worldId) return;
  universe = 'home';
  try {
    const progress = JSON.parse(localStorage.getItem(`louisblox-planet-progress-${worldId}`) ?? 'null');
    universe = progress?.universe === 'zombie' ? 'zombie' : 'home';
  } catch {
    universe = 'home';
  }
  loadedWorldId = worldId;
}

const universeSaveKey = (worldId: string, destination: PlanetUniverse) => `louisblox-planet-universe-${worldId}-${destination}`;

export function savePlanetUniverseSnapshot(worldId: string, destination: PlanetUniverse, save: WorldSave) {
  try {
    localStorage.setItem(universeSaveKey(worldId, destination), JSON.stringify(save));
  } catch {
  }
}

export function readPlanetUniverseSnapshot(worldId: string, destination: PlanetUniverse): WorldSave | null {
  try {
    const save = JSON.parse(localStorage.getItem(universeSaveKey(worldId, destination)) ?? 'null');
    return save && (save.version === 1 || save.version === 2 || save.version === 3 || save.version === 4 || save.version === 5) ? save : null;
  } catch {
    return null;
  }
}

export function setPendingPlanetTravel(worldId: string, destination: PlanetUniverse, save: WorldSave) {
  pendingTravel = { worldId, universe: destination, save };
}

export function consumePendingPlanetTravel(worldId: string) {
  if (!pendingTravel || pendingTravel.worldId !== worldId || pendingTravel.universe !== universe) return null;
  const save = pendingTravel.save;
  pendingTravel = null;
  return save;
}
