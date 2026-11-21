import type { World } from 'koota';
import { Euler, PerspectiveCamera, Vector3 } from 'three';
import type { Camera } from 'three';
import { Color, FogExp2, Scene } from 'three';
import { isWaterBlock, raycastVoxel, voxelKey } from '../voxel';
import { useGameStore } from '../store';
import { useEmoteStore } from '../emotes';
import { turnToward } from '../rotation';
import { Player, PlayerMesh, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity, Sleep } from '../traits';
import { useMazeStore } from '../mazeClient';
import { canWalkInVehicle, isAnimalMount, vehicleViewDistance } from '../vehicleTypes';
import { Vehicle, VehiclePosition } from '../traits';
import { groundAt } from '../vehicles';
import { chunkCoordinate, getBlockIndex, getColumnTop, loadChunkForCamera, releaseCameraChunk, streamChunks } from '../chunks';
import { isCollidable } from './collisionSystem';

const rotation = new Euler(0, 0, 0, 'YXZ');

const sleepBlends = new WeakMap<World, number>();
const flightBlends = new WeakMap<World, number>();
const sleepCameraPosition = new Vector3();
const cameraTarget = new Vector3();
const cameraOffset = new Vector3();

function moveCameraOutOfSolidBlocks(world: World, camera: Camera) {
  const blocks = getBlockIndex(world);
  const x = Math.floor(camera.position.x + 0.5);
  const y = Math.floor(camera.position.y + 0.5);
  const z = Math.floor(camera.position.z + 0.5);
  if (!isCollidable(blocks.get(voxelKey(x, y, z)))) return;
  const top = Math.max(y, getColumnTop(world, x, z) ?? y);
  for (let freeY = y + 1; freeY <= top + 1; freeY += 1) {
    if (isCollidable(blocks.get(voxelKey(x, freeY, z)))) continue;
    camera.position.y = freeY - 0.3;
    return;
  }
}

