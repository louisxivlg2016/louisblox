import type { World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex } from './chunks';
import { raycastVoxel } from './voxel';

const origin = new Vector3();
const direction = new Vector3();

export function canSeePlayer(world: World, position: Vector3, player: Vector3) {
  origin.copy(position);
  origin.y += 1.1;
  direction.copy(player).sub(origin);
  const distance = direction.length();
  if (distance > 16 || distance < 0.001) return false;
  direction.normalize();
  const obstruction = raycastVoxel(getBlockIndex(world), origin, direction, distance);
  return !obstruction || obstruction.distance > distance - 0.75;
}
