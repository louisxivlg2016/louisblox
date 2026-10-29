import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex } from './chunks';
import { getTouchMovement, isDown } from './input';
import { MAX_BUILD_Y, MIN_WORLD_Y, SEA_LEVEL } from './levels';
import { useGameStore } from './store';
import { Animal, AnimalMesh, AnimalMotion, AnimalPosition, HorseRider, Player, PlayerBody, PlayerMount, PlayerPosition, PlayerState, Vehicle, VehicleMesh, VehicleMotion, VehiclePosition } from './traits';
import { BlockKind, voxelKey } from './voxel';

export function groundAt(world: World, x: number, z: number, fromY = MAX_BUILD_Y) {
  const blocks = getBlockIndex(world);
  const bx = Math.round(x);
  const bz = Math.round(z);
  for (let y = Math.min(MAX_BUILD_Y, Math.floor(fromY + 0.5)); y >= MIN_WORLD_Y; y -= 1) {
    const block = blocks.get(voxelKey(bx, y, bz));
    if (block && block.kind !== BlockKind.Water && !(block.open && block.kind >= 48 && block.kind <= 79)) return y + 0.5;
  }
  return MIN_WORLD_Y + 0.5;
}

export function spawnCar(world: World, x: number, y: number, z: number, color = '#d63935', yaw = 0) {
  return world.spawn(
    Vehicle({ color }),
    VehiclePosition(new Vector3(x, y, z)),
    VehicleMotion({ yaw }),
    VehicleMesh(),
  );
}

export function mountEntity(world: World, vehicle: Entity, kind: 'car' | 'horse') {
  const player = world.queryFirst(Player);
  const mount = player?.get(PlayerMount);
  if (!player || !mount || mount.vehicle) return false;
  if (kind === 'car') {
    const motion = vehicle.get(VehicleMotion);
    if (!motion || motion.mounted) return false;
    vehicle.set(VehicleMotion, { mounted: true });
  } else {
    const rider = vehicle.get(HorseRider);
    if (!rider?.saddled || rider.mounted) return false;
    vehicle.set(HorseRider, { mounted: true, speed: 0 });
  }
  mount.vehicle = vehicle;
  mount.kind = kind;
  useGameStore.getState().setRiding(kind);
  useGameStore.getState().setNotice(kind === 'car' ? 'WASD / flèches : conduire · E : descendre' : 'Cheval sellé · E : descendre');
  return true;
}

export function dismount(world: World) {
  const player = world.queryFirst(Player);
  const mount = player?.get(PlayerMount);
  const position = player?.get(PlayerPosition);
  const body = player?.get(PlayerBody)?.value;
  if (!player || !mount?.vehicle || !position) return false;
  const vehicle = mount.vehicle;
  const vehiclePosition = mount.kind === 'car' ? vehicle.get(VehiclePosition) : vehicle.get(AnimalPosition);
  if (vehiclePosition) {
    position.set(vehiclePosition.x + 1.6, groundAt(world, vehiclePosition.x + 1.6, vehiclePosition.z, vehiclePosition.y + 2) + 0.02, vehiclePosition.z);
    body?.setNextKinematicTranslation(position);
    body?.setTranslation(position, true);
  }
  if (mount.kind === 'car') vehicle.set(VehicleMotion, { mounted: false, speed: 0 });
  else vehicle.set(HorseRider, { mounted: false, speed: 0 });
  mount.vehicle = null;
  mount.kind = null;
  useGameStore.getState().setRiding(null);
  useGameStore.getState().setNotice('');
  return true;
}

