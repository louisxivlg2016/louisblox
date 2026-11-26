import type { Entity, World } from 'koota';
import { chunkCoordinate, getBlockIndex, getWorldSeed, loadChunk } from '../chunks';
import { turnToward } from '../rotation';
import { BlockKind, voxelKey } from '../voxel';
import { clearRoute, findPath, routeDirection, walkableGround } from './traderNavigation';
import { CamelLeash, AnimalMesh, AnimalMotion, AnimalPosition, Environment, HorseRider, Player, PlayerBody, PlayerMount, PlayerPosition, Trader, TraderMesh, TraderPosition } from '../traits';
import { getFireSources, nearestFire } from '../hazards';
import { useTradeStore } from '../trading';
import { useGameStore } from '../store';
import { nearestVillageAt, tradeCityAt } from '../villages';
import { updateMerchantRestaurant, updateVillageSleep } from '../villageLife';
import { animalSeatOffset } from '../mounts';
import { translate } from '../language';
import { useNavigationStore } from '../navigation';
import { changeInventory } from '../inventory';
import { DAY_DURATION } from '../dayNight';

const foliage = new Set<BlockKind>([BlockKind.Leaves, BlockKind.PineLeaves, BlockKind.AutumnLeaves, BlockKind.JungleLeaves, BlockKind.JungleVine, BlockKind.Apple]);
const stuckCamels = new Map<Entity, { x: number; z: number; time: number }>();
const stuckTraders = new Map<Entity, { x: number; z: number; time: number }>();
const obstacleDetours = new Set<Entity>();
const traderPaths = new Map<Entity, Array<{ x: number; y: number; z: number }>>();
const villageGiftDays = new WeakMap<World, Map<string, number>>();

function offerVillageGift(world: World, entity: Entity, player: import('three').Vector3) {
  const trader = entity.get(Trader)!;
  const position = entity.get(TraderPosition)!;
  if (!trader.villager || position.distanceToSquared(player) > 5 * 5) return;
  const site = nearestVillageAt(position.x, position.z, getWorldSeed(world));
  const key = `${site?.x ?? trader.homeX},${site?.z ?? trader.homeZ}`;
  const day = Math.floor((world.queryFirst(Environment)?.get(Environment)?.elapsed ?? 0) / DAY_DURATION);
  let gifts = villageGiftDays.get(world);
  if (!gifts) {
    gifts = new Map();
    villageGiftDays.set(world, gifts);
  }
  if (gifts.get(key) === day) return;
  gifts.set(key, day);
  changeInventory('bread', 2);
  useGameStore.getState().setNotice(translate('Villageois : Bienvenue ! Tiens, deux pains pour ton voyage. Ils sont dans tes cases.', 'Villager: Welcome! Here are two breads for your journey. They are in your slots.'));
}

function moveOnGround(_world: World, position: import('three').Vector3, x: number, z: number, ground: number) {
  position.set(x, ground, z);
}

function rescueTrader(world: World, position: import('three').Vector3, yaw: number) {
  for (const distance of [1.5, 2.5, 3.5, 4.5]) {
    for (const side of [1, -1]) {
      const x = position.x + Math.cos(yaw) * side * distance;
      const z = position.z - Math.sin(yaw) * side * distance;
      const path = findPath(world, position, x, z);
      if (!path || path.length === 0) continue;
      const next = path[0];
      if (walkableGround(world, next.x, next.z, position.y, 1.05, true) === null) continue;
      position.set(next.x, next.y, next.z);
      return true;
    }
  }
  return false;
}

