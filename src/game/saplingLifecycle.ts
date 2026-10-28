import type { World } from 'koota';
import { Vector3 } from 'three';
import { Sapling, SaplingPosition } from './traits';
import type { BlockKind } from './voxel';

export function spawnSapling(world: World, kind: BlockKind, x: number, y: number, z: number) {
  return world.spawn(Sapling({ kind, age: 0 }), SaplingPosition(new Vector3(x, y, z)));
}