export function cameraSystem(world: World, camera: Camera, dt = 1 / 60) {
  const entity = world.queryFirst(Player);
  if (!entity) return;
  const position = entity.get(PlayerPosition);
  const state = entity.get(PlayerState);
  if (!position || !state) return;
  const avatar = entity.get(PlayerMesh)?.value;
  const mounted = entity.get(PlayerMount)?.vehicle;
  const velocity = entity.get(PlayerVelocity);
  const sleep = world.queryFirst(Sleep)?.get(Sleep);
  if (avatar) {
    avatar.rotation.order = 'YXZ';
    if (sleep) avatar.rotation.y = turnToward(avatar.rotation.y, sleep.yaw, dt * 8);
    else if (mounted || velocity && Math.hypot(velocity.x, velocity.z) > 0.1) avatar.rotation.y = turnToward(avatar.rotation.y, state.yaw, dt * 6);
  }
  const previous = sleepBlends.get(world) ?? 0;
  const blend = sleep ? Math.min(1, previous + dt * 3) : Math.max(0, previous - dt * 3);
  sleepBlends.set(world, blend);
  const amount = blend * blend * (3 - 2 * blend);
  const previousFlight = flightBlends.get(world) ?? 0;
  const flightBlend = state.flying && !sleep && !mounted ? Math.min(1, previousFlight + dt * 5) : Math.max(0, previousFlight - dt * 5);
  flightBlends.set(world, flightBlend);
  const flightAmount = flightBlend * flightBlend * (3 - 2 * flightBlend);
  const mountKind = entity.get(PlayerMount)?.kind;
  const emote = useEmoteStore.getState().current;
  const seatedHeight = mounted && !isAnimalMount(mountKind) ? mountKind === 'car' ? -0.55 : -0.7 : 0;
  const lyingHeight = !mounted && !sleep && emote === 'lie' ? 0.18 : 0;
  if (avatar) {
    avatar.rotation.x = sleep ? amount * Math.PI / 2 : !mounted && (emote === 'lie' || state.parachuting) ? -Math.PI / 2 : -flightAmount * Math.PI / 2;
    avatar.rotation.z = 0;
    avatar.position.set(-Math.sin(sleep?.yaw ?? 0) * 1.1 * amount, -0.32 * amount + (sleep ? 0 : flightAmount) + seatedHeight + lyingHeight, -Math.cos(sleep?.yaw ?? 0) * 1.1 * amount);
  }
  if (sleep) {
    sleepCameraPosition.set(sleep.x + Math.cos(sleep.yaw) * 4.5, sleep.y + 2.8, sleep.z - Math.sin(sleep.yaw) * 4.5);
    camera.position.lerp(sleepCameraPosition, 1 - Math.exp(-dt * 5));
    camera.lookAt(sleep.x, sleep.y + 0.5, sleep.z);
    camera.updateMatrixWorld();
    return;
  }
  const mount = entity.get(PlayerMount);
  const blueCar = mount?.kind === 'car' && mount.vehicle?.get(Vehicle)?.color.toLowerCase() === '#347cd0';
  if (useGameStore.getState().gameplayMode === 'maze' && useMazeStore.getState().overview) {
    camera.position.set(position.x, position.y + 12, position.z + 5);
    camera.lookAt(position.x, position.y - 7.5, position.z - 24);
    camera.updateMatrixWorld();
    return;
  }
  const cameraMode = useGameStore.getState().cameraMode;
  const walkingCabin = Boolean(mount?.kind && canWalkInVehicle(mount.kind, mount.role));
  const center = mount?.vehicle?.get(VehiclePosition) ?? position;
  const distance = mount?.kind && !isAnimalMount(mount.kind) ? vehicleViewDistance(mount.kind) : 3;
  const exteriorPlane = mount?.kind === 'plane' && cameraMode !== 'first';
  const height = exteriorPlane ? 12 : Math.max(0.8, Math.min(6, (cameraMode === 'third' ? 2.35 : 2.05) - Math.sin(state.pitch) * 1.5));
  const targetHeight = exteriorPlane ? -8 : cameraMode === 'third' ? 0.95 : 0.9;
  if (camera instanceof PerspectiveCamera && camera.far !== (exteriorPlane ? 700 : 280)) {
    camera.far = exteriorPlane ? 700 : 280;
    if ('updateProjectionMatrix' in camera) camera.updateProjectionMatrix();
  }
  if (cameraMode === 'front' || cameraMode === 'third') {
    const direction = cameraMode === 'front' ? -1 : 1;
    camera.position.set(center.x + Math.sin(state.yaw) * distance * direction, center.y + height, center.z + Math.cos(state.yaw) * distance * direction);
    if (mounted) {
      const chunkX = chunkCoordinate(camera.position.x);
      const chunkZ = chunkCoordinate(camera.position.z);
      loadChunkForCamera(world, chunkX, chunkZ);
      if (exteriorPlane) streamChunks(world, center.x, center.z);
    }
    camera.position.y = Math.max(camera.position.y, groundAt(world, camera.position.x, camera.position.z, center.y + 0.2) + 0.35);
    cameraTarget.set(center.x, center.y + targetHeight, center.z);
    cameraOffset.copy(camera.position).sub(cameraTarget);
    const rayDistance = cameraOffset.length();
    if (rayDistance > 0.001) {
      cameraOffset.divideScalar(rayDistance);
      const hit = raycastVoxel(getBlockIndex(world), cameraTarget, cameraOffset, rayDistance);
      if (hit) camera.position.copy(cameraTarget).addScaledVector(cameraOffset, Math.max(0.15, hit.distance - 0.25));
    }
    camera.lookAt(cameraTarget);
  } else {
    releaseCameraChunk(world);
    camera.position.copy(position);
    if (walkingCabin) camera.position.y += 1.62;
    else if (mount?.kind === 'plane') camera.position.y += 1;
    else if (mount?.vehicle && !isAnimalMount(mount.kind)) camera.position.y += blueCar ? 0.45 : 0.55;
    else camera.position.y += 1.62;
    if (mounted && !walkingCabin && !blueCar) camera.position.y = Math.max(camera.position.y, groundAt(world, camera.position.x, camera.position.z, center.y + 0.2) + 0.2);
    if (!blueCar) moveCameraOutOfSolidBlocks(world, camera);
    rotation.set(state.pitch, state.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(rotation);
  }
  const scene = camera.parent instanceof Scene ? camera.parent : null;
  if (scene) {
    const block = getBlockIndex(world).get(voxelKey(Math.floor(camera.position.x + 0.5), Math.floor(camera.position.y + 0.5), Math.floor(camera.position.z + 0.5)));
    if (block && !isWaterBlock(block.kind)) {
      scene.fog = new FogExp2('#101010', 0.035);
      if (scene.background instanceof Color) scene.background.set('#101010');
    } else scene.fog = null;
  }
  camera.updateMatrixWorld();
}
