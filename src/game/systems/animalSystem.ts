import type { Entity, World } from 'koota';
import { Mesh, Vector3 } from 'three';
import { getBlockIndex, getWorldSeed, isChunkLoaded } from '../chunks';
import { isCrop } from '../extraBlocks';
import { biomeAt, MAX_BUILD_Y, MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { turnToward } from '../rotation';
import { groundAt } from '../vehicles';
import { BlockKind, voxelKey } from '../voxel';
import type { AnimalKind } from '../animals';
import { Animal, AnimalHit, AnimalMesh, AnimalMotion, AnimalPosition, HorseRider, Player, PlayerHealth, PlayerPosition } from '../traits';
import { damagePlayer } from '../combat';
import { canSeePlayer } from '../hostility';

type Motion = {
  yaw: number;
  displayYaw: number;
  turnIn: number;
  phase: number;
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
    if (!block || block.kind === BlockKind.Water || isCrop(block.kind) || block.open) continue;
    return false;
  }
  return true;
}

function climbRise(world: World, x: number, z: number) {
  return biomeAt(Math.floor(x), Math.floor(z), getWorldSeed(world)) === 'winter' ? 4 : 1.05;
}

function canAdvance(world: World, kind: AnimalKind, position: Vector3, yaw: number) {
  const x = position.x + Math.sin(yaw) * 0.8;
  const z = position.z + Math.cos(yaw) * 0.8;
  if (!isLoaded(world, x, z)) return false;
  if (kind === 'duck') {
    const ground = groundAt(world, x, z, MAX_BUILD_Y);
    return ground < SEA_LEVEL + 0.5 && blockAt(world, x, SEA_LEVEL, z)?.kind === BlockKind.Water;
  }
  const rise = climbRise(world, x, z);
  const ground = groundAt(world, x, z, position.y + rise + 0.05);
  return ground >= SEA_LEVEL + 0.5 && ground <= position.y + rise && bodyClear(world, x, z, ground);
}

function avoidWall(world: World, kind: AnimalKind, position: Vector3, motion: Motion, entity: Entity) {
  const direction = entity % 2 === 0 ? 1 : -1;
  const candidates = [motion.yaw + direction * Math.PI / 2, motion.yaw - direction * Math.PI / 2, motion.yaw + Math.PI, motion.yaw];
  const open = candidates.find((yaw) => canAdvance(world, kind, position, yaw));
  if (open !== undefined) motion.yaw = open;
  motion.avoid = 0.55;
  motion.turnIn = Math.max(motion.turnIn, 1.2);
}

