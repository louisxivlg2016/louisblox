import type { World } from 'koota';
import { Euler, PerspectiveCamera, Vector3 } from 'three';
import type { Camera } from 'three';
import { useGameStore } from '../store';
import { useEmoteStore } from '../emotes';
import { turnToward } from '../rotation';
import { Player, PlayerMesh, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity, Sleep } from '../traits';
import { useMazeStore } from '../mazeClient';
import { canWalkInVehicle, vehicleViewDistance } from '../vehicleTypes';
import { VehiclePosition } from '../traits';

const rotation = new Euler(0, 0, 0, 'YXZ');

const sleepBlends = new WeakMap<World, number>();
const flightBlends = new WeakMap<World, number>();
const sleepCameraPosition = new Vector3();

export function cameraSystem(world: World, camera: Camera, dt = 1 / 60) {
  const entity = world.queryFirst(Player);
  if (!entity) return;
  const position = entity.get(PlayerPosition);
  const state = entity.get(PlayerState);
  if (!position || !state) return;
  const avatar = entity.get(PlayerMesh)?.value;
  const velocity = entity.get(PlayerVelocity);
  const mounted = entity.get(PlayerMount)?.vehicle;
  const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0;
  if (avatar) {
    avatar.rotation.order = 'YXZ';
    if (state.flying || mounted || speed > 0.1) avatar.rotation.y = turnToward(avatar.rotation.y, state.yaw, dt * 6);
  }
  const sleep = world.queryFirst(Sleep)?.get(Sleep);
  const previous = sleepBlends.get(world) ?? 0;
  const blend = sleep ? Math.min(1, previous + dt * 3) : Math.max(0, previous - dt * 3);
  sleepBlends.set(world, blend);
  const amount = blend * blend * (3 - 2 * blend);
  const previousFlight = flightBlends.get(world) ?? 0;
  const flightBlend = state.flying && !sleep ? Math.min(1, previousFlight + dt * 5) : Math.max(0, previousFlight - dt * 5);
  flightBlends.set(world, flightBlend);
  const flightAmount = flightBlend * flightBlend * (3 - 2 * flightBlend);
  const mountKind = entity.get(PlayerMount)?.kind;
  const emote = useEmoteStore.getState().current;
  const seatedHeight = mounted && mountKind !== 'horse' ? mountKind === 'car' ? -0.9 : -0.7 : 0;
  const lyingHeight = !mounted && emote === 'lie' ? 0.18 : 0;
  if (avatar) {
    avatar.rotation.x = !mounted && emote === 'lie' ? -Math.PI / 2 : -flightAmount * Math.PI / 2;
    avatar.rotation.z = amount * Math.PI / 2;
    avatar.position.set(-0.9 * amount, 0.35 * amount + flightAmount + seatedHeight + lyingHeight, 0);
  }
  if (sleep) {
    sleepCameraPosition.set(sleep.x + Math.sin(state.yaw) * 4.5, sleep.y + 2.2, sleep.z + Math.cos(state.yaw) * 4.5);
    camera.position.lerp(sleepCameraPosition, 1 - Math.exp(-dt * 5));
    camera.lookAt(sleep.x, sleep.y + 0.5, sleep.z);
    camera.updateMatrixWorld();
    return;
  }
  const mount = entity.get(PlayerMount);
  if (useGameStore.getState().gameplayMode === 'maze' && useMazeStore.getState().overview) {
    camera.position.set(position.x, position.y + 12, position.z + 5);
    camera.lookAt(position.x, position.y - 7.5, position.z - 24);
    camera.updateMatrixWorld();
    return;
  }
  const cameraMode = useGameStore.getState().cameraMode;
  const walkingCabin = Boolean(mount?.kind && canWalkInVehicle(mount.kind, mount.role));
  const center = mount?.vehicle?.get(VehiclePosition) ?? position;
  const distance = mount?.kind && mount.kind !== 'horse' ? vehicleViewDistance(mount.kind) : 6;
  const exteriorPlane = mount?.kind === 'plane' && cameraMode !== 'first';
  const height = exteriorPlane ? 320 : Math.max(0.6, Math.min(5.5, 2.4 - Math.sin(state.pitch) * 3));
  const targetHeight = exteriorPlane ? 190 : 1.3;
  if (camera instanceof PerspectiveCamera && camera.far !== (exteriorPlane ? 3500 : 130)) {
    camera.far = exteriorPlane ? 3500 : 130;
    if ('updateProjectionMatrix' in camera) camera.updateProjectionMatrix();
  }
  if (cameraMode === 'front' || cameraMode === 'third') {
    const direction = cameraMode === 'front' ? -1 : 1;
    camera.position.set(center.x + Math.sin(state.yaw) * distance * direction, center.y + height, center.z + Math.cos(state.yaw) * distance * direction);
    camera.lookAt(center.x, center.y + targetHeight, center.z);
  } else {
    camera.position.copy(position);
    if (walkingCabin) camera.position.y += 1.62;
    else if (mount?.kind === 'car' && mount.role === 'passenger') {
      camera.position.y += 1.2;
      camera.position.x -= Math.sin(state.yaw) * 0.65;
      camera.position.z -= Math.cos(state.yaw) * 0.65;
    } else if (mount?.kind === 'plane') camera.position.y += 0.05;
    else camera.position.y += mount?.vehicle && mount.kind !== 'horse' ? mount.kind === 'car' ? 0.65 : 0.55 : 1.62;
    rotation.set(state.pitch, state.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(rotation);
  }
  camera.updateMatrixWorld();
}
