import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { addVoxel, getBlockIndex, getColumnTop, streamChunks } from './chunks';
import { getTouchMovement, isDown } from './input';
import { MAX_BUILD_Y, MIN_WORLD_Y, SEA_LEVEL } from './levels';
import { useGameStore } from './store';
import { Animal, AnimalMesh, AnimalMotion, AnimalPosition, CamelLeash, HorseRider, Player, PlayerBody, PlayerCollider, PlayerMount, PlayerPosition, PlayerState, Trader, TraderPosition, Vehicle, VehicleHealth, VehicleMesh, VehicleMotion, VehiclePosition } from './traits';
import { BlockKind, isWaterBlock, voxelKey } from './voxel';
import { EXTRA_BLOCKS, isCrop, isGrassPlate, isRail, isSlab, isStair } from './extraBlocks';
import { turnToward } from './rotation';
import { isCollidable, moveVoxelCharacter } from './systems/collisionSystem';
import { syncVehicleMotion, syncVehicleSpawn } from './vehicleSync';
import { CABINS, canWalkInVehicle, isAnimalMount } from './vehicleTypes';
import { stopSirens } from './vehicleControls';
import { findInteractionTarget } from './interactionTargets';
import { useTradeStore } from './trading';
import { animalSeatOffset } from './mounts';
import type { Camera } from 'three';
import type { MountKind, SeatRole, VehicleKind } from './vehicleTypes';
import { translate } from './language';
import { useRadioStore } from './radio';
import { useVehicleSteeringStore } from './vehicleSteering';
export { METRO_LENGTH, PLANE_SCALE, TRAIN_LENGTH } from './vehicleTypes';

const isVehicleFoliage = (kind: BlockKind) => kind === BlockKind.Leaves || kind === BlockKind.PineLeaves || kind === BlockKind.AutumnLeaves || kind === BlockKind.JungleLeaves;

export function groundAt(world: World, x: number, z: number, fromY = MAX_BUILD_Y) {
  const bx = Math.round(x);
  const bz = Math.round(z);
  const top = getColumnTop(world, bx, bz);
  const blocks = getBlockIndex(world);
  const isGround = (y: number) => {
    const block = blocks.get(voxelKey(bx, y, bz));
    return block && !isGrassPlate(block) && !isWaterBlock(block.kind) && !isVehicleFoliage(block.kind) && block.kind !== BlockKind.JungleVine && !isCrop(block.kind) && !isRail(block.kind) && !(block.open && block.kind >= 48 && block.kind <= 79);
  };
  const surface = (y: number) => {
    const block = blocks.get(voxelKey(bx, y, bz));
    return block && isSlab(block.kind) && block.growth === 0 ? y - 0.32 : y + 0.5;
  };
  if (top !== undefined && surface(top) <= fromY && isGround(top)) return surface(top);
  for (let y = Math.min(top ?? 80, Math.floor(fromY + 0.5)); y >= MIN_WORLD_Y; y -= 1) {
    if (isGround(y)) return surface(y);
  }
  return MIN_WORLD_Y + 0.5;
}

function landingGroundAt(world: World, x: number, z: number, fromY: number) {
  const ground = groundAt(world, x, z, fromY);
  const solidGround = ground > MIN_WORLD_Y + 0.5 ? ground : groundAt(world, x, z, MAX_BUILD_Y);
  const water = getBlockIndex(world).get(voxelKey(Math.round(x), SEA_LEVEL, Math.round(z)));
  return isWaterBlock(water?.kind) ? Math.max(solidGround, SEA_LEVEL + 0.02) : solidGround;
}

export function spawnVehicle(world: World, kind: VehicleKind, x: number, y: number, z: number, color = '#d63935', yaw = 0, id = crypto.randomUUID(), freePlacement = false) {
  const spawnY = freePlacement ? y : kind === 'plane' ? groundAt(world, x, z, y + 0.01) : y;
  const entity = world.spawn(
    Vehicle({ id, color, kind }),
    VehiclePosition(new Vector3(x, spawnY, z)),
    VehicleMotion({ yaw, homeX: x, homeY: spawnY, homeZ: z, homeYaw: yaw }),
    VehicleMesh(),
    VehicleHealth(),
  );
  if (kind === 'train' || kind === 'metro') {
    for (let offset = 0; offset < 24; offset += 1) ensureTrainTrack(world, x - Math.sin(yaw) * offset, z - Math.cos(yaw) * offset, yaw, y + 4);
  }
  syncVehicleSpawn(world, entity);
  return entity;
}

