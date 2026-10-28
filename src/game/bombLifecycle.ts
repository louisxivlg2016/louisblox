import type { World } from 'koota';
import { Vector3 } from 'three';
import { Bomb, BombPosition } from './traits';

export function spawnBomb(world: World, x: number, y: number, z: number) {
  return world.spawn(Bomb({ fuse: 3 }), BombPosition(new Vector3(x, y, z)));
}
