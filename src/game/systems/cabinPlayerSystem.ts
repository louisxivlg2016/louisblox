import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { getTouchMovement, isDown } from '../input';
import { PlayerBody, PlayerCollider, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity, VehicleMotion } from '../traits';
import { CABINS, canWalkInVehicle, isAnimalMount } from '../vehicleTypes';
import { seatOffset, vehicleLocalPosition } from '../vehicles';
import { moveVoxelCharacter } from './collisionSystem';
import type { Voxel } from '../voxel';

const emptyBlocks = new Map<string, Voxel>();

export function moveCabinPlayer(world: World, entity: Entity, dt: number, yaw: number, pitch: number) {
  const mount = entity.get(PlayerMount);
  const vehicle = mount?.vehicle;
  const kind = mount?.kind;
  const role = mount?.role ?? 'driver';
  if (!mount || !vehicle || !kind || isAnimalMount(kind) || !canWalkInVehicle(kind, role)) return false;
  const cabin = CABINS[kind]!;
  const position = entity.get(PlayerPosition);
  const state = entity.get(PlayerState);
  const velocity = entity.get(PlayerVelocity);
  if (!position || !state || !velocity) return false;
  const local = mount.cabinPosition ?? new Vector3(...seatOffset(kind, role, mount.seat));
  local.x = Math.max(-cabin.halfWidth + 0.36, Math.min(cabin.halfWidth - 0.36, local.x));
  local.y = Math.max(cabin.floor + 0.001, local.y);
  local.z = Math.max(cabin.front + 0.36, Math.min(cabin.rear - 0.36, local.z));
  const touch = getTouchMovement();
  const forward = Math.max(-1, Math.min(1, Number(isDown('KeyW') || isDown('ArrowUp')) - Number(isDown('KeyS') || isDown('ArrowDown')) - touch.y));
  const strafe = Math.max(-1, Math.min(1, Number(isDown('KeyD') || isDown('ArrowRight')) - Number(isDown('KeyA') || isDown('ArrowLeft')) + touch.x));
  const length = Math.max(1, Math.hypot(forward, strafe));
  const vehicleYaw = vehicle.get(VehicleMotion)?.yaw ?? 0;
  const lookYaw = yaw - vehicleYaw;
  const speed = 4.8;
  const x = (-Math.sin(lookYaw) * forward / length + Math.cos(lookYaw) * strafe / length) * speed;
  const z = (-Math.cos(lookYaw) * forward / length - Math.sin(lookYaw) * strafe / length) * speed;
  const y = state.grounded && isDown('Space') ? 7.2 : Math.max(-22, velocity.y - 24 * dt);
  const next = local.clone();
  const movement = moveVoxelCharacter(emptyBlocks, next, { x: x * dt, y: y * dt, z: z * dt }, false, cabin);
  if (movement.grounded && velocity.y <= 0) velocity.y = -0.1;
  else velocity.y = y;
  mount.cabinPosition = next;
  position.copy(vehicleLocalPosition(vehicle, next));
  velocity.x = x * Math.cos(vehicleYaw) + z * Math.sin(vehicleYaw);
  velocity.z = -x * Math.sin(vehicleYaw) + z * Math.cos(vehicleYaw);
  entity.get(PlayerBody)?.value?.setNextKinematicTranslation(position);
  entity.get(PlayerCollider)?.value?.setEnabled(true);
  entity.set(PlayerState, { grounded: movement.grounded, flying: false, yaw, pitch });
  return true;
}