function rescueCamel(world: World, trader: import('three').Vector3, position: import('three').Vector3, motion: { yaw: number; displayYaw: number }, heading: number) {
  const offsets = [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [0, 0], [2, 2], [-2, 2], [2, -2], [-2, -2]];
  for (const [dx, dz] of offsets) {
    const x = Math.round(trader.x + dx);
    const z = Math.round(trader.z + dz);
    const ground = walkableGround(world, x, z, trader.y, 1.05, true);
    if (ground === null) continue;
    const distance = Math.hypot(x - position.x, z - position.z);
    if (distance > 0.01 && !clearRoute(world, position.x, position.y, position.z, Math.atan2(x - position.x, z - position.z), Math.ceil(distance))) continue;
    position.set(x, ground, z);
    motion.yaw = heading;
    motion.displayYaw = heading;
    return true;
  }
  return false;
}

function treeNearby(world: World, position: { x: number; y: number; z: number }, radius: number) {
  const blocks = getBlockIndex(world);
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dy = -2; dy <= 5; dy += 1) {
        const block = blocks.get(voxelKey(Math.round(position.x + dx), Math.round(position.y + dy), Math.round(position.z + dz)));
        if (block && foliage.has(block.kind)) return true;
      }
    }
  }
  return false;
}

function treeAhead(world: World, position: import('three').Vector3, yaw: number) {
  for (let step = 1; step <= 4; step += 1) {
    if (treeNearby(world, { x: position.x + Math.sin(yaw) * step, y: position.y, z: position.z + Math.cos(yaw) * step }, 1)) return true;
  }
  return false;
}

function separateCamel(world: World, entity: Entity, position: import('three').Vector3, dt: number) {
  const leash = entity.get(CamelLeash)!;
  for (const other of world.query(CamelLeash, AnimalPosition)) {
    if (other === entity) continue;
    const otherPosition = other.get(AnimalPosition)!;
    let dx = position.x - otherPosition.x;
    let dz = position.z - otherPosition.z;
    let distance = Math.hypot(dx, dz);
    if (distance >= 2.4) continue;
    if (distance < 0.001) {
      dx = leash.order % 2 === 0 ? 1 : -1;
      dz = 0;
      distance = 1;
    }
    const step = Math.min(2.4 - distance, Math.max(0.025, dt * 3));
    const x = position.x + dx / distance * step;
    const z = position.z + dz / distance * step;
    const ground = walkableGround(world, x, z, position.y, 1.05, true);
    if (ground === null) continue;
    moveOnGround(world, position, x, z, ground);
    return true;
  }
  return false;
}

const restaurantPaths = new Map<Entity, { key: string; points: Array<{ x: number; y: number; z: number }> }>();

function guideRestaurantTravel(world: World, entity: Entity, dt: number) {
  const trader = entity.get(Trader)!;
  const position = entity.get(TraderPosition)!;
  const mesh = entity.get(TraderMesh)!.value;
  const key = `${trader.targetX},${trader.targetZ}`;
  let path = restaurantPaths.get(entity);
  if (path?.key !== key) {
    restaurantPaths.delete(entity);
    path = undefined;
  }
  if (path && Math.hypot(path.points[0].x - position.x, path.points[0].z - position.z) < 0.16) {
    path.points.shift();
    if (path.points.length === 0) {
      restaurantPaths.delete(entity);
      path = undefined;
    }
  }
  if (!path) {
    const points = findPath(world, position, trader.targetX, trader.targetZ, false);
    if (!points || points.length === 0) return;
    path = { key, points };
    restaurantPaths.set(entity, path);
  }
  const waypoint = path.points[0];
  const dx = waypoint.x - position.x;
  const dz = waypoint.z - position.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.001) return;
  const step = Math.min(distance, dt * 2.6);
  const x = position.x + dx / distance * step;
  const z = position.z + dz / distance * step;
  const ground = walkableGround(world, x, z, position.y);
  if (ground === null) {
    restaurantPaths.delete(entity);
    return;
  }
  moveOnGround(world, position, x, z, ground);
  entity.set(Trader, { walking: true });
  if (mesh) {
    mesh.position.copy(position);
    mesh.rotation.y = turnToward(mesh.rotation.y, Math.atan2(dx, dz), dt * 5);
  }
}

