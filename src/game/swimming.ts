import type { Vector3 } from 'three';
import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';

export type SwimState = { inWater: boolean; underwater: boolean; surface: number };

export function waterAt(blocks: Map<string, Voxel>, x: number, y: number, z: number) {
  return blocks.get(voxelKey(Math.floor(x + 0.5), Math.floor(y + 0.5), Math.floor(z + 0.5)))?.kind === BlockKind.Water;
}

export function getSwimState(blocks: Map<string, Voxel>, position: Vector3): SwimState {
  const inWater = waterAt(blocks, position.x, position.y + 0.45, position.z)
    || waterAt(blocks, position.x, position.y + 1.3, position.z);
  let surface = position.y + 1.5;
  if (inWater) {
    for (let y = Math.floor(position.y + 1.5); y <= Math.floor(position.y + 5); y += 1) {
      if (waterAt(blocks, position.x, y, position.z)) surface = y + 0.5;
      else if (y > position.y + 1.5) break;
    }
  }
  return { inWater, underwater: waterAt(blocks, position.x, position.y + 1.62, position.z), surface };
}

export function swimVerticalVelocity(state: SwimState, velocityY: number, dive: boolean, jump: boolean, feetY: number) {
  if (dive) return -3;
  if (jump) return 4;
  if (state.underwater) return Math.max(velocityY, 3.5);
  const distanceToFloat = state.surface - 1.4 - feetY;
  return Math.max(-1.2, Math.min(2.4, distanceToFloat * 5 + velocityY * 0.15));
}