export function vehicleInteractionSystem(world: World, interact: number) {
  if (interact <= 0) return false;
  const player = world.queryFirst(Player);
  const mount = player?.get(PlayerMount);
  const position = player?.get(PlayerPosition);
  if (!player || !mount || !position) return false;
  if (mount.vehicle) return dismount(world);
  let nearest: Entity | undefined;
  let kind: 'car' | 'horse' = 'car';
  let distance = 3.8;
  for (const entity of world.query(Vehicle, VehiclePosition, VehicleMotion)) {
    const value = entity.get(VehiclePosition)!.distanceTo(position);
    if (value < distance && !entity.get(VehicleMotion)!.mounted) {
      distance = value;
      nearest = entity;
    }
  }
  for (const entity of world.query(Animal, AnimalPosition)) {
    if (entity.get(Animal)!.kind !== 'horse') continue;
    const value = entity.get(AnimalPosition)!.distanceTo(position);
    if (value < distance) {
      distance = value;
      nearest = entity;
      kind = 'horse';
    }
  }
  if (!nearest) return false;
  if (kind === 'horse' && !nearest.get(HorseRider)?.saddled) {
    if (useGameStore.getState().selected === 'saddle') return false;
    useGameStore.getState().setNotice('Choisis la selle dans le sac, vise le cheval puis appuie sur E.');
    return true;
  }
  return mountEntity(world, nearest, kind);
}

function drivingInput() {
  const touch = getTouchMovement();
  return {
    forward: Math.max(-1, Math.min(1, Number(isDown('KeyW') || isDown('ArrowUp')) - Number(isDown('KeyS') || isDown('ArrowDown')) - touch.y)),
    strafe: Math.max(-1, Math.min(1, Number(isDown('KeyD') || isDown('ArrowRight')) - Number(isDown('KeyA') || isDown('ArrowLeft')) + touch.x)),
  };
}

function moveMount(world: World, position: Vector3, yaw: number, speed: number, dt: number) {
  const x = position.x - Math.sin(yaw) * speed * dt;
  const z = position.z - Math.cos(yaw) * speed * dt;
  const ground = groundAt(world, x, z, position.y + 1.01);
  if (ground > position.y + 1.01 || ground < SEA_LEVEL - 0.5 || Math.abs(ground - position.y) > 3) return false;
  const blocks = getBlockIndex(world);
  for (const height of [0.65, 1.55]) {
    if (blocks.has(voxelKey(Math.round(x), Math.round(ground + height), Math.round(z)))) return false;
  }
  position.set(x, ground, z);
  return true;
}

export function vehicleMovementSystem(world: World, dt: number) {
  const playerEntity = world.queryFirst(Player);
  const mount = playerEntity?.get(PlayerMount);
  const state = playerEntity?.get(PlayerState);
  const input = drivingInput();
  world.query(Vehicle, VehiclePosition, VehicleMotion, VehicleMesh).updateEach(([vehicle, position, motion, mesh], entity) => {
    const active = mount?.vehicle === entity && mount.kind === 'car' && state;
    const target = active ? input.forward * (input.forward < 0 ? 5 : 14) : 0;
    motion.speed += Math.max(-20 * dt, Math.min(20 * dt, target - motion.speed));
    if (Math.abs(motion.speed) < 0.03) motion.speed = 0;
    if (active) {
      motion.yaw = state.yaw;
      if (input.strafe !== 0) motion.yaw -= input.strafe * dt * 1.4 * Math.sign(motion.speed || 1);
    }
    if (motion.speed !== 0 && !moveMount(world, position, motion.yaw, motion.speed, dt)) motion.speed = 0;
    if (mesh.value) {
      mesh.value.position.copy(position);
      mesh.value.rotation.y = motion.yaw;
    }
  });

  world.query(Animal, AnimalPosition, AnimalMotion, AnimalMesh, HorseRider).updateEach(([animal, position, motion, mesh, rider], entity) => {
    const active = animal.kind === 'horse' && mount?.vehicle === entity && mount.kind === 'horse' && state;
    if (!active) return;
    const target = input.forward * (input.forward < 0 ? 2.2 : 6.2);
    rider.speed += Math.max(-10 * dt, Math.min(10 * dt, target - rider.speed));
    motion.yaw = state.yaw + Math.PI;
    if (input.strafe !== 0) motion.yaw -= input.strafe * dt * 1.4 * Math.sign(rider.speed || 1);
    if (!moveMount(world, position, motion.yaw - Math.PI, rider.speed, dt)) rider.speed = 0;
    if (mesh.value) {
      mesh.value.position.copy(position);
      mesh.value.rotation.y = motion.yaw;
    }
  });
}
