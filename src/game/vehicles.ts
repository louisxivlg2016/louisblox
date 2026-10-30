import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { addVoxel, getBlockIndex } from './chunks';
import { getTouchMovement, isDown } from './input';
import { MAX_BUILD_Y, MIN_WORLD_Y, SEA_LEVEL } from './levels';
import { useGameStore } from './store';
import { Animal, AnimalMesh, AnimalMotion, AnimalPosition, HorseRider, Player, PlayerBody, PlayerMount, PlayerPosition, PlayerState, Vehicle, VehicleMesh, VehicleMotion, VehiclePosition } from './traits';
import { BlockKind, voxelKey } from './voxel';
import { EXTRA_BLOCKS, isCrop, isRail } from './extraBlocks';
import { turnToward } from './rotation';

export function groundAt(world: World, x: number, z: number, fromY = MAX_BUILD_Y) {
  const blocks = getBlockIndex(world);
  const bx = Math.round(x);
  const bz = Math.round(z);
  for (let y = Math.min(MAX_BUILD_Y, Math.floor(fromY + 0.5)); y >= MIN_WORLD_Y; y -= 1) {
    const block = blocks.get(voxelKey(bx, y, bz));
    if (block && block.kind !== BlockKind.Water && !isCrop(block.kind) && !isRail(block.kind) && !(block.open && block.kind >= 48 && block.kind <= 79)) return y + 0.5;
  }
  return MIN_WORLD_Y + 0.5;
}

export function spawnVehicle(world: World, kind: 'car' | 'plane' | 'train', x: number, y: number, z: number, color = '#d63935', yaw = 0) {
  const entity = world.spawn(
    Vehicle({ color, kind }),
    VehiclePosition(new Vector3(x, y, z)),
    VehicleMotion({ yaw, homeX: x, homeY: y, homeZ: z, homeYaw: yaw }),
    VehicleMesh(),
  );
  if (kind === 'train') {
    for (let offset = 0; offset < 24; offset += 1) ensureTrainTrack(world, x - Math.sin(yaw) * offset, z - Math.cos(yaw) * offset, yaw, y + 4);
  }
  return entity;
}

function ensureTrainTrack(world: World, x: number, z: number, yaw: number, fromY: number) {
  const bx = Math.round(x);
  const bz = Math.round(z);
  const ground = groundAt(world, bx, bz, fromY);
  if (ground <= SEA_LEVEL) return;
  const y = ground + 1;
  if (getBlockIndex(world).has(voxelKey(bx, y, bz))) return;
  const facing = Math.abs(Math.sin(yaw)) > Math.abs(Math.cos(yaw)) ? 'east' : 'north';
  addVoxel(world, bx, y, bz, EXTRA_BLOCKS.Rail, undefined, facing);
}

export function spawnCar(world: World, x: number, y: number, z: number, color = '#d63935', yaw = 0) {
  return spawnVehicle(world, 'car', x, y, z, color, yaw);
}

export const PLANE_SCALE = 1.75;

export function seatOffset(kind: 'car' | 'plane' | 'train', role: 'driver' | 'passenger', seat = 0): [number, number, number] {
  if (kind === 'car') return [0, 0.55, 0];
  if (kind === 'plane') {
    const [x, y, z] = role === 'driver' ? [-0.5, 1.1, -2.4] : [0.55, 1.1, 0.3 + seat * 1.4];
    return [x * PLANE_SCALE, y * PLANE_SCALE, z * PLANE_SCALE];
  }
  return role === 'driver' ? [-0.65, 1.25, -3.7] : [0.65, 1.25, -1 + seat * 1.5];
}

export function vehicleSeatPosition(vehicle: Entity, kind: 'car' | 'plane' | 'train', role: 'driver' | 'passenger', seat = 0) {
  const position = vehicle.get(VehiclePosition)!;
  const yaw = vehicle.get(VehicleMotion)?.yaw ?? 0;
  const offset = new Vector3(...seatOffset(kind, role, seat)).applyAxisAngle(new Vector3(0, 1, 0), yaw);
  return position.clone().add(offset);
}