function ensureTrainTrack(world: World, x: number, z: number, yaw: number, fromY: number) {
  const bx = Math.round(x);
  const bz = Math.round(z);
  const ground = groundAt(world, bx, bz, fromY);
  if (ground <= SEA_LEVEL) return;
  const y = ground + 1;
  const blocks = getBlockIndex(world);
  for (let railY = Math.floor(ground); railY <= Math.ceil(y); railY += 1) {
    const existing = blocks.get(voxelKey(bx, railY, bz));
    if (existing && isRail(existing.kind)) return;
  }
  if (blocks.has(voxelKey(bx, y, bz))) return;
  const facing = Math.abs(Math.sin(yaw)) > Math.abs(Math.cos(yaw)) ? 'east' : 'north';
  addVoxel(world, bx, y, bz, EXTRA_BLOCKS.Rail, undefined, facing);
}

export function spawnCar(world: World, x: number, y: number, z: number, color = '#d63935', yaw = 0) {
  return spawnVehicle(world, 'car', x, y, z, color, yaw);
}

export function seatOffset(kind: VehicleKind, role: SeatRole, seat = 0): [number, number, number] {
  if (kind === 'boat') return role === 'driver' ? [-0.42, 0.58, -0.3] : [0.38, 0.58, -0.3];
  if (kind === 'cannon') return [0, 0.7, 1.7];
  if (kind === 'carriage') return role === 'driver' ? [0, 1.1, -2] : [0.5, 1.04, 0.5];
  if (kind !== 'car' && kind !== 'jeep' && kind !== 'police' && kind !== 'firetruck') {
    const cabin = CABINS[kind]!;
    return role === 'driver' ? [-0.65, cabin.floor + 0.68, cabin.front + 1.1] : [0, cabin.floor + 0.55, cabin.rear - 1.2 - seat * 2];
  }
  if (kind === 'jeep') return role === 'driver' ? [-0.58, 1.05, -0.02] : [0.58, 1.05, -0.02];
  return role === 'driver' ? [-0.58, 0.65, -0.02] : [0.58, 1.05, -0.02];
}

export function vehicleLocalPosition(vehicle: Entity, local: Vector3) {
  const position = vehicle.get(VehiclePosition)!;
  const yaw = vehicle.get(VehicleMotion)?.yaw ?? 0;
  return local.clone().applyAxisAngle(new Vector3(0, 1, 0), yaw).add(position);
}

export function vehicleInteractionPosition(vehicle: Entity) {
  const kind = vehicle.get(Vehicle)?.kind ?? 'car';
  const cabin = CABINS[kind];
  if (!cabin) return vehicle.get(VehiclePosition)!.clone();
  return vehicleLocalPosition(vehicle, new Vector3(cabin.entrance[0], 0, cabin.entrance[2]));
}

export function vehicleSeatPosition(vehicle: Entity, kind: VehicleKind, role: SeatRole, seat = 0) {
  const offset = new Vector3(...seatOffset(kind, role, seat));
  if (kind === 'car' && vehicle.get(Vehicle)?.color.toLowerCase() === '#347cd0') offset.x *= -1;
  return vehicleLocalPosition(vehicle, offset);
}

export function landPlane(world: World) {
  const mount = world.queryFirst(Player)?.get(PlayerMount);
  if (!mount?.vehicle || mount.kind !== 'plane' || mount.role !== 'driver') return false;
  mount.landing = true;
  useGameStore.getState().setNotice(translate('Atterrissage en cours · Monter ou Descendre pour reprendre les commandes.', 'Landing in progress · Ascend or Descend to take control again.'));
  return true;
}

