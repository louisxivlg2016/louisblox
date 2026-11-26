import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex, getWorldSeed } from './chunks';
import { getFireSources, nearestFire } from './hazards';
import { groundAt } from './vehicles';
import { isDoor } from './extraBlocks';
import { Environment, Player, PlayerPosition, Trader, TraderMesh, TraderPosition } from './traits';
import { nightIndex } from './dayNight';
import { replaceVoxel } from './chunks';
import { restaurantAt, tradeCityAt, villageBeds } from './villages';
import { openRestaurant, useTradeStore } from './trading';
import { useGameStore } from './store';
import { findPath, walkableGround } from './systems/traderNavigation';
import { translate } from './language';

const watchWarnings = new Map<Entity, number>();
const sleepPaths = new Map<Entity, { key: string; points: Array<{ x: number; y: number; z: number }> }>();

function wake(world: World, entity: Entity) {
  const trader = entity.get(Trader);
  const position = entity.get(TraderPosition);
  const mesh = entity.get(TraderMesh)?.value;
  if (!trader || !position) return;
  const homeX = trader.arrived ? trader.destinationX ?? trader.homeX : trader.homeX;
  const homeZ = trader.arrived ? trader.destinationZ ?? trader.homeZ : trader.homeZ;
  position.set(homeX, groundAt(world, homeX, homeZ, position.y + 6) + 0.02, homeZ);
  entity.set(Trader, { sleeping: false, bedDoorReached: false, targetX: homeX, targetZ: homeZ, walking: false });
  if (mesh) {
    mesh.position.copy(position);
    mesh.rotation.x = 0;
  }
}

function openDoors(world: World, position: Vector3) {
  const blocks = getBlockIndex(world);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = Math.round(position.x + dx);
        const y = Math.round(position.y + dy);
        const z = Math.round(position.z + dz);
        const block = blocks.get(`${x},${y},${z}`);
        if (!block || !isDoor(block.kind) || block.open) continue;
        replaceVoxel(world, { block, x, y, z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, block.kind, true);
      }
    }
  }
}

export function assignMerchantBed(world: World, entity: Entity) {
  const trader = entity.get(Trader);
  if (!trader || trader.bedX !== null) return;
  const site = { x: trader.destinationX ?? trader.homeX, z: trader.destinationZ ?? trader.homeZ };
  const occupied = new Set(world.query(Trader).filter((entity) => entity.get(Trader)?.villager).map((entity) => `${entity.get(Trader)!.bedX},${entity.get(Trader)!.bedZ}`));
  const position = entity.get(TraderPosition);
  const beds = villageBeds(site, getWorldSeed(world), true).filter((candidate) => !occupied.has(`${candidate.x},${candidate.z}`));
  const available = position ? beds.sort((a, b) => Math.hypot(a.x - position.x, a.z - position.z) - Math.hypot(b.x - position.x, b.z - position.z)) : beds;
  const bed = available[0] ?? villageBeds(site, getWorldSeed(world), true)[0];
  if (bed) entity.set(Trader, { bedX: bed.x, bedY: bed.y, bedZ: bed.z });
}

