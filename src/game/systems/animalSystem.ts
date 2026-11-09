import type { Entity, World } from 'koota';
import { Mesh, Vector3 } from 'three';
import { getBlockIndex, isChunkLoaded } from '../chunks';
import { isCrop } from '../extraBlocks';
import { MAX_BUILD_Y, MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { turnToward } from '../rotation';
import { groundAt } from '../vehicles';
import { isWaterBlock, voxelKey } from '../voxel';
import type { AnimalKind } from '../animals';
import { Animal, AnimalHit, AnimalMesh, AnimalMotion, AnimalPosition, CamelLeash, HorseRider, Player, PlayerHealth, PlayerPosition } from '../traits';
import { damagePlayer } from '../combat';
import { canSeePlayer } from '../hostility';
import { hasEffect } from '../effects';
import { getFireSources, nearestFire } from '../hazards';
import { isAnimalAuthority, syncAnimalState } from '../animalSync';
import { isCollidable } from './collisionSystem';

type Motion = {
  yaw: number;
  displayYaw: number;
  turnIn: number;
  phase: number;
  running: boolean;
  speed: number;
  idle: number;
  velocityY: number;
  grounded: boolean;
  avoid: number;
  climbTarget: number | null;
  hunting: boolean;
  sightIn: number;
};

function tint(mesh: import('three').Object3D, color: string) {
  mesh.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.color.set(color);
  });
}

function blockAt(world: World, x: number, y: number, z: number) {
  return getBlockIndex(world).get(voxelKey(Math.round(x), Math.round(y), Math.round(z)));
}

const isLoaded = isChunkLoaded;

function bodyClear(world: World, x: number, z: number, feetY: number) {
  for (const height of [0.35, 1.15]) {
    const block = blockAt(world, x, feetY + height, z);
    if (block && !isWaterBlock(block.kind) && isCollidable(block)) return false;
  }
  return true;
}

const MAX_CLIMB_RISE = 4;

function walkableGround(world: World, x: number, z: number, ground: number) {
  return ground > MIN_WORLD_Y + 0.5 && !isWaterBlock(blockAt(world, x, ground + 1, z)?.kind);
}

function canAdvance(world: World, kind: AnimalKind, position: Vector3, yaw: number) {
  const x = position.x + Math.sin(yaw) * 0.8;
  const z = position.z + Math.cos(yaw) * 0.8;
  if (!isLoaded(world, x, z)) return false;
  if (kind === 'duck') {
    const ground = groundAt(world, x, z, MAX_BUILD_Y);
    return ground < SEA_LEVEL + 0.5 && isWaterBlock(blockAt(world, x, SEA_LEVEL, z)?.kind);
  }
  const rise = MAX_CLIMB_RISE;
  const ground = groundAt(world, x, z, position.y + rise + 0.05);
  return walkableGround(world, x, z, ground) && ground <= position.y + rise && bodyClear(world, x, z, ground);
}

function avoidWall(world: World, kind: AnimalKind, position: Vector3, motion: Motion, entity: Entity) {
  const direction = entity % 2 === 0 ? 1 : -1;
  const candidates = [motion.yaw + direction * Math.PI / 2, motion.yaw - direction * Math.PI / 2, motion.yaw + direction * Math.PI * 0.75, motion.yaw - direction * Math.PI * 0.75];
  const open = candidates.find((yaw) => canAdvance(world, kind, position, yaw));
  if (open !== undefined) motion.yaw = open;
  else motion.yaw += direction * Math.PI / 3;
  motion.avoid = open !== undefined ? 0.35 : 0.1;
  motion.turnIn = Math.max(motion.turnIn, 1.2);
}

