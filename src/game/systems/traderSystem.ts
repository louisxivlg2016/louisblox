import type { World } from 'koota';
import { getBlockIndex, isChunkLoaded } from '../chunks';
import { MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { turnToward } from '../rotation';
import { groundAt } from '../vehicles';
import { isWaterBlock, voxelKey } from '../voxel';
import { isCollidable, moveVoxelCharacter } from './collisionSystem';
import { CamelLeash, AnimalMesh, AnimalMotion, AnimalPosition, Player, PlayerPosition, Trader, TraderMesh, TraderPosition } from '../traits';
import { getFireSources, nearestFire } from '../hazards';

function walkableGround(world: World, x: number, z: number, currentY: number) {
  if (!isChunkLoaded(world, x, z)) return null;
  const ground = groundAt(world, x, z, currentY + 1.05);
  if (ground <= MIN_WORLD_Y + 0.5 || ground < SEA_LEVEL + 0.5 || Math.abs(ground - currentY) > 1.05) return null;
  const blocks = getBlockIndex(world);
  for (const height of [0.5, 1.75]) {
    const block = blocks.get(voxelKey(Math.round(x), Math.round(ground + height), Math.round(z)));
    if (block && (isCollidable(block) || isWaterBlock(block.kind))) return null;
  }
  return ground;
}

function moveOnGround(world: World, position: import('three').Vector3, x: number, z: number, ground: number) {
  const next = position.clone();
  next.y = ground;
  moveVoxelCharacter(getBlockIndex(world), next, { x: x - position.x, y: ground - position.y, z: z - position.z }, true);
  position.copy(next);
}

function traderHeading(trader: { homeX: number; homeZ: number }) {
  const angle = trader.homeX * 0.17 + trader.homeZ * 0.31;
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function traderSystem(world: World, dt: number) {
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return;
  const fires = getFireSources(world);
  for (const entity of world.query(Trader, TraderPosition, TraderMesh)) {
    const trader = entity.get(Trader)!;
    const position = entity.get(TraderPosition)!;
    const mesh = entity.get(TraderMesh)!;
    if (position.distanceToSquared(player) > 70 * 70) continue;
    const fire = nearestFire(fires, position);
    trader.panic = fire ? Math.max(trader.panic, 0.5) : Math.max(0, trader.panic - dt);
    const heading = traderHeading(trader);
    if (fire) {
      const dx = position.x - fire.x;
      const dz = position.z - fire.z;
      const length = Math.hypot(dx, dz);
      const escapeX = length > 0.001 ? dx / length : Math.sin(heading);
      const escapeZ = length > 0.001 ? dz / length : Math.cos(heading);
      trader.targetX = position.x + escapeX * 10;
      trader.targetZ = position.z + escapeZ * 10;
    }
    const dx = trader.targetX - position.x;
    const dz = trader.targetZ - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.7) {
      trader.phase += 30;
      trader.targetX = trader.homeX + Math.sin(heading) * trader.phase;
      trader.targetZ = trader.homeZ + Math.cos(heading) * trader.phase;
    }
    if (distance > 0.001) {
      const step = Math.min(distance, dt * (trader.panic > 0 ? 1.8 : 0.75));
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
        const escape = fire ? Math.atan2(position.x - fire.x, position.z - fire.z) : heading;
        const candidates = [escape + side * 0.4, escape - side * 0.4, escape + side * 0.85, escape - side * 0.85, escape + side * 1.3, escape - side * 1.3];
        const nextYaw = candidates.find((yaw) => walkableGround(world, position.x + Math.sin(yaw) * 1.5, position.z + Math.cos(yaw) * 1.5, position.y) !== null);
        if (nextYaw !== undefined) {
          const escapeGround = walkableGround(world, position.x + Math.sin(nextYaw) * step, position.z + Math.cos(nextYaw) * step, position.y);
          if (escapeGround !== null) {
            moveOnGround(world, position, position.x + Math.sin(nextYaw) * step, position.z + Math.cos(nextYaw) * step, escapeGround);
            if (mesh.value) {
              mesh.value.position.copy(position);
              mesh.value.rotation.y = turnToward(mesh.value.rotation.y, nextYaw, dt * 4);
            }
          }
          trader.targetX = position.x + Math.sin(nextYaw) * 4;
          trader.targetZ = position.z + Math.cos(nextYaw) * 4;
        } else if (!fire) {
          trader.targetX = position.x + Math.sin(escape + side * 0.45) * 4;
          trader.targetZ = position.z + Math.cos(escape + side * 0.45) * 4;
        }
      }
    }
    entity.set(Trader, { walking: true, panic: trader.panic, phase: trader.phase, targetX: trader.targetX, targetZ: trader.targetZ });
  }

  world.query(CamelLeash, AnimalPosition, AnimalMotion, AnimalMesh).updateEach(([leash, position, motion, mesh]) => {
    const trader = leash.trader?.get(TraderPosition);
    if (!trader) return;
    const heading = leash.trader?.get(TraderMesh)?.value?.rotation.y ?? traderHeading(leash.trader?.get(Trader) ?? { homeX: trader.x, homeZ: trader.z });
    const gap = 1.65 + leash.order * 1.2;
    const dx = trader.x - Math.sin(heading) * gap - position.x;
    const dz = trader.z - Math.cos(heading) * gap - position.z;
    const distance = Math.hypot(dx, dz);
    const previousX = position.x;
    const previousZ = position.z;
    if (distance > 0.15) {
      const step = Math.min(distance, dt * 1.2);
      const x = position.x + dx / distance * step;
      const z = position.z + dz / distance * step;
      const ground = walkableGround(world, x, z, position.y);
      if (ground !== null) moveOnGround(world, position, x, z, ground);
    }
    const movedX = position.x - previousX;
    const movedZ = position.z - previousZ;
    const moving = Math.hypot(movedX, movedZ) > 0.0001;
    motion.yaw = moving ? Math.atan2(movedX, movedZ) : heading;
    motion.displayYaw = turnToward(motion.displayYaw, motion.yaw, dt * 5);
    motion.speed = moving ? 0.75 : 0;
    if (mesh.value) {
      mesh.value.position.copy(position);
      mesh.value.rotation.y = motion.displayYaw;
    }
  });
}