export function mountEntity(world: World, vehicle: Entity, kind: 'car' | 'horse' | 'plane' | 'train', role: 'driver' | 'passenger' = 'driver') {
  const player = world.queryFirst(Player);
  const mount = player?.get(PlayerMount);
  if (!player || !mount || mount.vehicle) return false;
  if (kind !== 'horse') {
    const motion = vehicle.get(VehicleMotion);
    if (!motion || (role === 'driver' && motion.mounted)) return false;
    if (role === 'driver') vehicle.set(VehicleMotion, { mounted: true });
  } else {
    const rider = vehicle.get(HorseRider);
    if (!rider?.saddled || rider.mounted) return false;
    vehicle.set(HorseRider, { mounted: true, speed: 0 });
  }
  mount.vehicle = vehicle;
  mount.kind = kind;
  mount.role = role;
  mount.seat = 0;
  useGameStore.getState().setRiding(kind, role);
  useGameStore.getState().setNotice(
    kind === 'horse' ? 'Cheval sellé · E : descendre'
      : role === 'passenger' ? 'Installe-toi : le personnel conduit · E : descendre'
        : kind === 'plane' ? 'WASD : piloter · Espace/C : monter/descendre · E : sortir'
          : 'WASD / flèches : conduire · E : descendre',
  );
  return true;
}

export function dismount(world: World) {
  const player = world.queryFirst(Player);
  const mount = player?.get(PlayerMount);
  const position = player?.get(PlayerPosition);
  const body = player?.get(PlayerBody)?.value;
  if (!player || !mount?.vehicle || !position) return false;
  const vehicle = mount.vehicle;
  const vehiclePosition = mount.kind === 'horse' ? vehicle.get(AnimalPosition) : vehicle.get(VehiclePosition);
  if (vehiclePosition) {
    position.set(vehiclePosition.x + 1.6, groundAt(world, vehiclePosition.x + 1.6, vehiclePosition.z, vehiclePosition.y + 2) + 0.02, vehiclePosition.z);
    body?.setTranslation(position, true);
  }
  if (mount.kind === 'horse') vehicle.set(HorseRider, { mounted: false, speed: 0 });
  else if (mount.role === 'driver') vehicle.set(VehicleMotion, { mounted: false, speed: 0 });
  mount.vehicle = null;
  mount.kind = null;
  mount.role = 'driver';
  mount.seat = 0;
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
  let horse = false;
  let distance = 6;
  for (const entity of world.query(Vehicle, VehiclePosition, VehicleMotion)) {
    const value = entity.get(VehiclePosition)!.distanceTo(position);
    if (value < distance) {
      distance = value;
      nearest = entity;
      horse = false;
    }
  }
  for (const entity of world.query(Animal, AnimalPosition)) {
    if (entity.get(Animal)!.kind !== 'horse') continue;
    const value = entity.get(AnimalPosition)!.distanceTo(position);
    if (value < distance) {
      distance = value;
      nearest = entity;
      horse = true;
    }
  }
  if (!nearest) return false;
  if (horse) {
    if (!nearest.get(HorseRider)?.saddled) {
      if (useGameStore.getState().selected === 'saddle') return false;
      useGameStore.getState().setNotice('Choisis la selle dans le sac, vise le cheval puis appuie sur E.');
      return true;
    }
    return mountEntity(world, nearest, 'horse');
  }
  const vehicle = nearest.get(Vehicle)!;
  useGameStore.getState().setSeatChoice({ vehicle: nearest, kind: vehicle.kind });
  useGameStore.getState().setMode('pause');
  if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
  return true;
}

function drivingInput() {
  const touch = getTouchMovement();
  return {
    forward: Math.max(-1, Math.min(1, Number(isDown('KeyW') || isDown('ArrowUp')) - Number(isDown('KeyS') || isDown('ArrowDown')) - touch.y)),
    strafe: Math.max(-1, Math.min(1, Number(isDown('KeyD') || isDown('ArrowRight')) - Number(isDown('KeyA') || isDown('ArrowLeft')) + touch.x)),
  };
}

function moveMount(world: World, position: Vector3, yaw: number, speed: number, dt: number, clearance = 1.55) {
  const x = position.x - Math.sin(yaw) * speed * dt;
  const z = position.z - Math.cos(yaw) * speed * dt;
  const ground = groundAt(world, x, z, position.y + 1.01);
  if (ground > position.y + 1.01 || ground < SEA_LEVEL - 0.5 || Math.abs(ground - position.y) > 3) return false;
  const blocks = getBlockIndex(world);
  for (const height of [0.65, clearance]) {
    const block = blocks.get(voxelKey(Math.round(x), Math.round(ground + height), Math.round(z)));
    if (block && !isRail(block.kind)) return false;
  }
  position.set(x, ground, z);
  return true;
}

