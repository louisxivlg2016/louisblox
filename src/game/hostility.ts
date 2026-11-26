import type { World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex } from './chunks';
import { raycastVoxel } from './voxel';

const origin = new Vector3();
const direction = new Vector3();

export function canSeePlayer(world: World, position: Vector3, player: Vector3, maxDistance = 10) {
  origin.copy(position);
  origin.y += 1.1;
  direction.copy(player);
  direction.y += 0.9;
  direction.sub(origin);
  const distance = direction.length();
  if (distance > maxDistance || distance < 0.001) return false;
  direction.normalize();
  const obstruction = raycastVoxel(getBlockIndex(world), origin, direction, distance);
  return !obstruction || obstruction.distance > distance - 0.75;
}

export function canZombieAttackPlayer(world: World, position: Vector3, player: Vector3, displayYaw: number) {
  const playerYaw = Math.atan2(player.x - position.x, player.z - position.z);
  if (Math.cos(playerYaw - displayYaw) < 0.35) return false;
  return canSeePlayer(world, position, player, 1.35);
}
