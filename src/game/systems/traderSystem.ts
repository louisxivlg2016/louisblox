import type { Entity, World } from 'koota';
import { getBlockIndex, getWorldSeed, isChunkLoaded } from '../chunks';
import { MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { turnToward } from '../rotation';
import { groundAt } from '../vehicles';
import { BlockKind, isWaterBlock, voxelKey } from '../voxel';
import { isCollidable } from './collisionSystem';
import { CamelLeash, AnimalMesh, AnimalMotion, AnimalPosition, HorseRider, Player, PlayerBody, PlayerMount, PlayerPosition, Trader, TraderMesh, TraderPosition } from '../traits';
import { getFireSources, nearestFire } from '../hazards';
import { useTradeStore } from '../trading';
import { useGameStore } from '../store';
import { tradeCityAt } from '../villages';
import { updateVillageSleep } from '../villageLife';

const foliage = new Set<BlockKind>([BlockKind.Leaves, BlockKind.PineLeaves, BlockKind.AutumnLeaves, BlockKind.JungleLeaves, BlockKind.JungleVine, BlockKind.Apple]);
const stuckCamels = new Map<Entity, { x: number; z: number; time: number }>();

function walkableGround(world: World, x: number, z: number, currentY: number) {
  if (!isChunkLoaded(world, x, z)) return null;
  const ground = groundAt(world, x, z, currentY + 4.05);
  if (ground <= MIN_WORLD_Y + 0.5) return null;
  const blocks = getBlockIndex(world);
  if (ground < SEA_LEVEL + 0.5) {
    const water = blocks.get(voxelKey(Math.round(x), SEA_LEVEL, Math.round(z)));
    return isWaterBlock(water?.kind) ? SEA_LEVEL + 0.05 : null;
  }
  if (ground - currentY > 4.05 || currentY - ground > 8.05) return null;
  const groundBlock = blocks.get(voxelKey(Math.round(x), Math.round(ground), Math.round(z)));
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

function rescueCamel(world: World, trader: import('three').Vector3, position: import('three').Vector3, motion: { yaw: number; displayYaw: number }, heading: number) {
  const offsets = [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [0, 0], [2, 2], [-2, 2], [2, -2], [-2, -2]];
  for (const [dx, dz] of offsets) {
    const x = Math.round(trader.x + dx);
    const z = Math.round(trader.z + dz);
    const ground = walkableGround(world, x, z, trader.y);
    if (ground === null) continue;
    position.set(x, ground, z);
    motion.yaw = heading;
    motion.displayYaw = heading;
    return true;
  }
  return false;
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
    if (talkingTo === entity) {
      if (trader.walking) entity.set(Trader, { walking: false });
      if (mesh.value) mesh.value.rotation.y = turnToward(mesh.value.rotation.y, Math.atan2(player.x - position.x, player.z - position.z), dt * 4);
      continue;
    }
    if (trader.villager || trader.arrived) {
      const homeX = trader.arrived ? trader.destinationX ?? trader.homeX : trader.homeX;
      const homeZ = trader.arrived ? trader.destinationZ ?? trader.homeZ : trader.homeZ;
      let dx = trader.targetX - position.x;
      let dz = trader.targetZ - position.z;
      let distance = Math.hypot(dx, dz);
      if (distance < 0.35) {
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
    const dx = trader.targetX - position.x;
    const dz = trader.targetZ - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.7 && !trader.following) {
      trader.phase += 30;
      trader.targetX = trader.homeX + Math.sin(heading) * trader.phase;
      trader.targetZ = trader.homeZ + Math.cos(heading) * trader.phase;
    }
    if (distance > 0.001) {
      const step = Math.min(distance, dt * (trader.panic > 0 ? 3.2 : following ? trader.following ? 5.8 : 5.5 : 1.05));
      const forward = fire ? Math.atan2(position.x - fire.x, position.z - fire.z) : Math.atan2(dx, dz);
      const forwardGround = walkableGround(world, position.x + Math.sin(forward) * 1.2, position.z + Math.cos(forward) * 1.2, position.y);
      const x = position.x + dx / distance * step;
      const z = position.z + dz / distance * step;
      const ground = forwardGround === null ? null : walkableGround(world, x, z, position.y);
      if (ground !== null) {
        moveOnGround(world, position, x, z, ground);
        if (mesh.value) {
          mesh.value.position.copy(position);
          mesh.value.rotation.y = turnToward(mesh.value.rotation.y, Math.atan2(dx, dz), dt * 4);
        }
      } else {
        const side = Math.sin(trader.homeX + trader.homeZ) >= 0 ? 1 : -1;
        const escape = fire ? Math.atan2(position.x - fire.x, position.z - fire.z) : Math.atan2(dx, dz);
        const candidates = [escape + side * 0.4, escape - side * 0.4, escape + side * 0.85, escape - side * 0.85, escape + side * 1.3, escape - side * 1.3, escape + side * Math.PI / 2, escape - side * Math.PI / 2, escape + Math.PI];
        const nextYaw = candidates.find((yaw) => walkableGround(world, position.x + Math.sin(yaw) * step, position.z + Math.cos(yaw) * step, position.y) !== null);
        if (nextYaw !== undefined) {
          const escapeGround = walkableGround(world, position.x + Math.sin(nextYaw) * step, position.z + Math.cos(nextYaw) * step, position.y);
          if (escapeGround !== null) {
            moveOnGround(world, position, position.x + Math.sin(nextYaw) * step, position.z + Math.cos(nextYaw) * step, escapeGround);
            if (mesh.value) {
              mesh.value.position.copy(position);
              mesh.value.rotation.y = turnToward(mesh.value.rotation.y, nextYaw, dt * 4);
            }
          }
          trader.detourX = position.x + Math.sin(nextYaw) * 4;
          trader.detourZ = position.z + Math.cos(nextYaw) * 4;
          trader.detourIn = 1.2;
          trader.targetX = trader.detourX;
          trader.targetZ = trader.detourZ;
        } else if (!fire) {
          trader.detourX = position.x + Math.sin(escape + Math.PI) * 4;
          trader.detourZ = position.z + Math.cos(escape + Math.PI) * 4;
          trader.detourIn = 1.2;
          trader.targetX = trader.detourX;
          trader.targetZ = trader.detourZ;
        }
      }
    }
    entity.set(Trader, { walking: distance > 0.03, panic: trader.panic, phase: trader.phase, targetX: trader.targetX, targetZ: trader.targetZ, detourX: trader.detourX, detourZ: trader.detourZ, detourIn: trader.detourIn, destinationX: trader.destinationX, destinationZ: trader.destinationZ });
  }

  world.query(CamelLeash, AnimalPosition, AnimalMotion, AnimalMesh).updateEach(([leash, position, motion, mesh], entity) => {
    if (entity.get(HorseRider)?.mounted) entity.set(HorseRider, { speed: 0 });
    const trader = leash.trader?.get(TraderPosition);
    if (!trader) {
      stuckCamels.delete(entity);
      return;
    }
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
    const gap = 1.65 + leash.order * 1.2;
    const dx = trader.x - Math.sin(heading) * gap - position.x;
    const dz = trader.z - Math.cos(heading) * gap - position.z;
    const distance = Math.hypot(dx, dz);
    const previousX = position.x;
    const previousZ = position.z;
    if (distance > 0.001) {
      const step = Math.min(distance, dt * (leader?.following ? 6.4 : 1.65));
      const x = position.x + dx / distance * step;
      const z = position.z + dz / distance * step;
      const ground = walkableGround(world, x, z, position.y);
      if (ground !== null) moveOnGround(world, position, x, z, ground);
      else {
        const side = leash.order % 2 === 0 ? 1 : -1;
        const candidates = [heading + side * 0.65, heading - side * 0.65, heading + side * 1.3, heading - side * 1.3, heading + Math.PI];
        for (const yaw of candidates) {
          const sideStep = Math.min(step, 0.35);
          const sideX = position.x + Math.sin(yaw) * sideStep;
          const sideZ = position.z + Math.cos(yaw) * sideStep;
          const sideGround = walkableGround(world, sideX, sideZ, position.y);
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
    motion.speed = moving ? leader?.following ? 6.4 : 1.65 : 0;
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
