import { heightAt } from './levels';
import { isCollidable } from './systems/collisionSystem';
import type { Voxel } from './voxel';
import type { CustomTerrain } from './worldCode';

export type EditorCollisionWorld = { columns: Map<string, Voxel[]>; terrain: CustomTerrain; seed: number };
export type EditorPlayerInput = { forward: number; right: number; jump: boolean; sprint: boolean };
export type EditorPlayerState = { x: number; y: number; z: number; verticalSpeed: number; grounded: boolean; yaw: number; moving: boolean };

export function createEditorCollisionWorld(blocks: Voxel[], terrain: CustomTerrain, seed: number): EditorCollisionWorld {
  const columns = new Map<string, Voxel[]>();
  for (const block of blocks) {
    const key = `${Math.round(block.x)},${Math.round(block.z)}`;
    const column = columns.get(key) ?? [];
    column.push(block);
    columns.set(key, column);
  }
  return { columns, terrain, seed };
}

export function createEditorPlayer(spawn: { x: number; y: number; z: number }): EditorPlayerState {
  return { x: spawn.x, y: spawn.y, z: spawn.z, verticalSpeed: 0, grounded: false, yaw: 0, moving: false };
}

export function editorGroundAt(world: EditorCollisionWorld, x: number, z: number, fromY: number) {
  const roundedX = Math.round(x);
  const roundedZ = Math.round(z);
  let ground = world.terrain === 'natural' ? heightAt(roundedX, roundedZ, world.seed) + 0.5 : 0.5;
  if (ground > fromY) ground = -Infinity;
  for (const block of world.columns.get(`${roundedX},${roundedZ}`) ?? []) {
    if (block.y + 0.5 <= fromY && block.y + 0.5 > ground && isCollidable(block)) ground = block.y + 0.5;
  }
  return ground;
}

function bodyClear(world: EditorCollisionWorld, x: number, z: number, feetY: number) {
  const column = world.columns.get(`${Math.round(x)},${Math.round(z)}`) ?? [];
  for (const height of [0.35, 1.15]) {
    const y = Math.round(feetY + height);
    if (column.some((block) => block.y === y && isCollidable(block))) return false;
  }
  return true;
}

function step(state: EditorPlayerState, input: EditorPlayerInput, world: EditorCollisionWorld, dt: number) {
  const forward = Math.max(-1, Math.min(1, input.forward));
  const right = Math.max(-1, Math.min(1, input.right));
  const length = Math.hypot(forward, right);
  const speed = input.sprint ? 6 : 4;
  const dx = length > 0 ? right / Math.max(1, length) * speed * dt : 0;
  const dz = length > 0 ? forward / Math.max(1, length) * speed * dt : 0;
  state.moving = length > 0;
  if (length > 0) state.yaw = Math.atan2(dx, dz);
  const nextX = state.x + dx;
  const nextZ = state.z + dz;
  const nextGround = editorGroundAt(world, nextX, nextZ, state.y + 1.05);
  if (nextGround - state.y <= 1.05 && bodyClear(world, nextX, nextZ, Math.max(state.y, nextGround))) {
    state.x = nextX;
    state.z = nextZ;
  }
  if (state.grounded && !input.jump) {
    const stepGround = editorGroundAt(world, state.x, state.z, state.y + 1.05);
    if (stepGround >= state.y - 0.001 && stepGround - state.y <= 1.05) {
      state.y = stepGround;
      state.verticalSpeed = 0;
      state.grounded = true;
      return;
    }
    state.grounded = false;
  }
  if (state.grounded && input.jump) {
    state.verticalSpeed = 5.5;
    state.grounded = false;
  }
  const ground = editorGroundAt(world, state.x, state.z, state.y + 0.02);
  state.verticalSpeed -= 16 * dt;
  state.y += state.verticalSpeed * dt;
  if (state.y <= ground) {
    state.y = ground;
    state.verticalSpeed = 0;
    state.grounded = true;
  } else state.grounded = false;
}

export function stepEditorPlayer(state: EditorPlayerState, input: EditorPlayerInput, world: EditorCollisionWorld, dt: number) {
  const steps = Math.max(1, Math.ceil(dt / 0.025));
  for (let index = 0; index < steps; index += 1) step(state, input, world, dt / steps);
  return state;
}