export function mountEntity(world: World, vehicle: Entity, kind: MountKind, role: SeatRole = 'driver') {
  const player = world.queryFirst(Player);
  const mount = player?.get(PlayerMount);
  if (!player || !mount || mount.vehicle) return false;
  if (!isAnimalMount(kind)) {
    const motion = vehicle.get(VehicleMotion);
    if (!motion) return false;
    if (role === 'driver' && motion.mounted) {
      useGameStore.getState().setNotice(translate('La place de conducteur est déjà prise. Choisis la place passager.', 'The driver seat is taken. Choose the passenger seat.'));
      return false;
    }
    if (role === 'driver') {
      vehicle.set(VehicleMotion, { mounted: true });
      if (player.has(PlayerState)) player.set(PlayerState, { yaw: motion.yaw });
      syncVehicleMotion(world, vehicle, true);
    }
  } else {
    const rider = vehicle.get(HorseRider);
    if (rider?.mounted && rider.passenger) {
      useGameStore.getState().setNotice(translate(`Ce ${kind === 'horse' ? 'cheval' : 'chameau'} a déjà deux cavaliers.`, `This ${kind === 'horse' ? 'horse' : 'camel'} already has two riders.`));
      return false;
    }
    const assignedRole = role === 'driver' && rider?.mounted ? 'passenger' : role;
    if (rider) {
      if (assignedRole === 'driver' && rider.mounted || assignedRole === 'passenger' && rider.passenger) {
        useGameStore.getState().setNotice(assignedRole === 'driver' ? translate('La place de conducteur est déjà prise.', 'The driver seat is already taken.') : translate('La place de passager est déjà prise.', 'The passenger seat is already taken.'));
        return false;
      }
      vehicle.set(HorseRider, { mounted: assignedRole === 'driver' || rider.mounted, passenger: assignedRole === 'passenger' || rider.passenger });
    } else vehicle.add(HorseRider({ mounted: assignedRole === 'driver', passenger: assignedRole === 'passenger' }));
    role = assignedRole;
  }
  const guidedCamel = kind === 'camel' ? vehicle.get(CamelLeash)?.trader ?? null : null;
  const leader = guidedCamel?.get(Trader);
  if (guidedCamel && leader && !leader.arrived && !leader.villager) {
    guidedCamel.set(Trader, { following: true });
    if (useTradeStore.getState().traderId === guidedCamel) useTradeStore.getState().setFollowing(true);
  }
  const walkable = !isAnimalMount(kind) && canWalkInVehicle(kind, role);
  player.get(PlayerCollider)?.value?.setEnabled(walkable);
  mount.vehicle = vehicle;
  mount.kind = kind;
  mount.role = role;
  mount.seat = isAnimalMount(kind) && role === 'passenger' ? 1 : 0;
  mount.landing = false;
  mount.cabinPosition = walkable ? new Vector3(...seatOffset(kind, role, 0)) : null;
  useGameStore.getState().setRiding(kind, role);
  if (kind === 'train' || kind === 'metro') useGameStore.setState({ cameraMode: 'first' });
  useGameStore.getState().setNotice(
    kind === 'horse' ? role === 'passenger' ? translate('Passager du cheval · E : descendre', 'Horse passenger · E: dismount') : vehicle.get(HorseRider)?.saddled ? translate('Cheval sellé · WASD : le guider · Espace : sauter · E : descendre', 'Saddled horse · WASD: guide · Space: jump · E: dismount') : translate('Cheval sans selle · WASD / flèches : le guider · Espace : sauter · E : descendre', 'Unsaddled horse · WASD / arrows: guide · Space: jump · E: dismount')
      : kind === 'camel' ? role === 'passenger' ? translate('Passager du chameau · E : descendre', 'Camel passenger · E: dismount') : guidedCamel ? translate('Chameau attaché au marchand · Il guide le trajet · E : descendre', 'Camel tied to trader · he leads the journey · E: dismount') : translate('Chameau · WASD / flèches : le guider · Espace : sauter · E : descendre', 'Camel · WASD / arrows: guide · Space: jump · E: dismount')
        : walkable ? translate('Passager · WASD / flèches : marcher dans le véhicule · E : descendre · Le véhicule reste arrêté sans conducteur.', 'Passenger · WASD / arrows: walk inside vehicle · E: exit · The vehicle stays still without a driver.')
        : role === 'passenger' ? translate('Passager · E : descendre · Le véhicule reste arrêté sans conducteur.', 'Passenger · E: exit · The vehicle stays still without a driver.')
          : kind === 'plane' ? translate('WASD : piloter · Espace/C : monter/descendre · E : sortir', 'WASD: pilot · Space/C: ascend/descend · E: exit')
            : kind === 'cannon' ? translate('Clic gauche : tirer · Caméra : viser · E : descendre', 'Left click: fire · Camera: aim · E: exit')
              : kind === 'carriage' ? translate('Cocher · WASD / flèches : guider les chevaux · E : descendre', 'Carriage driver · WASD / arrows: guide horses · E: exit')
                : translate('WASD / flèches : conduire · E : descendre', 'WASD / arrows: drive · E: exit'),
  );
  return true;
}