export function moveAnimal(world: World, kind: AnimalKind, position: Vector3, motion: Motion, dt: number, entity: Entity, panic = 0) {
  if (!isLoaded(world, position.x, position.z)) return true;
  if (!bodyClear(world, position.x, position.z, position.y)) {
    position.y = groundAt(world, position.x, position.z, position.y + 2.2);
    motion.velocityY = 0;
    motion.grounded = true;
    if (!bodyClear(world, position.x, position.z, position.y)) {
      avoidWall(world, kind, position, motion, entity);
      return true;
    }
  }
  if (motion.speed > 0 && motion.idle <= 0 && (motion.avoid ?? 0) <= 0 && !canAdvance(world, kind, position, motion.yaw)) avoidWall(world, kind, position, motion, entity);
  motion.avoid = Math.max(0, (motion.avoid ?? 0) - dt);
  motion.running = panic > 0 || kind !== 'duck' && Math.sin(motion.phase * 0.45 + entity * 1.37) > 0.2;
  const baseSpeed = kind === 'duck' ? motion.speed * 0.35 : Math.max(motion.speed, 2.6);
  const normalSpeed = motion.running && kind !== 'duck' ? Math.max(baseSpeed * 2.2, 5.8) : Math.max(baseSpeed, kind === 'duck' ? 0.65 : 2.6);
  const chaseSpeed = kind === 'zombie' ? 6.4 : kind === 'bear' || kind === 'snowBear' || kind === 'wolf' || kind === 'snowWolf' ? 6.2 : kind === 'duck' ? 1.4 : 6.4;
  const speed = panic > 0 ? chaseSpeed : normalSpeed;
  const x = position.x + Math.sin(motion.yaw) * speed * dt;
  const z = position.z + Math.cos(motion.yaw) * speed * dt;
  let blocked = false;

  if (kind === 'duck') {
    const ground = groundAt(world, x, z, MAX_BUILD_Y);
    if (!isLoaded(world, x, z) || ground >= SEA_LEVEL + 0.5 || !isWaterBlock(blockAt(world, x, SEA_LEVEL, z)?.kind)) {
      blocked = true;
    } else {
      position.set(x, SEA_LEVEL + 0.35 + Math.sin(motion.phase) * 0.05, z);
      motion.velocityY = 0;
      motion.grounded = true;
    }
  } else {
    if (isLoaded(world, x, z)) {
      const rise = MAX_CLIMB_RISE;
      const ground = groundAt(world, x, z, position.y + rise + 0.05);
      if (walkableGround(world, x, z, ground) && ground <= position.y + rise && bodyClear(world, x, z, ground)) {
        position.x = x;
        position.z = z;
        if (motion.grounded && ground > position.y) {
          if (ground - position.y > 1.05) motion.climbTarget = ground;
          else position.y = ground;
        }
      } else {
        blocked = true;
      }
    } else {
      blocked = true;
    }

    const ground = groundAt(world, position.x, position.z, position.y + 0.2);
    if (motion.climbTarget !== null && motion.climbTarget !== undefined && ground < position.y - 0.2) motion.climbTarget = null;
    if (motion.climbTarget !== null && motion.climbTarget !== undefined) {
      position.y = Math.min(motion.climbTarget, position.y + dt * 4);
      motion.velocityY = 0;
      motion.grounded = position.y >= motion.climbTarget;
      if (motion.grounded) motion.climbTarget = null;
    } else if (position.y <= ground + 0.001 && motion.velocityY <= 0) {
      position.y = ground;
      motion.velocityY = 0;
      motion.grounded = true;
    } else {
      motion.velocityY -= 18 * dt;
      position.y += motion.velocityY * dt;
      motion.grounded = false;
      if (position.y <= ground) {
        position.y = ground;
        motion.velocityY = 0;
        motion.grounded = true;
      }
    }
    if (position.y < MIN_WORLD_Y - 8) {
      entity.destroy();
      return false;
    }
  }

  if (blocked) avoidWall(world, kind, position, motion, entity);
  return true;
}

const clocks = new WeakMap<World, number>();

