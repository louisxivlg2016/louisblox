import type { World } from 'koota';
import { saveWorld } from '../save';
import { Environment } from '../traits';

export function saveSystem(world: World, delta: number) {
  const environment = world.queryFirst(Environment)?.get(Environment);
  if (!environment) return;

  environment.saveTimer += delta;
  if (environment.saveTimer >= 5) {
    environment.saveTimer = 0;
    saveWorld(world);
  }
}