export function dismount(world: World) {
  const player = world.queryFirst(Player);
  const mount = player?.get(PlayerMount);
  const position = player?.get(PlayerPosition);
  const body = player?.get(PlayerBody)?.value;
  if (!player || !mount?.vehicle || !position) return false;
  stopSirens();
  player.get(PlayerCollider)?.value?.setEnabled(true);
  const vehicle = mount.vehicle;
  const vehiclePosition = isAnimalMount(mount.kind) ? vehicle.get(AnimalPosition) : vehicle.get(VehiclePosition);
  if (vehiclePosition) {
    for (let index = 0; index < 9; index++) streamChunks(world, vehiclePosition.x, vehiclePosition.z);
    const yaw = isAnimalMount(mount.kind) ? vehicle.get(AnimalMotion)?.yaw ?? 0 : vehicle.get(VehicleMotion)?.yaw ?? 0;
    const cabin = mount.kind && !isAnimalMount(mount.kind) ? CABINS[mount.kind] : undefined;
    const offsets: Array<[number, number]> = cabin ? [[cabin.entrance[0], cabin.entrance[2]], [-cabin.entrance[0], cabin.entrance[2]]] : isAnimalMount(mount.kind) ? [[1.6, 0], [-1.6, 0], [0, -1.6], [0, 1.6]] : [[2, 0], [-2, 0], [0, -3.6], [0, 3.6]];
    const blocks = getBlockIndex(world);
    let exit: { x: number; y: number; z: number } | null = null;
    for (const [side, forward] of offsets) {
      const x = vehiclePosition.x + side * Math.cos(yaw) + forward * Math.sin(yaw);
      const z = vehiclePosition.z - side * Math.sin(yaw) + forward * Math.cos(yaw);
      const ground = landingGroundAt(world, x, z, vehiclePosition.y + 3.5);
      if (Math.abs(ground - vehiclePosition.y) > 2.2) continue;
      const feet = Math.floor(ground + 0.5);
      if (isCollidable(blocks.get(voxelKey(Math.round(x), feet, Math.round(z)))) || isCollidable(blocks.get(voxelKey(Math.round(x), feet + 1, Math.round(z))))) continue;
      exit = { x, y: ground + 0.02, z };
      break;
    }
    if (exit) position.set(exit.x, exit.y, exit.z);
    else position.set(vehiclePosition.x + 1.6, landingGroundAt(world, vehiclePosition.x + 1.6, vehiclePosition.z, vehiclePosition.y + 2) + 0.02, vehiclePosition.z);
    body?.setTranslation(position, true);
  }
  if (isAnimalMount(mount.kind)) {
    const motion = vehicle.get(AnimalMotion);
    if (motion) vehicle.set(AnimalMotion, { yaw: motion.displayYaw });
    const rider = vehicle.get(HorseRider);
    vehicle.set(HorseRider, { mounted: mount.role === 'driver' ? false : rider?.mounted, passenger: mount.role === 'passenger' ? false : rider?.passenger, speed: 0 });
  } else if (mount.role === 'driver') {
    vehicle.set(VehicleMotion, { mounted: false, speed: 0 });
    syncVehicleMotion(world, vehicle, true);
  }
  mount.vehicle = null;
  mount.kind = null;
  mount.role = 'driver';
  mount.seat = 0;
  mount.landing = false;
  mount.cabinPosition = null;
  useGameStore.getState().setRiding(null);
  useGameStore.getState().setNotice('');
  return true;
}

export function vehicleInteractionSystem(world: World, camera: Camera, interact: number) {
  if (interact <= 0) return false;
  const player = world.queryFirst(Player);
  const mount = player?.get(PlayerMount);
  if (!player || !mount) return false;
  if (mount.vehicle) return dismount(world);
  const target = findInteractionTarget(world, camera, 'mount');
  if (!target) return false;
  if (isAnimalMount(target.kind)) {
    if (target.kind === 'horse' && !target.entity.get(HorseRider)?.saddled && useGameStore.getState().selected === 'saddle') return false;
    return mountEntity(world, target.entity, target.kind);
  }
  const vehicle = target.entity.get(Vehicle)!;
  useGameStore.getState().setSeatChoice({ vehicle: target.entity, kind: vehicle.kind });
  useGameStore.getState().setMode('pause');
  if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
  return true;
}