export function updateVillageSleep(world: World, entity: Entity, dt: number, talkingTo: Entity | null) {
  const trader = entity.get(Trader);
  const position = entity.get(TraderPosition);
  const mesh = entity.get(TraderMesh)?.value;
  if (!trader || !position || (!trader.villager && !trader.arrived)) return false;
  if (trader.restaurantMeal) return false;
  if (trader.arrived && trader.bedX === null) assignMerchantBed(world, entity);
  const fire = nearestFire(getFireSources(world), position);
  if (talkingTo === entity || fire) {
    if (trader.sleeping) wake(world, entity);
    return false;
  }
  const dayProgress = world.queryFirst(Environment)?.get(Environment)?.dayProgress ?? 0.38;
  const night = dayProgress >= 0.78 || dayProgress < 0.22;
  if (!night) {
    if (trader.sleeping) wake(world, entity);
    return false;
  }
  if (trader.watchman) {
    const player = world.queryFirst(Player)?.get(PlayerPosition);
    if (useGameStore.getState().gameplayMode !== 'survival' || !player || position.distanceToSquared(player) >= 64) return false;
    const warningNight = nightIndex(world);
    if (watchWarnings.get(entity) !== warningNight) {
      watchWarnings.set(entity, warningNight);
      useGameStore.getState().setNotice(translate('Veilleur : Va te coucher ! Les zombies rendent la nuit dangereuse.', 'Watchman: Go to sleep! Zombies make the night dangerous.'));
    }
    entity.set(Trader, { walking: false, targetX: position.x, targetZ: position.z });
    if (mesh) mesh.rotation.y = Math.atan2(player.x - position.x, player.z - position.z);
    return true;
  }
  if (!trader.villager && !trader.restaurantInvited) {
    entity.set(Trader, { restaurantInvited: true, walking: false });
    openRestaurant();
    useTradeStore.setState({ open: true, traderId: entity, restaurantAvailable: true });
    useGameStore.getState().setMode('pause');
    if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
    return false;
  }
  if (trader.bedX === null || trader.bedY === null || trader.bedZ === null) return false;
  const doorDistance = Math.hypot(trader.bedX - position.x, trader.bedZ + 3 - position.z);
  const doorReached = trader.bedDoorReached || doorDistance <= 1.2;
  if (doorReached && !trader.bedDoorReached) entity.set(Trader, { bedDoorReached: true });
  const targetZ = position.z > trader.bedZ + 1 && !doorReached ? trader.bedZ + 3 : trader.bedZ + 0.55;
  let dx = trader.bedX - position.x;
  let dz = targetZ - position.z;
  if (Math.hypot(dx, dz) > 0.24) {
    openDoors(world, position);
    const pathKey = `${trader.bedX},${targetZ}`;
    let path = sleepPaths.get(entity);
    if (path?.key !== pathKey) {
      sleepPaths.delete(entity);
      path = undefined;
    }
    if (path && Math.hypot(path.points[0].x - position.x, path.points[0].z - position.z) < 0.16) {
      path.points.shift();
      if (path.points.length === 0) {
        sleepPaths.delete(entity);
        path = undefined;
      }
    }
    let distance = Math.hypot(dx, dz);
    let step = Math.min(distance, dt * 1.25);
    let nextX = position.x + dx / distance * step;
    let nextZ = position.z + dz / distance * step;
    let ground = walkableGround(world, nextX, nextZ, position.y);
    if (ground === null) {
      if (!path) {
        const points = findPath(world, position, trader.bedX, targetZ, false);
        if (points && points.length > 0) {
          path = { key: pathKey, points };
          sleepPaths.set(entity, path);
        }
      }
      if (path) {
        const waypoint = path.points[0];
        dx = waypoint.x - position.x;
        dz = waypoint.z - position.z;
        distance = Math.hypot(dx, dz);
        step = Math.min(distance, dt * 1.25);
        nextX = position.x + dx / distance * step;
        nextZ = position.z + dz / distance * step;
        ground = walkableGround(world, nextX, nextZ, position.y);
      }
    }
    if (ground !== null) {
      position.set(nextX, ground, nextZ);
      if (mesh) {
        mesh.position.copy(position);
        mesh.rotation.y = Math.atan2(dx, dz);
        mesh.rotation.x = 0;
      }
    }
    if (trader.sleeping) entity.set(Trader, { sleeping: false });
    entity.set(Trader, { walking: ground !== null });
    return true;
  }
  sleepPaths.delete(entity);
  position.set(trader.bedX, trader.bedY + 0.42, trader.bedZ + 0.55);
  if (!trader.sleeping || trader.walking) entity.set(Trader, { sleeping: true, walking: false });
  if (mesh) {
    mesh.position.copy(position);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.y = 0;
  }
  return true;
}

export function updateMerchantRestaurant(world: World, entity: Entity, dt: number, talkingTo: Entity | null) {
  const trader = entity.get(Trader);
  const position = entity.get(TraderPosition);
  const mesh = entity.get(TraderMesh)?.value;
  if (!trader?.restaurantMeal || trader.villager || !position) return false;
  const seed = getWorldSeed(world);
  const site = trader.destinationX !== null && trader.destinationZ !== null ? { x: trader.destinationX, z: trader.destinationZ } : tradeCityAt(seed);
  const door = restaurantAt(site, seed);
  if (trader.restaurantMeal === 'eating') {
    const restaurantMealTime = trader.restaurantMealTime + (talkingTo === entity ? 0 : dt);
    if (restaurantMealTime >= 20) {
      entity.set(Trader, { restaurantMeal: null, restaurantMealTime: 0, restaurantMessage: '', walking: false });
      if (mesh) mesh.rotation.x = 0;
      return false;
    }
    entity.set(Trader, { restaurantMealTime, walking: false });
    if (mesh) {
      mesh.position.copy(position);
      mesh.rotation.y = Math.atan2(door.x + 2 - position.x, door.z - position.z);
      mesh.rotation.x = 0;
    }
    return true;
  }
  const seat = { x: door.x + 1, y: door.y, z: door.z + 1 };
  const distance = Math.hypot(seat.x - position.x, seat.z - position.z);
  if (distance <= 0.35) {
    position.set(seat.x, seat.y, seat.z);
    entity.set(Trader, { restaurantMeal: 'eating', restaurantMealTime: 0, restaurantMessage: translate('Bon appétit ! Ce repas est délicieux. Je mange avec toi.', 'Enjoy your meal! This meal is delicious. I am eating with you.'), walking: false });
    useGameStore.getState().setNotice(translate('Le marchand est arrivé au restaurant et mange avec toi. Bon appétit !', 'The trader has arrived at the restaurant and is eating with you. Enjoy your meal!'));
    return true;
  }
  const doorDistance = Math.hypot(door.x - position.x, door.z - position.z);
  const approach = { x: door.x - 1, y: door.y, z: door.z };
  const approachDistance = Math.hypot(approach.x - position.x, approach.z - position.z);
  let restaurantStep = trader.restaurantStep;
  if (restaurantStep === 0 && approachDistance <= 0.65) restaurantStep = 1;
  if (restaurantStep === 1 && doorDistance <= 0.65) restaurantStep = 2;
  const target = restaurantStep === 0 ? approach : restaurantStep === 1 ? door : seat;
  entity.set(Trader, { targetX: target.x, targetZ: target.z, restaurantStep, walking: true });
  if (doorDistance < 4) openDoors(world, position);
  return false;
}
