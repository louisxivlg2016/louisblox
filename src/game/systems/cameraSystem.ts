import type { World } from 'koota';
import { Euler } from 'three';
import type { Camera } from 'three';
import { useGameStore } from '../store';
import { Player, PlayerMesh, PlayerPosition, PlayerState } from '../traits';

const rotation = new Euler(0, 0, 0, 'YXZ');

export function cameraSystem(world: World, camera: Camera) {
  const entity = world.queryFirst(Player);
  if (!entity) return;

  const position = entity.get(PlayerPosition);
  const state = entity.get(PlayerState);
  if (!position || !state) return;

  const avatar = entity.get(PlayerMesh)?.value;
  if (avatar) avatar.rotation.y = state.yaw;
  if (useGameStore.getState().cameraMode === 'third') {
    const distance = 6;
    const height = Math.max(0.6, Math.min(5.5, 2.4 - Math.sin(state.pitch) * 3));
    camera.position.set(
      position.x + Math.sin(state.yaw) * distance,
      position.y + height,
      position.z + Math.cos(state.yaw) * distance,
    );
    camera.lookAt(position.x, position.y + 1.1, position.z);
  } else {
    camera.position.copy(position);
    camera.position.y += 1.62;
    rotation.set(state.pitch, state.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(rotation);
  }
  camera.updateMatrixWorld();
}