function drivingInput() {
  const touch = getTouchMovement();
  const nextTrack = useRadioStore.getState().enabled && isDown('KeyD');
  return {
    forward: Math.max(-1, Math.min(1, Number(isDown('KeyW') || isDown('ArrowUp')) - Number(isDown('KeyS') || isDown('ArrowDown')) - touch.y)),
    strafe: Math.max(-1, Math.min(1, Number(!nextTrack && (isDown('KeyD') || isDown('ArrowRight'))) - Number(isDown('KeyA') || isDown('ArrowLeft')) + touch.x)),
  };
}

function vehicleHalfExtents(kind: VehicleKind): [number, number] {
  if (kind === 'train') return [0.9, 7.6];
  if (kind === 'metro') return [1.05, 6.6];
  if (kind === 'firetruck') return [1.35, 3.2];
  if (kind === 'police') return [1.2, 2.5];
  if (kind === 'carriage') return [1.2, 2.4];
  if (kind === 'car') return [1.15, 2.35];
  if (kind === 'jeep') return [1.15, 2.25];
  return [0.9, 1.7];
}

function hitsVehicleWall(world: World, x: number, y: number, z: number, yaw: number, clearance: number, kind: VehicleKind, speed: number) {
  const blocks = getBlockIndex(world);
  const [, halfLength] = vehicleHalfExtents(kind);
  const leading = speed >= 0 ? -halfLength : halfLength;
  const points: Array<[number, number]> = [[0, leading], [0, 0]];
  const heights = [0.65];
  for (let height = 1.5; height < clearance; height += 0.85) heights.push(height);
  heights.push(clearance);
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  for (const height of heights) {
    for (const [localX, localZ] of points) {
      const pointX = x + localX * cosine + localZ * sine;
      const pointZ = z - localX * sine + localZ * cosine;
      const block = blocks.get(voxelKey(Math.round(pointX), Math.round(y + height), Math.round(pointZ)));
      if (block && isCollidable(block) && !isRail(block.kind) && !isStair(block.kind) && !isSlab(block.kind) && !isVehicleFoliage(block.kind)) {
        const stepGround = groundAt(world, pointX, pointZ, y + 1.01);
        if (height <= 0.65 && stepGround <= y + 1.01 && stepGround >= y - 0.2) continue;
        return true;
      }
    }
  }
  return false;
}

function moveMount(world: World, position: Vector3, yaw: number, speed: number, dt: number, clearance = 1.55, motion?: { velocityY: number }, kind: VehicleKind = 'car') {
  const x = position.x - Math.sin(yaw) * speed * dt;
  const z = position.z - Math.cos(yaw) * speed * dt;
  const [, halfLength] = vehicleHalfExtents(kind);
  const leading = speed >= 0 ? halfLength : -halfLength;
  const frontX = x - Math.sin(yaw) * leading;
  const frontZ = z - Math.cos(yaw) * leading;
  const ground = Math.max(groundAt(world, x, z, position.y + 0.05), groundAt(world, frontX, frontZ, position.y + 0.05));
  if (ground > position.y + 1.01) return false;
  const velocityY = motion ? Math.max(-30, motion.velocityY - 24 * dt) : 0;
  const y = ground < position.y ? Math.max(ground, position.y + velocityY * dt) : ground;
  if (hitsVehicleWall(world, x, y, z, yaw, clearance, kind, speed)) return false;
  position.set(x, y, z);
  if (motion) motion.velocityY = y === ground ? 0 : velocityY;
  return true;
}