const tradeCityPreloads = new WeakMap<World, { key: string; index: number }>();
const destinationSearches = new WeakMap<World, Map<Entity, number>>();

export function preloadTradeCity(world: World, x: number, z: number, count = 1) {
  const centerX = chunkCoordinate(x);
  const centerZ = chunkCoordinate(z);
  const key = `${centerX},${centerZ}`;
  let task = tradeCityPreloads.get(world);
  if (!task || task.key !== key) {
    task = { key, index: 0 };
    tradeCityPreloads.set(world, task);
  }
  const offsets = [] as Array<{ x: number; z: number }>;
  for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) offsets.push({ x: centerX + dx, z: centerZ + dz });
  offsets.sort((a, b) => Math.abs(a.x - centerX) + Math.abs(a.z - centerZ) - (Math.abs(b.x - centerX) + Math.abs(b.z - centerZ)));
  for (let index = 0; index < count && task.index < offsets.length; index += 1) {
    const chunk = offsets[task.index];
    task.index += 1;
    loadChunk(world, chunk.x, chunk.z);
  }
  return task.index >= offsets.length;
}

function traderHeading(trader: { homeX: number; homeZ: number }) {
  const angle = trader.homeX * 0.17 + trader.homeZ * 0.31;
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function traderSystem(world: World, dt: number) {
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  if (!player) return;
  const fires = getFireSources(world);
  const conversation = useTradeStore.getState();
  const talkingTo = conversation.open ? conversation.traderId : null;
  for (const entity of world.query(Trader, TraderPosition, TraderMesh)) {
    const trader = entity.get(Trader)!;
    const position = entity.get(TraderPosition)!;
    const mesh = entity.get(TraderMesh)!;
    if (mesh.value) mesh.value.visible = trader.following || position.distanceToSquared(player) < 64 * 64;
    if (updateVillageSleep(world, entity, dt, talkingTo)) continue;
    offerVillageGift(world, entity, player);
    if (updateMerchantRestaurant(world, entity, dt, talkingTo)) continue;
    if (talkingTo === entity) {
      if (trader.walking) entity.set(Trader, { walking: false });
      if (mesh.value) mesh.value.rotation.y = turnToward(mesh.value.rotation.y, Math.atan2(player.x - position.x, player.z - position.z), dt * 4);
      continue;
    }
    if (trader.restaurantMeal) {
      guideRestaurantTravel(world, entity, dt);
      continue;
    }
    if ((trader.villager || trader.arrived) && !trader.restaurantMeal) {
      const homeX = trader.arrived ? trader.destinationX ?? trader.homeX : trader.homeX;
      const homeZ = trader.arrived ? trader.destinationZ ?? trader.homeZ : trader.homeZ;
      let dx = trader.targetX - position.x;
      let dz = trader.targetZ - position.z;
      let distance = Math.hypot(dx, dz);
      if (distance < 0.35) {
        if (!treeNearby(world, position, 6)) {
          entity.set(Trader, { walking: false, targetX: position.x, targetZ: position.z });
          continue;
        }
        trader.phase += 1;
        trader.targetX = homeX + Math.sin(trader.phase * 1.7 + homeX) * 2.2;
        trader.targetZ = homeZ + Math.cos(trader.phase * 1.7 + homeZ) * 2.2;
        dx = trader.targetX - position.x;
        dz = trader.targetZ - position.z;
        distance = Math.hypot(dx, dz);
      }
      if (distance > 0.001) {
        const step = Math.min(distance, dt * 0.85);
        const ground = walkableGround(world, position.x + dx / distance * step, position.z + dz / distance * step, position.y, 1.05, true);
        if (ground !== null) moveOnGround(world, position, position.x + dx / distance * step, position.z + dz / distance * step, ground);
        else {
          trader.phase += 0.8;
          trader.targetX = homeX + Math.sin(trader.phase * 1.7 + homeX) * 2.2;
          trader.targetZ = homeZ + Math.cos(trader.phase * 1.7 + homeZ) * 2.2;
        }
      }
      if (mesh.value) {
        mesh.value.position.copy(position);
        mesh.value.rotation.y = turnToward(mesh.value.rotation.y, Math.atan2(dx, dz), dt * 5);
      }
      entity.set(Trader, { walking: distance > 0.03, phase: trader.phase, targetX: trader.targetX, targetZ: trader.targetZ });
      continue;
    }
    if (conversation.traderId === entity && conversation.following !== trader.following) entity.set(Trader, { following: conversation.following });
    const fire = nearestFire(fires, position);
    trader.panic = fire ? Math.max(trader.panic, 0.5) : Math.max(0, trader.panic - dt);
    const heading = traderHeading(trader);
    const following = !fire && (trader.following || position.distanceToSquared(player) > 18 * 18);
    if (fire) {
      traderPaths.delete(entity);
      obstacleDetours.delete(entity);
      const dx = position.x - fire.x;
      const dz = position.z - fire.z;
      const length = Math.hypot(dx, dz);
      const escapeX = length > 0.001 ? dx / length : Math.sin(heading);
      const escapeZ = length > 0.001 ? dz / length : Math.cos(heading);
      trader.targetX = position.x + escapeX * 10;
      trader.targetZ = position.z + escapeZ * 10;
    }
    if (trader.following && !fire) {
      if (trader.destinationX === null || trader.destinationZ === null) {
        const destination = nearestVillageAt(position.x, position.z, getWorldSeed(world)) ?? tradeCityAt(getWorldSeed(world));
        trader.destinationX = destination.x;
        trader.destinationZ = destination.z;
      }
      let remaining = Math.hypot(trader.destinationX - position.x, trader.destinationZ - position.z);
      let searches = destinationSearches.get(world);
      if (!searches) {
        searches = new Map<Entity, number>();
        destinationSearches.set(world, searches);
      }
      const now = performance.now();
      if (now - (searches.get(entity) ?? 0) >= 1500) {
        searches.set(entity, now);
        const destination = nearestVillageAt(position.x, position.z, getWorldSeed(world));
        if (destination) {
          const distance = Math.hypot(destination.x - position.x, destination.z - position.z);
          const changed = destination.x !== trader.destinationX || destination.z !== trader.destinationZ;
          if (changed && (distance + 8 < remaining || distance <= 24)) {
            trader.destinationX = destination.x;
            trader.destinationZ = destination.z;
            trader.targetX = destination.x;
            trader.targetZ = destination.z;
            trader.detourX = null;
            trader.detourZ = null;
            trader.detourIn = 0;
            traderPaths.delete(entity);
            remaining = distance;
            if (conversation.traderId === entity) useNavigationStore.getState().setCaravanDestination(destination.x, destination.z);
          }
        }
      }
      if (remaining < 96) preloadTradeCity(world, trader.destinationX, trader.destinationZ, 2);
      if (remaining <= 2.2) {
        entity.set(Trader, { following: false, arrived: true, walking: false, targetX: trader.destinationX, targetZ: trader.destinationZ });
        if (conversation.traderId === entity) useTradeStore.setState({ following: false });
        useNavigationStore.getState().clearCaravanDestination();
        useGameStore.getState().setNotice(translate('La caravane est arrivée ! Le marchand t’invite au restaurant du village. Parle-lui pour manger.', 'The caravan has arrived! The trader invites you to the village restaurant. Talk to him to eat.'));
        continue;
      }
      trader.detourIn = Math.max(0, trader.detourIn - dt);
      if (trader.detourX !== null && trader.detourZ !== null && Math.hypot(trader.detourX - position.x, trader.detourZ - position.z) < 0.5) trader.detourIn = 0;
      if (trader.detourIn <= 0) obstacleDetours.delete(entity);
      if (trader.detourIn <= 0 && remaining > 14 && treeAhead(world, position, Math.atan2(trader.destinationX - position.x, trader.destinationZ - position.z))) {
        trader.phase += 30;
        const route = Math.atan2(trader.destinationX - position.x, trader.destinationZ - position.z);
        const bend = Math.sin(trader.phase * 0.11 + heading) * 0.75;
        const direction = routeDirection(world, position, route + bend);
        if (direction !== undefined) {
          trader.detourX = position.x + Math.sin(direction) * 10;
          trader.detourZ = position.z + Math.cos(direction) * 10;
          trader.detourIn = 8;
        }
      }
      if (trader.detourIn > 0 && trader.detourX !== null && trader.detourZ !== null) {
        trader.targetX = trader.detourX;
        trader.targetZ = trader.detourZ;
      } else {
        trader.detourX = null;
        trader.detourZ = null;
        trader.targetX = trader.destinationX;
        trader.targetZ = trader.destinationZ;
      }
      if (position.distanceToSquared(player) > 20 * 20) {
        entity.set(Trader, { walking: false, targetX: trader.targetX, targetZ: trader.targetZ });
        if (mesh.value) mesh.value.rotation.y = turnToward(mesh.value.rotation.y, Math.atan2(player.x - position.x, player.z - position.z), dt * 4);
        continue;
      }
    } else if (following) {
      trader.targetX = player.x - Math.sin(heading) * 2.5;
      trader.targetZ = player.z - Math.cos(heading) * 2.5;
    }
    let path = traderPaths.get(entity);
    if (path && Math.hypot(path[0].x - position.x, path[0].z - position.z) < 0.15) {
      path.shift();
      if (path.length === 0) {
        traderPaths.delete(entity);
        path = undefined;
      }
    }
    if (path) {
      trader.targetX = path[0].x;
      trader.targetZ = path[0].z;
      trader.detourIn = Math.max(trader.detourIn, 1);
      obstacleDetours.delete(entity);
    }
    let dx = trader.targetX - position.x;
    let dz = trader.targetZ - position.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 0.7 && !trader.following && !path && !trader.restaurantMeal) {
      trader.phase += 30;
      const turn = Math.sin(trader.phase * 0.11 + heading) * 0.9;
      const direction = routeDirection(world, position, heading + turn);
      if (direction !== undefined) {
        trader.targetX = position.x + Math.sin(direction) * 10;
        trader.targetZ = position.z + Math.cos(direction) * 10;
      }
    }
    if (distance > 0.001) {
      let step = Math.min(distance, dt * (trader.panic > 0 ? 3.2 : following ? trader.following ? 7.2 : 5.5 : 1.05), 0.35);
      const forward = fire ? Math.atan2(position.x - fire.x, position.z - fire.z) : Math.atan2(dx, dz);
      const forwardGround = walkableGround(world, position.x + Math.sin(forward) * 1.2, position.z + Math.cos(forward) * 1.2, position.y, 1.05, true);
      let ground = forwardGround === null ? null : walkableGround(world, position.x + dx / distance * step, position.z + dz / distance * step, position.y, 1.05, true);
      if (ground === null) {
        if (path) {
          traderPaths.delete(entity);
          path = undefined;
        }
        const found = findPath(world, position, trader.targetX, trader.targetZ);
        if (found && found.length > 0) {
          path = found;
          traderPaths.set(entity, path);
          obstacleDetours.delete(entity);
          trader.targetX = path[0].x;
          trader.targetZ = path[0].z;
          dx = trader.targetX - position.x;
          dz = trader.targetZ - position.z;
          distance = Math.hypot(dx, dz);
          step = Math.min(distance, dt * (trader.panic > 0 ? 3.2 : following ? trader.following ? 7.2 : 5.5 : 1.05), 0.35);
        }
      }
      if (path) ground = walkableGround(world, position.x + dx / distance * step, position.z + dz / distance * step, position.y, 1.05, true);
      const x = position.x + dx / distance * step;
      const z = position.z + dz / distance * step;
      if (ground !== null) {
        moveOnGround(world, position, x, z, ground);
        if (mesh.value) {
          mesh.value.position.copy(position);
          mesh.value.rotation.y = turnToward(mesh.value.rotation.y, Math.atan2(dx, dz), dt * 4);
        }
      } else {
        const side = Math.sin(trader.homeX + trader.homeZ) >= 0 ? 1 : -1;
        const escape = fire ? Math.atan2(position.x - fire.x, position.z - fire.z) : Math.atan2(dx, dz);
        const candidates = [escape + side * 0.45, escape - side * 0.45, escape + side * 0.9, escape - side * 0.9, escape + side * 1.35, escape - side * 1.35, escape + side * Math.PI / 2, escape - side * Math.PI / 2, escape + side * 2.05, escape - side * 2.05];
        const nextYaw = candidates.find((yaw) => clearRoute(world, position.x, position.y, position.z, yaw, 4));
        if (nextYaw !== undefined) {
          const escapeGround = walkableGround(world, position.x + Math.sin(nextYaw) * step, position.z + Math.cos(nextYaw) * step, position.y, 1.05, true);
          if (escapeGround !== null) {
            moveOnGround(world, position, position.x + Math.sin(nextYaw) * step, position.z + Math.cos(nextYaw) * step, escapeGround);
            if (mesh.value) {
              mesh.value.position.copy(position);
              mesh.value.rotation.y = turnToward(mesh.value.rotation.y, nextYaw, dt * 4);
            }
          }
          if (!obstacleDetours.has(entity)) {
            trader.detourX = position.x + Math.sin(nextYaw) * 6;
            trader.detourZ = position.z + Math.cos(nextYaw) * 6;
            trader.detourIn = 3.5;
            trader.targetX = trader.detourX;
            trader.targetZ = trader.detourZ;
            obstacleDetours.add(entity);
          }
        } else if (!fire && !obstacleDetours.has(entity)) {
          trader.detourX = position.x + Math.sin(escape + Math.PI) * 6;
          trader.detourZ = position.z + Math.cos(escape + Math.PI) * 6;
          trader.detourIn = 3.5;
          trader.targetX = trader.detourX;
          trader.targetZ = trader.detourZ;
          obstacleDetours.add(entity);
        }
      }
    }
    if (distance > 0.7) {
      const stuck = stuckTraders.get(entity) ?? { x: position.x, z: position.z, time: 0 };
      if (Math.hypot(position.x - stuck.x, position.z - stuck.z) > 1) {
        stuck.x = position.x;
        stuck.z = position.z;
        stuck.time = 0;
      } else stuck.time += dt;
      if (stuck.time >= 1.5) {
        const routeYaw = Math.atan2(trader.targetX - position.x, trader.targetZ - position.z);
        if (rescueTrader(world, position, routeYaw)) {
          if (mesh.value) mesh.value.position.copy(position);
          if (trader.restaurantMeal) {
            traderPaths.delete(entity);
            trader.detourX = null;
            trader.detourZ = null;
            trader.detourIn = 0;
            obstacleDetours.delete(entity);
          } else {
            trader.detourX = position.x + Math.sin(routeYaw) * 6;
            trader.detourZ = position.z + Math.cos(routeYaw) * 6;
            trader.detourIn = 3.5;
            trader.targetX = trader.detourX;
            trader.targetZ = trader.detourZ;
            obstacleDetours.add(entity);
          }
          stuck.x = position.x;
          stuck.z = position.z;
        }
        stuck.time = 0;
      }
      stuckTraders.set(entity, stuck);
    } else stuckTraders.delete(entity);
    entity.set(Trader, { walking: distance > 0.03, panic: trader.panic, phase: trader.phase, targetX: trader.targetX, targetZ: trader.targetZ, detourX: trader.detourX, detourZ: trader.detourZ, detourIn: trader.detourIn, destinationX: trader.destinationX, destinationZ: trader.destinationZ });
  }

  world.query(CamelLeash, AnimalPosition, AnimalMotion, AnimalMesh).updateEach(([leash, position, motion, mesh], entity) => {
    if (entity.get(HorseRider)?.mounted) entity.set(HorseRider, { speed: 0 });
    const trader = leash.trader?.get(TraderPosition);
    if (!trader) {
      stuckCamels.delete(entity);
      return;
    }
    if (separateCamel(world, entity, position, dt) && mesh.value) mesh.value.position.copy(position);
    if (talkingTo === leash.trader) {
      motion.speed = 0;
      return;
    }
    const leader = leash.trader?.get(Trader);
    if (leader?.sleeping) {
      motion.speed = 0;
      return;
    }
    const heading = leash.trader?.get(TraderMesh)?.value?.rotation.y ?? traderHeading(leader ?? { homeX: trader.x, homeZ: trader.z });
    const gap = 2.7 + leash.order * 2.6;
    const dx = trader.x - Math.sin(heading) * gap - position.x;
    const dz = trader.z - Math.cos(heading) * gap - position.z;
    const distance = Math.hypot(dx, dz);
    const previousX = position.x;
    const previousZ = position.z;
    if (distance > 0.001) {
      const step = Math.min(distance, dt * (leader?.following ? 8 : 1.65), 0.35);
      const x = position.x + dx / distance * step;
      const z = position.z + dz / distance * step;
      const ground = walkableGround(world, x, z, position.y, 1.05, true);
      if (ground !== null) moveOnGround(world, position, x, z, ground);
      else {
        const side = leash.order % 2 === 0 ? 1 : -1;
        const candidates = [heading + side * 0.65, heading - side * 0.65, heading + side * 1.3, heading - side * 1.3, heading + Math.PI];
        for (const yaw of candidates) {
          const sideStep = Math.min(step, 0.35);
          const sideX = position.x + Math.sin(yaw) * sideStep;
          const sideZ = position.z + Math.cos(yaw) * sideStep;
          const sideGround = walkableGround(world, sideX, sideZ, position.y, 1.05, true);
          if (sideGround === null) continue;
          moveOnGround(world, position, sideX, sideZ, sideGround);
          break;
        }
      }
    }
    const movedX = position.x - previousX;
    const movedZ = position.z - previousZ;
    const moving = Math.hypot(movedX, movedZ) > 0.0001;
    if (!moving && distance > 0.45) {
      const stuck = stuckCamels.get(entity) ?? { x: previousX, z: previousZ, time: 0 };
      if (Math.hypot(position.x - stuck.x, position.z - stuck.z) > 0.5) {
        stuck.x = position.x;
        stuck.z = position.z;
        stuck.time = 0;
      } else stuck.time += dt;
      stuckCamels.set(entity, stuck);
      if (stuck.time >= 2) {
        if (rescueCamel(world, trader, position, motion, heading)) stuckCamels.delete(entity);
        else stuck.time = 0;
      }
    } else stuckCamels.delete(entity);
    motion.yaw = moving ? Math.atan2(movedX, movedZ) : heading;
    motion.displayYaw = turnToward(motion.displayYaw, motion.yaw, dt * (leader?.following ? 12 : 5));
    motion.running = moving && leader?.following === true;
    motion.speed = moving ? leader?.following ? 8 : 1.65 : 0;
    if (mesh.value) {
      mesh.value.position.copy(position);
      mesh.value.rotation.y = motion.displayYaw;
    }
    if (player && playerEntity?.get(PlayerMount)?.vehicle === entity) {
      const offset = animalSeatOffset('camel', playerEntity.get(PlayerMount)?.role ?? 'driver', motion.yaw + Math.PI);
      player.set(position.x + offset[0], position.y + offset[1], position.z + offset[2]);
      playerEntity.get(PlayerBody)?.value?.setNextKinematicTranslation(player);
    }
  });
}