function movePlane(world: World, position: Vector3, yaw: number, speed: number, dt: number, vertical: number) {
  const x = position.x - Math.sin(yaw) * speed * dt;
  const z = position.z - Math.cos(yaw) * speed * dt;
  const y = Math.min(MAX_BUILD_Y - 5, Math.max(MIN_WORLD_Y + 2, position.y + vertical * dt * 8));
  const blocks = getBlockIndex(world);
  for (const height of [0.6, 1.5]) {
    const block = blocks.get(voxelKey(Math.round(x), Math.round(y + height), Math.round(z)));
    if (block && block.kind !== BlockKind.Water) return false;
  }
  position.set(x, y, z);
  return true;
}

const railCells = new WeakMap<object, string>();

export function vehicleMovementSystem(world: World, dt: number) {
  const playerEntity = world.queryFirst(Player);
  const mount = playerEntity?.get(PlayerMount);
  const state = playerEntity?.get(PlayerState);
  const input = drivingInput();
  world.query(Vehicle, VehiclePosition, VehicleMotion, VehicleMesh).updateEach(([vehicle, position, motion, mesh], entity) => {
    const passenger = mount?.vehicle === entity && mount.kind === vehicle.kind && mount.role === 'passenger';
    if (passenger && vehicle.kind === 'plane') {
      motion.routeTime += dt;
      const angle = motion.routeTime * 0.12;
      const altitude = Math.min(11, motion.routeTime * 3);
      motion.speed = 2.4;
      motion.yaw = motion.homeYaw - angle;
      position.set(
        motion.homeX + 20 - Math.cos(angle) * 20,
        motion.homeY + altitude + Math.sin(motion.routeTime * 0.3) * Math.min(2, altitude / 5),
        motion.homeZ - Math.sin(angle) * 20,
      );
    } else if (passenger && vehicle.kind === 'train') {
      motion.routeTime += dt;
      const cycle = (motion.routeTime * 4) % 80;
      const offset = cycle < 20 ? cycle : cycle < 60 ? 40 - cycle : cycle - 80;
      const x = motion.homeX - Math.sin(motion.homeYaw) * offset;
      const z = motion.homeZ - Math.cos(motion.homeYaw) * offset;
      motion.speed = 4;
      motion.yaw = motion.homeYaw + (cycle < 40 ? 0 : Math.PI);
      position.set(x, groundAt(world, x, z, position.y + 1.5), z);
    } else {
      const active = mount?.vehicle === entity && mount.kind === vehicle.kind && mount.role === 'driver' && state;
      const target = active ? input.forward * (input.forward < 0 ? 5 : vehicle.kind === 'car' ? 14 : vehicle.kind === 'plane' ? 18 : 12) : 0;
      motion.speed += Math.max(-20 * dt, Math.min(20 * dt, target - motion.speed));
      if (Math.abs(motion.speed) < 0.03) motion.speed = 0;
      if (active) {
        motion.yaw = state.yaw;
        if (input.strafe !== 0) motion.yaw -= input.strafe * dt * 1.4 * Math.sign(motion.speed || 1);
      }
      if (vehicle.kind === 'plane') {
        const vertical = active ? Number(isDown('Space')) - Number(isDown('KeyC')) : 0;
        if ((motion.speed !== 0 || vertical !== 0) && !movePlane(world, position, motion.yaw, motion.speed, dt, vertical)) motion.speed = 0;
      } else if (motion.speed !== 0 && !moveMount(world, position, motion.yaw, motion.speed, dt, vehicle.kind === 'train' ? 2.55 : 1.55)) {
        motion.speed = 0;
      }
    }
    if (vehicle.kind === 'train') {
      const cell = `${Math.round(position.x)},${Math.round(position.z)}`;
      if (railCells.get(motion) !== cell) {
        railCells.set(motion, cell);
        for (let offset = 0; offset < 4; offset += 1) {
          ensureTrainTrack(world, position.x - Math.sin(motion.yaw) * offset, position.z - Math.cos(motion.yaw) * offset, motion.yaw, position.y + 4);
        }
      }
    }
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
    motion.displayYaw = turnToward(motion.displayYaw, motion.yaw, dt * 7);
    if (mesh.value) {
      mesh.value.position.copy(position);
      mesh.value.rotation.y = motion.displayYaw;
    }
  });
}
