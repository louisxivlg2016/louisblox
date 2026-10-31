import type { World } from 'koota';
import { Euler, Vector3 } from 'three';
import type { Camera } from 'three';
import { useGameStore } from '../store';
import { Player, PlayerMesh, PlayerMount, PlayerPosition, PlayerState, Sleep } from '../traits';

const rotation = new Euler(0, 0, 0, 'YXZ');

const sleepBlends = new WeakMap<World, number>();
const sleepCameraPosition = new Vector3();

export function cameraSystem(world: World, camera: Camera, dt = 1 / 60) {
  const entity = world.queryFirst(Player);
  if (!entity) return;
  const position = entity.get(PlayerPosition);
  const state = entity.get(PlayerState);
  if (!position || !state) return;
  const avatar = entity.get(PlayerMesh)?.value;
  if (avatar) avatar.rotation.y = state.yaw;
  const sleep = world.queryFirst(Sleep)?.get(Sleep);
  const previous = sleepBlends.get(world) ?? 0;
  const blend = sleep ? Math.min(1, previous + dt * 3) : Math.max(0, previous - dt * 3);
  sleepBlends.set(world, blend);
  const amount = blend * blend * (3 - 2 * blend);
  if (avatar) {
    avatar.rotation.z = amount * Math.PI / 2;
    avatar.position.set(-0.9 * amount, 0.35 * amount, 0);
  }
  if (sleep) {
    sleepCameraPosition.set(sleep.x + Math.sin(state.yaw) * 4.5, sleep.y + 2.2, sleep.z + Math.cos(state.yaw) * 4.5);
    camera.position.lerp(sleepCameraPosition, 1 - Math.exp(-dt * 5));
    camera.lookAt(sleep.x, sleep.y + 0.5, sleep.z);
    camera.updateMatrixWorld();
    return;
  }
  const mount = entity.get(PlayerMount);
  if (useGameStore.getState().cameraMode === 'front') {
    const distance = mount?.kind === 'plane' ? 12 : mount?.kind === 'train' ? 14 : 6;
    const height = Math.max(0.6, Math.min(5.5, 2.4 - Math.sin(state.pitch) * 3));
    camera.position.set(position.x - Math.sin(state.yaw) * distance, position.y + height, position.z - Math.cos(state.yaw) * distance);
    camera.lookAt(position.x, position.y + 1.55, position.z);
  } else if (useGameStore.getState().cameraMode === 'third') {
    const distance = mount?.kind === 'plane' ? 12 : mount?.kind === 'train' ? 14 : 6;
    const height = Math.max(0.6, Math.min(5.5, 2.4 - Math.sin(state.pitch) * 3));
    camera.position.set(position.x + Math.sin(state.yaw) * distance, position.y + height, position.z + Math.cos(state.yaw) * distance);
    camera.lookAt(position.x, position.y + 1.1, position.z);
  } else {
    camera.position.copy(position);
    if (mount?.kind === 'plane') {
      camera.position.x -= Math.sin(state.yaw) * 0.35;
      camera.position.y += 0.05;
      camera.position.z -= Math.cos(state.yaw) * 0.35;
    } else {
      camera.position.y += mount?.vehicle && mount.kind !== 'horse' ? mount.kind === 'car' ? 1.35 : 0.55 : 1.62;
    }
    rotation.set(state.pitch, state.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(rotation);
  }
  camera.updateMatrixWorld();
}
