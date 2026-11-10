import type { Vector3 } from 'three';
import { isDoor, isTrapdoor } from './extraBlocks';
import { isWaterBlock, voxelKey } from './voxel';
import type { Voxel, VoxelHit } from './voxel';

const axes = ['x', 'y', 'z'] as const;

function surfaceHit(block: Voxel, origin: Vector3, direction: Vector3) {
  let entry = 0;
  let exit = Infinity;
  let normal = { x: 0, y: 0, z: 0 };
  for (const axis of axes) {
    const half = 0.3;
    const nearSign = direction[axis] > 0 ? -1 : 1;
    if (Math.abs(direction[axis]) < 0.000001) {
      if (Math.abs(origin[axis] - block[axis]) > half) return null;
      continue;
    }
    let near = (block[axis] - half - origin[axis]) / direction[axis];
    let far = (block[axis] + half - origin[axis]) / direction[axis];
    if (near > far) [near, far] = [far, near];
    if (near > entry) {
      entry = near;
      normal = { x: 0, y: 0, z: 0 };
      normal[axis] = nearSign;
    }
    exit = Math.min(exit, far);
    if (entry > exit) return null;
  }
  return { distance: entry, normal };
}

export function raycastPaintSurface(blocks: ReadonlyMap<string, Voxel>, origin: Vector3, direction: Vector3, maxDistance = 60): VoxelHit | null {
  let x = Math.floor(origin.x + 0.5);
  let y = Math.floor(origin.y + 0.5);
  let z = Math.floor(origin.z + 0.5);
  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);
  const deltaX = stepX === 0 ? Infinity : Math.abs(1 / direction.x);
  const deltaY = stepY === 0 ? Infinity : Math.abs(1 / direction.y);
  const deltaZ = stepZ === 0 ? Infinity : Math.abs(1 / direction.z);
  let maxX = stepX === 0 ? Infinity : (x + stepX * 0.5 - origin.x) / direction.x;
  let maxY = stepY === 0 ? Infinity : (y + stepY * 0.5 - origin.y) / direction.y;
  let maxZ = stepZ === 0 ? Infinity : (z + stepZ * 0.5 - origin.z) / direction.z;
  let distance = 0;

  for (let steps = 0; steps < 128 && distance <= maxDistance; steps += 1) {
    const block = blocks.get(voxelKey(x, y, z));
    if (block !== undefined && !isWaterBlock(block.kind) && (!block.open || isDoor(block.kind) || isTrapdoor(block.kind))) {
      const hit = surfaceHit(block, origin, direction);
      if (hit && hit.distance <= maxDistance) return { block, x, y, z, ...hit };
    }
    if (maxX <= maxY && maxX <= maxZ) {
      x += stepX;
      distance = maxX;
      maxX += deltaX;
    } else if (maxY <= maxZ) {
      y += stepY;
      distance = maxY;
      maxY += deltaY;
    } else {
      z += stepZ;
      distance = maxZ;
      maxZ += deltaZ;
    }
  }
  return null;
}
