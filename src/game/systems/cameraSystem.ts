import type { World } from 'koota';
import { Euler } from 'three';
import type { Camera } from 'three';
import { Player, PlayerPosition, PlayerState } from '../traits';

const rotation = new Euler(0, 0, 0, 'YXZ');

export function cameraSystem(world: World, camera: Camera) {
  const entity = world.queryFirst(Player);
  if (!entity) return;

  const position = entity.get(PlayerPosition);
  const state = entity.get(PlayerState);
  if (!position || !state) return;

  camera.position.copy(position);
  camera.position.y += 1.62;
  rotation.set(state.pitch, state.yaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(rotation);
  camera.updateMatrixWorld();
}
