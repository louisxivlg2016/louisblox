import type { Entity, World } from 'koota';
import { getBlockIndex, getWorldSeed, isChunkLoaded } from '../chunks';
import { MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { turnToward } from '../rotation';
import { groundAt } from '../vehicles';
import { BlockKind, isWaterBlock, voxelKey } from '../voxel';
import { isDoor } from '../extraBlocks';
import { isCollidable } from './collisionSystem';
import { CamelLeash, AnimalMesh, AnimalMotion, AnimalPosition, HorseRider, Player, PlayerBody, PlayerMount, PlayerPosition, Trader, TraderMesh, TraderPosition } from '../traits';
import { getFireSources, nearestFire } from '../hazards';
import { useTradeStore } from '../trading';
import { useGameStore } from '../store';
import { tradeCityAt } from '../villages';
import { updateMerchantRestaurant, updateVillageSleep } from '../villageLife';

const foliage = new Set<BlockKind>([BlockKind.Leaves, BlockKind.PineLeaves, BlockKind.AutumnLeaves, BlockKind.JungleLeaves, BlockKind.JungleVine, BlockKind.Apple]);
const stuckCamels = new Map<Entity, { x: number; z: number; time: number }>();
const stuckTraders = new Map<Entity, { x: number; z: number; time: number }>();
const obstacleDetours = new Set<Entity>();
const traderPaths = new Map<Entity, Array<{ x: number; y: number; z: number }>>();

function walkableGround(world: World, x: number, z: number, currentY: number, rise = 2.05) {
  if (!isChunkLoaded(world, x, z)) return null;
  const blocks = getBlockIndex(world);
  let ground = groundAt(world, x, z, currentY + rise);
  const overhead = blocks.get(voxelKey(Math.round(x), Math.floor(ground), Math.round(z)));
  if (overhead && foliage.has(overhead.kind) && ground > currentY + 1.05) ground = groundAt(world, x, z, currentY + 1.05);
  if (ground <= MIN_WORLD_Y + 0.5) return null;
  if (ground > currentY + 1.05) {
    const doorway = blocks.get(voxelKey(Math.round(x), Math.round(currentY + 0.5), Math.round(z)));
    if (doorway && isDoor(doorway.kind) && doorway.open) ground = groundAt(world, x, z, currentY + 0.51);
  }
  if (ground < SEA_LEVEL + 0.5) {
    const water = blocks.get(voxelKey(Math.round(x), SEA_LEVEL, Math.round(z)));
    return isWaterBlock(water?.kind) ? SEA_LEVEL + 0.05 : null;
  }
  if (ground - currentY > rise || currentY - ground > 8.05) return null;
  const groundBlock = blocks.get(voxelKey(Math.round(x), Math.floor(ground), Math.round(z)));
  if (groundBlock && foliage.has(groundBlock.kind)) return null;
  for (const height of [0.5, 1.75]) {
    const block = blocks.get(voxelKey(Math.round(x), Math.round(ground + height), Math.round(z)));
    if (block && (isCollidable(block) || isWaterBlock(block.kind))) return null;
  }
  return ground;
}

function moveOnGround(_world: World, position: import('three').Vector3, x: number, z: number, ground: number) {
  position.set(x, ground, z);
}

function clearRoute(world: World, x: number, y: number, z: number, yaw: number, distance: number) {
  for (let step = 1; step <= distance; step++) {
    if (walkableGround(world, x + Math.sin(yaw) * step, z + Math.cos(yaw) * step, y) === null) return false;
  }
  return true;
}

function routeDirection(world: World, position: import('three').Vector3, yaw: number, distance = 10) {
  const offsets = [0, 0.45, -0.45];
  return offsets.map((offset) => yaw + offset).find((candidate) => clearRoute(world, position.x, position.y, position.z, candidate, distance));
}

type PathNode = { x: number; y: number; z: number; g: number; f: number; parent: PathNode | null };

function findPath(world: World, position: import('three').Vector3, targetX: number, targetZ: number) {
  const yaw = Math.atan2(targetX - position.x, targetZ - position.z);
  let goal: { x: number; y: number; z: number } | null = null;
  if (Math.hypot(targetX - position.x, targetZ - position.z) <= 12) {
    const x = Math.round(targetX);
    const z = Math.round(targetZ);
    const ground = walkableGround(world, x, z, position.y);
    if (ground !== null) goal = { x, y: ground, z };
  }
  for (const distance of [12, 18, 24]) {
    if (goal) break;
    const x = Math.round(position.x + Math.sin(yaw) * distance);
    const z = Math.round(position.z + Math.cos(yaw) * distance);
    const ground = walkableGround(world, x, z, position.y);
    if (ground !== null) {
      goal = { x, y: ground, z };
      break;
    }
  }
  if (!goal) return null;
  const start = { x: Math.round(position.x), z: Math.round(position.z) };
  const heuristic = (x: number, z: number) => Math.abs(goal.x - x) + Math.abs(goal.z - z);
  const open: PathNode[] = [{ x: start.x, y: position.y, z: start.z, g: 0, f: heuristic(start.x, start.z), parent: null }];
  const best = new Map<string, number>([[`${start.x},${start.z}`, 0]]);
  const closed = new Set<string>();
  let visited = 0;
  while (open.length > 0 && visited < 1200) {
    let bestIndex = 0;
    for (let index = 1; index < open.length; index++) if (open[index].f < open[bestIndex].f) bestIndex = index;
    const current = open.splice(bestIndex, 1)[0];
    const key = `${current.x},${current.z}`;
    if (closed.has(key)) continue;
    closed.add(key);
    visited++;
    if (current.x === goal.x && current.z === goal.z) {
      const path: Array<{ x: number; y: number; z: number }> = [];
      let cursor: PathNode | null = current;
      while (cursor?.parent) {
        path.unshift({ x: cursor.x, y: cursor.y, z: cursor.z });
        cursor = cursor.parent;
      }
      return path;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = current.x + dx;
      const z = current.z + dz;
      if (Math.abs(x - start.x) > 26 || Math.abs(z - start.z) > 26) continue;
      const ground = walkableGround(world, x, z, current.y);
      if (ground === null) continue;
      const neighborKey = `${x},${z}`;
      if (closed.has(neighborKey)) continue;
      const g = current.g + 1;
      if (g >= (best.get(neighborKey) ?? Infinity)) continue;
      best.set(neighborKey, g);
      open.push({ x, y: ground, z, g, f: g + heuristic(x, z), parent: current });
    }
  }
  return null;
}

function rescueTrader(world: World, position: import('three').Vector3, yaw: number) {
  for (const distance of [1.5, 2.5, 3.5, 4.5]) {
    for (const side of [1, -1]) {
      const x = position.x + Math.cos(yaw) * side * distance;
      const z = position.z - Math.sin(yaw) * side * distance;
      const ground = walkableGround(world, x, z, position.y);
      if (ground === null) continue;
      if (!clearRoute(world, x, ground, z, yaw, 4)) continue;
      position.set(x, ground, z);
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
    const ground = walkableGround(world, x, z, trader.y, 4.05);
    if (ground === null) continue;
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
    const ground = walkableGround(world, x, z, position.y, 4.05);
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
    const points = findPath(world, position, trader.targetX, trader.targetZ);
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
        const ground = walkableGround(world, position.x + dx / distance * step, position.z + dz / distance * step, position.y);
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
        const destination = tradeCityAt(getWorldSeed(world));
        trader.destinationX = destination.x;
        trader.destinationZ = destination.z;
      }
      const remaining = Math.hypot(trader.destinationX - position.x, trader.destinationZ - position.z);
      if (remaining <= 2.2) {
        entity.set(Trader, { following: false, arrived: true, walking: false, targetX: trader.destinationX, targetZ: trader.destinationZ });
        if (conversation.traderId === entity) useTradeStore.setState({ following: false });
        useGameStore.getState().setNotice('La caravane est arrivée ! Le marchand t’invite au restaurant du village. Parle-lui pour manger.');
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
      let step = Math.min(distance, dt * (trader.panic > 0 ? 3.2 : following ? trader.following ? 7.2 : 5.5 : 1.05));
      const forward = fire ? Math.atan2(position.x - fire.x, position.z - fire.z) : Math.atan2(dx, dz);
      const forwardGround = walkableGround(world, position.x + Math.sin(forward) * 1.2, position.z + Math.cos(forward) * 1.2, position.y);
      let ground = forwardGround === null ? null : walkableGround(world, position.x + dx / distance * step, position.z + dz / distance * step, position.y);
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
          step = Math.min(distance, dt * (trader.panic > 0 ? 3.2 : following ? trader.following ? 7.2 : 5.5 : 1.05));
        }
      }
      if (path) ground = walkableGround(world, position.x + dx / distance * step, position.z + dz / distance * step, position.y);
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
          const escapeGround = walkableGround(world, position.x + Math.sin(nextYaw) * step, position.z + Math.cos(nextYaw) * step, position.y);
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
      const step = Math.min(distance, dt * (leader?.following ? 8 : 1.65));
      const x = position.x + dx / distance * step;
      const z = position.z + dz / distance * step;
      const ground = walkableGround(world, x, z, position.y, 4.05);
      if (ground !== null) moveOnGround(world, position, x, z, ground);
      else {
        const side = leash.order % 2 === 0 ? 1 : -1;
        const candidates = [heading + side * 0.65, heading - side * 0.65, heading + side * 1.3, heading - side * 1.3, heading + Math.PI];
        for (const yaw of candidates) {
          const sideStep = Math.min(step, 0.35);
          const sideX = position.x + Math.sin(yaw) * sideStep;
          const sideZ = position.z + Math.cos(yaw) * sideStep;
          const sideGround = walkableGround(world, sideX, sideZ, position.y, 4.05);
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
      player.set(position.x + Math.sin(motion.yaw) * 0.3, position.y + 1.4, position.z + Math.cos(motion.yaw) * 0.3);
      playerEntity.get(PlayerBody)?.value?.setNextKinematicTranslation(player);
    }
  });
}
