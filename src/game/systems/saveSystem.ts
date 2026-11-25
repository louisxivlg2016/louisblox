import type { World } from 'koota';
import { createWorldSave, saveWorld } from '../save';
import { Environment } from '../traits';
import { useGameStore } from '../store';
import { getPlanetUniverse, savePlanetUniverseSnapshot } from '../planetUniverse';

export function saveSystem(world: World, delta: number) {
  const environment = world.queryFirst(Environment)?.get(Environment);
  if (!environment) return;

  environment.saveTimer += delta;
  if (environment.saveTimer >= 1) {
    environment.saveTimer = 0;
    saveWorld(world);
    const game = useGameStore.getState();
    if (game.gameplayMode === 'planet') {
      const save = createWorldSave(world, game);
      if (save) savePlanetUniverseSnapshot(game.worldId, getPlanetUniverse(), save);
    }
  }
}
