import type { World } from 'koota';
import { Environment } from './traits';

export const DAY_DURATION = 20 * 60;

export function dayProgressAt(elapsed: number) {
  return (0.38 + elapsed / DAY_DURATION) % 1;
}

export function isNightProgress(progress: number) {
  return progress >= 0.75 || progress < 0.22;
}

export function isNight(world: World) {
  const environment = world.queryFirst(Environment)?.get(Environment);
  return isNightProgress(dayProgressAt(environment?.elapsed ?? 0));
}

export function nightIndex(world: World) {
  const environment = world.queryFirst(Environment)?.get(Environment);
  return Math.floor(0.38 + (environment?.elapsed ?? 0) / DAY_DURATION - 0.22);
}