export function moveAnimal(world: World, kind: AnimalKind, position: Vector3, motion: Motion, dt: number, entity: Entity, panic = 0) {
  if (!isLoaded(world, position.x, position.z)) return true;
  motion.avoid = Math.max(0, (motion.avoid ?? 0) - dt);
  const baseSpeed = kind === 'duck' ? motion.speed * 0.35 : motion.speed;
  const normalSpeed = motion.idle > 0 || motion.avoid > 0 ? 0 : baseSpeed;
  const speed = motion.avoid > 0 ? 0 : panic > 0 ? Math.min(kind === 'duck' ? 0.65 : 1.4, baseSpeed * 1.8) : normalSpeed;
  const x = position.x + Math.sin(motion.yaw) * speed * dt;
  const z = position.z + Math.cos(motion.yaw) * speed * dt;
  let blocked = false;

  if (kind === 'duck') {
    const ground = groundAt(world, x, z, MAX_BUILD_Y);
    if (!isLoaded(world, x, z) || ground >= SEA_LEVEL + 0.5 || blockAt(world, x, SEA_LEVEL, z)?.kind !== BlockKind.Water) {
      blocked = true;
    } else {
      position.set(x, SEA_LEVEL + 0.35 + Math.sin(motion.phase) * 0.05, z);
      motion.velocityY = 0;
      motion.grounded = true;
    }
  } else {
    if (isLoaded(world, x, z)) {
      const rise = climbRise(world, x, z);
      const ground = groundAt(world, x, z, position.y + rise + 0.05);
      if (ground >= SEA_LEVEL + 0.5 && ground <= position.y + rise && bodyClear(world, x, z, ground)) {
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
const distantClocks = new WeakMap<Vector3, number>();

export function animalSystem(world: World, dt: number) {
  const elapsed = (clocks.get(world) ?? 0) + dt;
  if (elapsed < 1 / 30) return;
  clocks.set(world, 0);
  dt = elapsed;
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  const health = playerEntity?.get(PlayerHealth);

  world.query(Animal, AnimalHit, AnimalPosition, AnimalMotion, AnimalMesh).updateEach(([animal, hit, position, motion, mesh], entity) => {
    const distanceSquared = player ? position.distanceToSquared(player) : Infinity;
    if (mesh.value) mesh.value.visible = distanceSquared < (animal.kind === 'zombie' ? 32 * 32 : 40 * 40);
    if (entity.get(HorseRider)?.mounted) return;
    let stepDt = dt;
    if (distanceSquared > 25 * 25) {
      const remaining = (distantClocks.get(position) ?? 0) - dt;
      if (remaining > 0) {
        distantClocks.set(position, remaining);
        return;
      }
      stepDt -= remaining;
      distantClocks.set(position, 0.1);
    }
    hit.time = Math.max(0, hit.time - stepDt);
    hit.panic = Math.max(0, hit.panic - stepDt);
    hit.attackIn = Math.max(0, hit.attackIn - stepDt);
    const aggressive = animal.kind === 'zombie' || animal.kind === 'bear' || animal.kind === 'snowBear' || animal.kind === 'wolf' || animal.kind === 'snowWolf';
    motion.sightIn -= stepDt;
    if (aggressive && player && motion.sightIn <= 0) {
      motion.hunting = canSeePlayer(world, position, player);
      motion.sightIn = 0.35;
    }
    if (!aggressive || !player) motion.hunting = false;
    if (motion.hunting && player) {
      motion.idle = 0;
      motion.yaw = Math.atan2(player.x - position.x, player.z - position.z);
      motion.turnIn = Math.max(motion.turnIn, 0.5);
    }
    if (aggressive && playerEntity && player && health && hit.attackIn <= 0 && distanceSquared < 2.2 * 2.2) {
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

    motion.idle = Math.max(0, motion.idle - stepDt);
    motion.turnIn -= motion.idle > 0 ? 0 : stepDt;
    motion.phase += stepDt * 3;
    if (hit.panic > 0 && !motion.hunting) {
      motion.idle = 0;
      motion.turnIn = Math.min(motion.turnIn, 1.2);
      motion.yaw += Math.sin(entity * 3.17 + motion.phase * 2) * stepDt * 0.65;
    }
    if (motion.turnIn <= 0 && !motion.hunting) {
      motion.yaw += Math.sin(entity * 17.31 + motion.phase) * 0.75;
      motion.turnIn = hit.panic > 0 ? 1.5 : 8 + (Math.sin(entity * 7.13 + motion.phase) + 1) * 3.5;
      if (hit.panic === 0 && Math.sin(entity * 5.73 + motion.phase) > 0.72) {
        motion.idle = 0.7 + (Math.sin(entity * 9.37 + motion.phase) + 1) * 0.65;
      }
    }

    if (moveAnimal(world, animal.kind, position, motion, stepDt, entity, motion.hunting ? 1 : hit.panic) && mesh.value) {
      mesh.value.position.copy(position);
      motion.displayYaw = turnToward(motion.displayYaw, motion.yaw, stepDt * 6);
      mesh.value.rotation.y = motion.displayYaw;
      if (animal.kind === 'zombie') mesh.value.rotation.z = Math.sin(motion.phase) * 0.035;
    }
  });
}
