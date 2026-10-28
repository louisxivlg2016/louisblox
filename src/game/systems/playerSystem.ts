import type { World } from 'koota';
import type { useRapier } from '@react-three/rapier';
import { consumeFlightToggle, consumeLook, getEdgeLook, getTouchMovement, isDown } from '../input';
import { MIN_WORLD_Y } from '../levels';
import { useGameStore } from '../store';
import { Player, PlayerBody, PlayerCollider, PlayerPosition, PlayerState, PlayerVelocity } from '../traits';

type RapierWorld = ReturnType<typeof useRapier>['world'];
export type CharacterController = ReturnType<RapierWorld['createCharacterController']>;

const GRAVITY = 24;
const JUMP_SPEED = 8.4;
const FLY_SPEED = 5.5;

export function playerSystem(
  world: World,
  dt: number,
  physicsWorld: RapierWorld,
  controller: CharacterController,
  spawn: { x: number; y: number; z: number },
) {
  const entity = world.queryFirst(Player);
  if (!entity) return;

  const body = entity.get(PlayerBody)?.value;
  const collider = entity.get(PlayerCollider)?.value;
  const position = entity.get(PlayerPosition);
  const velocity = entity.get(PlayerVelocity);
  const state = entity.get(PlayerState);
  if (!body || !collider || !position || !velocity || !state) return;

  const mouse = consumeLook();
  const edge = getEdgeLook();
  const yaw = state.yaw - mouse.x * 0.0021 - edge.x * dt * 2.2;
  const pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, state.pitch - mouse.y * 0.0021 - edge.y * dt * 2.2));

  const flying = consumeFlightToggle() % 2 === 1 ? !state.flying : state.flying;
  const touch = getTouchMovement();
  const keyboardForward = Number(isDown('KeyW') || isDown('ArrowUp')) - Number(isDown('KeyS') || isDown('ArrowDown'));
  const keyboardStrafe = Number(isDown('KeyD') || isDown('ArrowRight')) - Number(isDown('KeyA') || isDown('ArrowLeft'));
  const forward = Math.max(-1, Math.min(1, keyboardForward - touch.y));
  const strafe = Math.max(-1, Math.min(1, keyboardStrafe + touch.x));
  const length = Math.max(1, Math.hypot(forward, strafe));
  const shifting = isDown('ShiftLeft') || isDown('ShiftRight');
  const speed = flying ? (shifting ? 11.5 : 6.5) : shifting ? 7.4 : 4.8;
  const normalizedForward = forward / length;
  const normalizedStrafe = strafe / length;

  velocity.x = (-Math.sin(yaw) * normalizedForward + Math.cos(yaw) * normalizedStrafe) * speed;
  velocity.z = (-Math.cos(yaw) * normalizedForward - Math.sin(yaw) * normalizedStrafe) * speed;

  if (flying) velocity.y = (Number(isDown('Space')) - Number(isDown('KeyC'))) * FLY_SPEED;
  else if (state.grounded && isDown('Space')) velocity.y = JUMP_SPEED;
  else velocity.y -= GRAVITY * dt;

  controller.computeColliderMovement(collider, {
    x: velocity.x * dt,
    y: velocity.y * dt,
    z: velocity.z * dt,
  });

  const movement = controller.computedMovement();
  const current = body.translation();
  const next = {
    x: current.x + movement.x,
    y: current.y + movement.y,
    z: current.z + movement.z,
  };
  const grounded = controller.computedGrounded();
  const landedWithDescent = flying && grounded && isDown('KeyC');
  const nextFlying = landedWithDescent ? false : flying;

  if (grounded && velocity.y < 0) velocity.y = -0.1;
  if (movement.y > velocity.y * dt + 0.001) velocity.y = 0;

  if (next.y < MIN_WORLD_Y - 12) {
    next.x = spawn.x;
    next.y = spawn.y;
    next.z = spawn.z;
    velocity.set(0, 0, 0);
  }

  if (!Number.isFinite(next.x + next.y + next.z)) {
    next.x = spawn.x;
    next.y = spawn.y;
    next.z = spawn.z;
    velocity.set(0, 0, 0);
  }

  body.setNextKinematicTranslation(next);
  position.set(next.x, next.y, next.z);
  entity.set(PlayerState, { grounded, flying: nextFlying, yaw, pitch });

  const coordinates = {
    x: Math.round(next.x * 100) / 100,
    y: Math.round(next.y * 100) / 100,
    z: Math.round(next.z * 100) / 100,
  };
  const hud = useGameStore.getState();
  if (hud.flying !== nextFlying) hud.setFlying(nextFlying);
  if (hud.coordinates.x !== coordinates.x || hud.coordinates.y !== coordinates.y || hud.coordinates.z !== coordinates.z) {
    hud.setCoordinates(coordinates);
  }
}