export function animalSystem(world: World, dt: number) {
  const elapsed = (clocks.get(world) ?? 0) + dt;
  if (elapsed < 1 / 30) return;
  clocks.set(world, 0);
  dt = elapsed;
  if (!isAnimalAuthority()) {
    syncAnimalState(world, dt);
    return;
  }
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  const health = playerEntity?.get(PlayerHealth);
  const fires = getFireSources(world);
  const neighbors = world.query(Animal, AnimalPosition).map((entity) => ({ entity, position: entity.get(AnimalPosition)!, stationary: Boolean(entity.get(CamelLeash) || entity.get(HorseRider)?.mounted) }));

  world.query(Animal, AnimalHit, AnimalPosition, AnimalMotion, AnimalMesh).updateEach(([animal, hit, position, motion, mesh], entity) => {
    const distanceSquared = player ? position.distanceToSquared(player) : Infinity;
    if (mesh.value) mesh.value.visible = distanceSquared < (animal.kind === 'zombie' ? 32 * 32 : 40 * 40);
    const fire = nearestFire(fires, position);
    const leash = entity.get(CamelLeash);
    if (leash && !fire) return;
    if (leash && fire) {
      leash.trader = null;
      entity.remove(CamelLeash);
      hit.panic = Math.max(hit.panic, 2.4);
    }
    if (entity.get(HorseRider)?.mounted) return;
    const stepDt = dt;
    hit.time = Math.max(0, hit.time - stepDt);
    hit.panic = Math.max(0, hit.panic - stepDt);
    hit.attackIn = Math.max(0, hit.attackIn - stepDt);
    const aggressive = animal.kind === 'zombie' || animal.kind === 'bear' || animal.kind === 'snowBear' || animal.kind === 'wolf' || animal.kind === 'snowWolf';
    motion.sightIn -= stepDt;
    if (fire) {
      motion.hunting = false;
      motion.yaw = Math.atan2(position.x - fire.x, position.z - fire.z);
      motion.turnIn = Math.max(motion.turnIn, 0.5);
      hit.panic = Math.max(hit.panic, 0.2);
    } else {
      if (aggressive && player && !hasEffect('invisibility') && motion.sightIn <= 0) {
        motion.hunting = canSeePlayer(world, position, player);
        motion.sightIn = 0.35;
      }
      if (!aggressive || !player || hasEffect('invisibility')) motion.hunting = false;
      if (motion.hunting && player) {
        motion.idle = 0;
        motion.yaw = Math.atan2(player.x - position.x, player.z - position.z);
        motion.turnIn = Math.max(motion.turnIn, 0.5);
      }
    }
    if (!fire && aggressive && playerEntity && player && health && !hasEffect('invisibility') && hit.attackIn <= 0 && distanceSquared < 2.2 * 2.2) {
      hit.attackIn = 1.2;
      damagePlayer(world, 1);
    }
    if (mesh.value) {
      if (hit.time > 0 && !hit.flashed) {
        tint(mesh.value, '#ff3028');
        hit.flashed = true;
      } else if (hit.time === 0 && hit.flashed) {
        tint(mesh.value, '#ffffff');
        hit.flashed = false;
      }
    }

    motion.idle = 0;
    motion.turnIn -= stepDt;
    motion.phase += stepDt * (motion.running ? 8 : 4);
    if (!fire && hit.panic > 0 && !motion.hunting) {
      motion.idle = 0;
      motion.turnIn = Math.min(motion.turnIn, 1.2);
      motion.yaw += Math.sin(entity * 3.17 + motion.phase * 2) * stepDt * 0.65;
    }
    if (!fire && motion.turnIn <= 0 && !motion.hunting) {
      motion.yaw += Math.sin(entity * 17.31 + motion.phase) * 0.75;
      motion.turnIn = hit.panic > 0 ? 1.5 : 8 + (Math.sin(entity * 7.13 + motion.phase) + 1) * 3.5;
    }
    if (!motion.hunting) {
      for (const neighbor of neighbors) {
        if (neighbor.entity === entity || neighbor.stationary || !neighbor.entity.isAlive()) continue;
        const dx = position.x - neighbor.position.x;
        const dz = position.z - neighbor.position.z;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared >= 2.6 * 2.6 || Math.abs(position.y - neighbor.position.y) > 2.2) continue;
        const away = distanceSquared < 0.0001 ? entity * 2.39 : Math.atan2(dx, dz);
        motion.yaw = turnToward(motion.yaw, away + Math.sin(entity * 2.17) * 0.4, stepDt * 5);
        motion.turnIn = Math.max(motion.turnIn, 1.4);
        break;
      }
    }

    if (moveAnimal(world, animal.kind, position, motion, stepDt, entity, fire ? 1 : motion.hunting ? 1 : hit.panic) && mesh.value) {
      mesh.value.position.copy(position);
      motion.displayYaw = turnToward(motion.displayYaw, motion.yaw, stepDt * 6);
      mesh.value.rotation.y = motion.displayYaw;
      if (animal.kind === 'zombie') mesh.value.rotation.z = Math.sin(motion.phase) * 0.035;
    }
  });
  syncAnimalState(world, dt);
}
