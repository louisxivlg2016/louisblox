import type { World } from 'koota';
import { consumeFlightToggle, consumeLook, getEdgeLook, getTouchMovement, isDown } from '../input';
import { getBlockIndex } from '../chunks';
import { MIN_WORLD_Y } from '../levels';
import { useGameStore } from '../store';
import { getSwimState, swimVerticalVelocity } from '../swimming';
import { dismount, vehicleSeatPosition } from '../vehicles';
import { isLadder } from '../extraBlocks';
import { BlockKind, voxelKey } from '../voxel';
import { AnimalPosition, Player, PlayerBody, PlayerCollider, PlayerHealth, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity, Sleep } from '../traits';
import { moveVoxelCharacter } from './collisionSystem';

const GRAVITY = 24;
const JUMP_SPEED = 8.4;
const FLY_SPEED = 5.5;

export function playerSystem(world: World, dt: number, spawn: { x: number; y: number; z: number }) {
  const entity = world.queryFirst(Player);
  if (!entity) return;
  const body = entity.get(PlayerBody)?.value;
  const collider = entity.get(PlayerCollider)?.value;
  const position = entity.get(PlayerPosition);
  const velocity = entity.get(PlayerVelocity);
  const state = entity.get(PlayerState);
  const health = entity.get(PlayerHealth);
  if (!body || !collider || !position || !velocity || !state) return;

  const sleep = world.queryFirst(Sleep)?.get(Sleep);
  if (sleep) {
    consumeLook();
    consumeFlightToggle();
    position.set(sleep.x, sleep.y + 0.58, sleep.z);
    body.setNextKinematicTranslation(position);
    velocity.set(0, 0, 0);
    entity.set(PlayerState, { grounded: true, flying: false });
    updateHud(world, position, health, false, dt);
    return;
  }

  const mouse = consumeLook();
  const edge = getEdgeLook();
  const yaw = state.yaw - mouse.x * 0.004 - edge.x * dt * 3.2;
  const pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, state.pitch - mouse.y * 0.004 - edge.y * dt * 3.2));
  const flying = consumeFlightToggle() % 2 === 1 ? !state.flying : state.flying;
  if (health && health.value <= 0 && entity.get(PlayerMount)?.vehicle) dismount(world);

  const mount = entity.get(PlayerMount);
  if (mount?.vehicle) {
    if (mount.kind === 'horse') {
      const vehiclePosition = mount.vehicle.get(AnimalPosition);
      if (vehiclePosition) position.set(vehiclePosition.x, vehiclePosition.y + 1.05, vehiclePosition.z);
    } else if (mount.kind) {
      position.copy(vehicleSeatPosition(mount.vehicle, mount.kind, mount.role, mount.seat));
    }
    body.setNextKinematicTranslation(position);
    velocity.set(0, 0, 0);
    entity.set(PlayerState, { grounded: true, flying: false, yaw, pitch });
    updateHud(world, position, health, false, dt);
    return;
  }

  const touch = getTouchMovement();
  const keyboardForward = Number(isDown('KeyW') || isDown('ArrowUp')) - Number(isDown('KeyS') || isDown('ArrowDown'));
  const keyboardStrafe = Number(isDown('KeyD') || isDown('ArrowRight')) - Number(isDown('KeyA') || isDown('ArrowLeft'));
  const forward = Math.max(-1, Math.min(1, keyboardForward - touch.y));
  const strafe = Math.max(-1, Math.min(1, keyboardStrafe + touch.x));
  const length = Math.max(1, Math.hypot(forward, strafe));
  const shifting = isDown('ShiftLeft') || isDown('ShiftRight');
  const blocks = getBlockIndex(world);
  const swimming = getSwimState(blocks, position);
  const inWater = !flying && swimming.inWater;
  const ladderAt = (y: number) => blocks.get(voxelKey(Math.round(position.x), Math.round(y), Math.round(position.z)))?.kind === BlockKind.Ladder;
  const onLadder = !flying && (ladderAt(position.y) || ladderAt(position.y + 0.75) || ladderAt(position.y + 1.5));
  const speed = (flying ? (shifting ? 11.5 : 6.5) : shifting ? 7.4 : 4.8) * (inWater ? 0.65 : 1);
  const normalizedForward = forward / length;
  const normalizedStrafe = strafe / length;
  velocity.x = (-Math.sin(yaw) * normalizedForward + Math.cos(yaw) * normalizedStrafe) * speed;
  velocity.z = (-Math.cos(yaw) * normalizedForward - Math.sin(yaw) * normalizedStrafe) * speed;

  if (flying) velocity.y = (Number(isDown('Space')) - Number(isDown('KeyC'))) * FLY_SPEED;
  else if (onLadder) velocity.y = isDown('Space') ? 3.8 : isDown('KeyC') ? -2.8 : Math.max(velocity.y, -0.8);
  else if (inWater) velocity.y = swimVerticalVelocity(swimming, velocity.y, isDown('KeyC'), isDown('Space'), position.y);
  else if (state.grounded && isDown('Space')) velocity.y = JUMP_SPEED;
  else velocity.y -= GRAVITY * dt;

  const next = { ...position };
  const movement = moveVoxelCharacter(blocks, next, {
    x: velocity.x * dt,
    y: velocity.y * dt,
    z: velocity.z * dt,
  }, state.grounded && !flying && !inWater && !onLadder);
  const grounded = movement.grounded;
  const nextFlying = flying && grounded && isDown('KeyC') ? false : flying;
  if (movement.stepped) velocity.y = 0;
  else {
    if (grounded && velocity.y < 0) velocity.y = -0.1;
    if (movement.hitCeiling) velocity.y = 0;
  }

  const invalidPosition = next.y < MIN_WORLD_Y - 12 || !Number.isFinite(next.x + next.y + next.z);
  if (invalidPosition) {
    next.x = spawn.x;
    next.y = spawn.y;
    next.z = spawn.z;
  }
  if (health && health.value <= 0) {
    if (!invalidPosition) {
      next.x = position.x;
      next.y = position.y;
      next.z = position.z;
    }
    velocity.set(0, 0, 0);
    entity.set(PlayerHealth, { value: health.max, absorbed: 0 });
  } else if (invalidPosition) {
    velocity.set(0, 0, 0);
  }
  body.setNextKinematicTranslation(next);
  position.set(next.x, next.y, next.z);
  entity.set(PlayerState, { grounded, flying: nextFlying, yaw, pitch });
  updateHud(world, next, health, nextFlying, dt);
}

const hudClocks = new WeakMap<World, number>();

function updateHud(world: World, position: { x: number; y: number; z: number }, health: { value: number } | undefined, flying: boolean, dt: number) {
  const hud = useGameStore.getState();
  if (health && hud.lives !== health.value) hud.setLives(health.value);
  if (hud.flying !== flying) hud.setFlying(flying);
  const remaining = (hudClocks.get(world) ?? 0) - dt;
  if (remaining > 0) {
    hudClocks.set(world, remaining);
    return;
  }
  hudClocks.set(world, 0.1);
  const coordinates = { x: Math.round(position.x * 100) / 100, y: Math.round(position.y * 100) / 100, z: Math.round(position.z * 100) / 100 };
  if (hud.coordinates.x !== coordinates.x || hud.coordinates.y !== coordinates.y || hud.coordinates.z !== coordinates.z) hud.setCoordinates(coordinates);
}
