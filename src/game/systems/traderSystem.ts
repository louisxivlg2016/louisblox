import type { World } from 'koota';
import { getBlockIndex } from '../chunks';
import { MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { turnToward } from '../rotation';
import { groundAt } from '../vehicles';
import { isWaterBlock, voxelKey } from '../voxel';
import { isCollidable } from './collisionSystem';
import { CamelLeash, AnimalMesh, AnimalMotion, AnimalPosition, Player, PlayerPosition, Trader, TraderMesh, TraderPosition } from '../traits';

function walkableGround(world: World, x: number, z: number, currentY: number) {
  const ground = groundAt(world, x, z, currentY + 1.05);
  if (ground <= MIN_WORLD_Y + 0.5 || ground < SEA_LEVEL + 0.5 || Math.abs(ground - currentY) > 1.05) return null;
  const blocks = getBlockIndex(world);
  for (const height of [0.5, 1.75]) {
    const block = blocks.get(voxelKey(Math.round(x), Math.round(ground + height), Math.round(z)));
    if (block && (isCollidable(block) || isWaterBlock(block.kind))) return null;
  }
  return ground;
}

function traderHeading(trader: { homeX: number; homeZ: number }) {
  const angle = trader.homeX * 0.17 + trader.homeZ * 0.31;
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function traderSystem(world: World, dt: number) {
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return;
  world.query(Trader, TraderPosition, TraderMesh).updateEach(([trader, position, mesh]) => {
    if (position.distanceToSquared(player) > 70 * 70) return;
    trader.walking = true;
    const heading = traderHeading(trader);
    const dx = trader.targetX - position.x;
    const dz = trader.targetZ - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.7) {
      trader.phase += 30;
      trader.targetX = trader.homeX + Math.sin(heading) * trader.phase;
      trader.targetZ = trader.homeZ + Math.cos(heading) * trader.phase;
    }
    if (distance > 0.001) {
      const step = Math.min(distance, dt * 0.75);
      const x = position.x + dx / distance * step;
      const z = position.z + dz / distance * step;
      const ground = walkableGround(world, x, z, position.y);
      if (ground !== null) {
        position.set(x, ground, z);
        if (mesh.value) {
          mesh.value.position.copy(position);
          mesh.value.rotation.y = turnToward(mesh.value.rotation.y, Math.atan2(dx, dz), dt * 4);
        }
      } else {
        const side = Math.sin(trader.homeX + trader.homeZ) >= 0 ? 1 : -1;
        const candidates = [heading, heading + side * 0.65, heading - side * 0.65, heading + side * 1.2, heading - side * 1.2];
        const nextYaw = candidates.find((yaw) => walkableGround(world, position.x + Math.sin(yaw) * 1.5, position.z + Math.cos(yaw) * 1.5, position.y) !== null);
        if (nextYaw !== undefined) {
          trader.targetX = position.x + Math.sin(nextYaw) * 4;
          trader.targetZ = position.z + Math.cos(nextYaw) * 4;
        }
      }
    }
  });

  world.query(CamelLeash, AnimalPosition, AnimalMotion, AnimalMesh).updateEach(([leash, position, motion, mesh]) => {
    const trader = leash.trader?.get(TraderPosition);
    if (!trader) return;
    const dx = trader.x - position.x;
    const dz = trader.z - position.z;
    const distance = Math.hypot(dx, dz);
    const gap = 1.65 + leash.order * 1.2;
    const moving = distance > gap + 0.25;
    if (moving) {
      const step = Math.min(distance - gap, dt * 1.2);
      const x = position.x + dx / distance * step;
      const z = position.z + dz / distance * step;
      const ground = walkableGround(world, x, z, position.y);
      if (ground !== null) position.set(x, ground, z);
    }
    if (distance > 0.001) {
      motion.yaw = Math.atan2(dx, dz);
      motion.displayYaw = turnToward(motion.displayYaw, motion.yaw, dt * 5);
    }
    motion.speed = moving ? 0.75 : 0;
    if (mesh.value) {
      mesh.value.position.copy(position);
      mesh.value.rotation.y = motion.displayYaw;
    }
  });
}