function moveRiddenAnimal(world: World, position: Vector3, yaw: number, speed: number, dt: number, rider: { velocityY: number; grounded: boolean }, kind: 'horse' | 'camel', jump: boolean) {
  if (jump && rider.grounded) {
    rider.velocityY = 8.4;
    rider.grounded = false;
  } else rider.velocityY -= 24 * dt;
  const next = position.clone();
  const movement = moveVoxelCharacter(getBlockIndex(world), next, {
    x: -Math.sin(yaw) * speed * dt,
    y: rider.velocityY * dt,
    z: -Math.cos(yaw) * speed * dt,
  }, rider.grounded, undefined, kind === 'camel' ? 3.25 : 2.85);
  const ground = groundAt(world, next.x, next.z, next.y + 0.05);
  const blocks = getBlockIndex(world);
  const seaWater = blocks.get(voxelKey(Math.round(next.x), SEA_LEVEL, Math.round(next.z)));
  const feetWater = blocks.get(voxelKey(Math.round(next.x), Math.round(next.y), Math.round(next.z)));
  if (ground < SEA_LEVEL && next.y < SEA_LEVEL + 0.35 && isWaterBlock(seaWater?.kind) || isWaterBlock(feetWater?.kind) || feetWater?.waterlogged) return false;
  const moved = Math.hypot(next.x - position.x, next.z - position.z) > 0.000001;
  position.copy(next);
  rider.grounded = movement.grounded;
  if (movement.grounded && rider.velocityY < 0) rider.velocityY = -0.1;
  if (movement.hitCeiling) rider.velocityY = Math.min(0, rider.velocityY);
  return moved;
}

function movePlane(world: World, position: Vector3, yaw: number, speed: number, dt: number, vertical: number, landing: boolean) {
  const x = position.x - Math.sin(yaw) * speed * dt;
  const z = position.z - Math.cos(yaw) * speed * dt;
  const terrain = landingGroundAt(world, x, z, MAX_BUILD_Y);
  const ground = terrain + 0.02;
  const airborne = vertical > 0 || (!landing && position.y > terrain + 2.1);
  const nextY = position.y + vertical * dt * 8;
  const y = airborne ? Math.max(ground, Math.min(MAX_BUILD_Y - 5, nextY)) : ground;
  const blocks = getBlockIndex(world);
  for (const height of [0.6, 1.5]) {
    const block = blocks.get(voxelKey(Math.round(x), Math.round(y + height), Math.round(z)));
    if (block && !isWaterBlock(block.kind)) return false;
  }
  position.set(x, y, z);
  return landing && y <= ground + 0.001 ? 'landed' : true;
}

function moveBoat(world: World, position: Vector3, yaw: number, speed: number, dt: number) {
  const x = position.x - Math.sin(yaw) * speed * dt;
  const z = position.z - Math.cos(yaw) * speed * dt;
  const blocks = getBlockIndex(world);
  const water = blocks.get(voxelKey(Math.round(x), SEA_LEVEL, Math.round(z)));
  const above = blocks.get(voxelKey(Math.round(x), SEA_LEVEL + 1, Math.round(z)));
  if (!isWaterBlock(water?.kind) || (above && !isWaterBlock(above.kind))) return false;
  if (groundAt(world, x, z, SEA_LEVEL) >= SEA_LEVEL) return false;
  position.set(x, SEA_LEVEL + 0.55, z);
  return true;
}

const railCells = new WeakMap<object, string>();
const mountSpaceWasDown = new WeakMap<World, boolean>();

