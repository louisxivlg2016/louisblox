import type { World } from 'koota';
import { batchVoxelEdits, getBlockIndex, isChunkLoaded, removeVoxel, setVoxelWaterlogged } from '../chunks';
import { MIN_WORLD_Y } from '../levels';
import { isWaterBlock, voxelKey } from '../voxel';
import type { Voxel, VoxelHit } from '../voxel';

const directions = [
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

export function drainConnectedWater(world: World, hit: VoxelHit) {
  const blocks = getBlockIndex(world);
  const water: Voxel[] = [hit.block];
  const visited = new Set([voxelKey(hit.x, hit.y, hit.z)]);
  for (let index = 0; index < water.length; index += 1) {
    const source = water[index];
    for (const [dx, dy, dz] of [...directions, [0, 1, 0]] as const) {
      const x = source.x + dx;
      const y = source.y + dy;
      const z = source.z + dz;
      if (y < MIN_WORLD_Y || !isChunkLoaded(world, x, z)) continue;
      const key = voxelKey(x, y, z);
      if (visited.has(key)) continue;
      const block = blocks.get(key);
      if (!isWaterBlock(block?.kind) && block?.waterlogged !== true) continue;
      visited.add(key);
      water.push(block!);
    }
  }
  let drained = 0;
  batchVoxelEdits(world, () => {
    for (const block of water) {
      const key = voxelKey(block.x, block.y, block.z);
      if (blocks.get(key) !== block) continue;
      if (block.waterlogged) {
        setVoxelWaterlogged(world, block, false);
        if (!block.waterlogged) drained += 1;
      } else if (isWaterBlock(block.kind)) {
        removeVoxel(world, { block, x: block.x, y: block.y, z: block.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 });
        if (!blocks.has(key)) drained += 1;
      }
    }
  });
  return drained;
}

export function waterSystem(_world: World, _dt: number) {}
