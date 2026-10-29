import type { World } from 'koota';
import { useGameStore } from '../store';
import { dismount } from '../vehicles';
import { Sleep, Environment, Player, PlayerMount } from '../traits';
import { DAY_DURATION } from './environmentSystem';

export function startSleep(world: World, x: number, y: number, z: number) {
  if (world.queryFirst(Sleep)) return;
  if (world.queryFirst(Player)?.get(PlayerMount)?.vehicle) dismount(world);
  world.spawn(Sleep({ x, y, z }));
  useGameStore.getState().setSleepProgress(0);
  useGameStore.getState().setNotice('');
}

export function sleepSystem(world: World, dt: number) {
  world.query(Sleep).updateEach(([sleep], entity) => {
    sleep.remaining = Math.max(0, sleep.remaining - dt);
    useGameStore.getState().setSleepProgress(1 - sleep.remaining / sleep.total);
    if (sleep.remaining > 0) return;
    const environment = world.queryFirst(Environment)?.get(Environment);
    if (environment) {
      const cycle = Math.floor(environment.elapsed / DAY_DURATION);
      environment.elapsed = (environment.dayProgress >= 0.38 ? cycle + 1 : cycle) * DAY_DURATION;
      environment.dayProgress = 0.38;
      environment.uiTimer = 0;
    }
    entity.destroy();
    useGameStore.getState().setSleepProgress(null);
    useGameStore.getState().setNotice('Le jour se lève.');
  });
}
