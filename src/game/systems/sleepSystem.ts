import type { World } from 'koota';
import type { Voxel } from '../voxel';
import { useGameStore } from '../store';
import { dismount } from '../vehicles';
import { facingYaw } from '../extraBlocks';
import { Sleep, Environment, Player, PlayerMount } from '../traits';
import { DAY_DURATION } from './environmentSystem';

export function startSleep(world: World, x: number, y: number, z: number, facing?: Voxel['facing']) {
  if (world.queryFirst(Sleep)) return;
  if (world.queryFirst(Player)?.get(PlayerMount)?.vehicle) dismount(world);
  world.spawn(Sleep({ x, y, z, yaw: facingYaw(facing) }));
  useGameStore.getState().setSleepProgress(0);
  useGameStore.getState().setNotice('');
}

export function sleepSystem(world: World, dt: number) {
  world.query(Sleep).updateEach(([sleep], entity) => {
    sleep.remaining = Math.max(0, sleep.remaining - dt);
    useGameStore.getState().setSleepProgress(1 - sleep.remaining / sleep.total);
    if (sleep.remaining > 0) return;
    const environment = world.queryFirst(Environment)?.get(Environment);
    const morning = environment !== undefined && environment.dayProgress >= 0.22 && environment.dayProgress < 0.5;
    if (environment) {
      const cycle = Math.floor(environment.elapsed / DAY_DURATION);
      environment.elapsed = morning ? (cycle + 0.5) * DAY_DURATION : (environment.dayProgress >= 0.38 ? cycle + 1 : cycle) * DAY_DURATION;
      environment.dayProgress = morning ? 0.88 : 0.38;
      environment.uiTimer = 0;
    }
    entity.destroy();
    useGameStore.getState().setSleepProgress(null);
    useGameStore.getState().setNotice(morning ? 'La nuit tombe.' : 'Le jour se lève.');
  });
}
