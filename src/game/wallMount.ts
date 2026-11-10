import type { Voxel } from './voxel';
import { BlockKind, voxelKey } from './voxel';
import { isCollidable } from './systems/collisionSystem';

export function wallMount(blocks: ReadonlyMap<string, Voxel>, block: Voxel, rotation: number) {
  const front = blocks.get(voxelKey(block.x + Math.round(Math.sin(rotation)), block.y, block.z + Math.round(Math.cos(rotation))));
  if (!isCollidable(front)) return { rotation, offset: 0, mounted: false };
  const reverse = rotation + Math.PI;
  const back = blocks.get(voxelKey(block.x + Math.round(Math.sin(reverse)), block.y, block.z + Math.round(Math.cos(reverse))));
  if (isCollidable(back)) return { rotation, offset: 0, mounted: false };
  const offset = block.kind === BlockKind.ParisStreetSign ? 0.482 : block.kind === BlockKind.Sign ? 0.464 : 0.32;
  return { rotation: reverse, offset, mounted: true };
}