export function vehicleMovementSystem(world: World, dt: number) {
  const playerEntity = world.queryFirst(Player);
  const mount = playerEntity?.get(PlayerMount);
  const state = playerEntity?.get(PlayerState);
  const input = drivingInput();
  world.query(Vehicle, VehiclePosition, VehicleMotion, VehicleMesh).updateEach(([vehicle, position, motion, mesh], entity) => {
    const driving = mount?.vehicle === entity && mount.kind === vehicle.kind && mount.role === 'driver';
    if (motion.remote && !driving) {
      const amount = 1 - Math.exp(-dt * 14);
      position.x += (motion.remoteX - position.x) * amount;
      position.y += (motion.remoteY - position.y) * amount;
      position.z += (motion.remoteZ - position.z) * amount;
      motion.yaw = turnToward(motion.yaw, motion.remoteYaw, dt * 10);
    }
    const active = driving && state && vehicle.kind !== 'cannon';
    const landing = Boolean(active && vehicle.kind === 'plane' && mount.landing);
    const maximum = vehicle.kind === 'car' ? 14 : vehicle.kind === 'plane' ? 18 : vehicle.kind === 'boat' ? 18 : vehicle.kind === 'carriage' ? 7 : vehicle.kind === 'cannon' ? 0 : 12;
    const target = landing ? 0 : active ? input.forward * (input.forward < 0 ? 2.5 : maximum) : 0;
    motion.speed += Math.max(-20 * dt, Math.min(20 * dt, target - motion.speed));
    if (Math.abs(motion.speed) < 0.03) motion.speed = 0;
    if (driving && state) {
      const previousYaw = motion.yaw;
      if (active && input.strafe !== 0) motion.yaw -= input.strafe * dt * 1.4 * Math.sign(motion.speed || 1);
      const delta = Math.atan2(Math.sin(motion.yaw - previousYaw), Math.cos(motion.yaw - previousYaw));
      const steering = useVehicleSteeringStore.getState();
      const target = Math.max(-1, Math.min(1, delta * 45)) * Math.PI * 0.65;
      useVehicleSteeringStore.setState({ angle: turnToward(steering.angle, target, dt * 5) });
    } else {
      const steering = useVehicleSteeringStore.getState();
      useVehicleSteeringStore.setState({ angle: turnToward(steering.angle, 0, dt * 7) });
    }
    if (vehicle.kind === 'plane') {
      if (active && (isDown('Space') || isDown('KeyC'))) mount.landing = false;
      const vertical = active ? Number(isDown('Space')) - Number(isDown('KeyC')) - Number(landing) : 0;
      if (motion.speed !== 0 || vertical !== 0) {
        const movement = movePlane(world, position, motion.yaw, motion.speed, dt, vertical, landing);
        if (!movement || movement === 'landed') motion.speed = 0;
        if (movement === 'landed' && mount) {
          mount.landing = false;
          useGameStore.getState().setNotice(translate('Avion posé · E : sortir · Décoller / Monter pour repartir', 'Airplane landed · E: exit · Take off / Ascend to depart again'));
        }
      }
    } else if (vehicle.kind === 'boat') {
      if (motion.speed !== 0 && !moveBoat(world, position, motion.yaw, motion.speed, dt)) motion.speed = 0;
    } else if ((motion.speed !== 0 || position.y > groundAt(world, position.x, position.z, position.y + 0.05) + 0.001) && !moveMount(world, position, motion.yaw, motion.speed, dt, vehicle.kind === 'train' || vehicle.kind === 'metro' ? 2.55 : vehicle.kind === 'car' ? 2.3 : vehicle.kind === 'firetruck' ? 3.5 : 1.55, motion, vehicle.kind)) {
      motion.speed = 0;
    }
    if (vehicle.kind === 'train' || vehicle.kind === 'metro') {
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
    if (mesh.value) mesh.value.userData.speed = motion.speed;
    if (driving) syncVehicleMotion(world, entity);
  });

  world.query(Animal, AnimalPosition, AnimalMotion, AnimalMesh, HorseRider).updateEach(([animal, position, motion, mesh, rider], entity) => {
    if (!isAnimalMount(animal.kind) || mount?.vehicle !== entity || mount.kind !== animal.kind || !state) return;
    if (mount.role === 'passenger' && !rider.mounted) {
      mount.role = 'driver';
      mount.seat = 0;
      rider.mounted = true;
      rider.passenger = false;
      useGameStore.getState().setRiding(animal.kind, 'driver');
      useGameStore.getState().setNotice(translate('Tu es maintenant devant, aux commandes · E : descendre', 'You are now in the driver seat · E: exit'));
    }
    if (mount.role !== 'driver') return;
    if (animal.kind === 'camel' && entity.get(CamelLeash)?.trader?.get(TraderPosition)) {
      rider.speed = 0;
      return;
    }
    const target = input.forward * (input.forward < 0 ? 2.2 : animal.kind === 'camel' ? 10.5 : 12);
    rider.speed += Math.max(-10 * dt, Math.min(10 * dt, target - rider.speed));
    motion.yaw = state.yaw;
    if (input.strafe !== 0) motion.yaw -= input.strafe * dt * 1.4 * Math.sign(rider.speed || 1);
    const spaceDown = isDown('Space');
    const jump = spaceDown && !mountSpaceWasDown.get(world);
    mountSpaceWasDown.set(world, spaceDown);
    if (!moveRiddenAnimal(world, position, motion.yaw, rider.speed, dt, rider, animal.kind, jump)) rider.speed = 0;
    motion.displayYaw = motion.yaw;
    if (mesh.value) {
      mesh.value.position.copy(position);
    }
    const player = playerEntity?.get(PlayerPosition);
    if (player) {
      const offset = animalSeatOffset(animal.kind, mount.role, motion.yaw);
      player.set(position.x + offset[0], position.y + offset[1], position.z + offset[2]);
      playerEntity?.get(PlayerBody)?.value?.setNextKinematicTranslation(player);
    }
  });
}
