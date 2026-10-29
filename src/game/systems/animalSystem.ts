import type { Entity, World } from 'koota';
import { Mesh, Vector3 } from 'three';
import { chunkCoordinate, getBlockIndex } from '../chunks';
import { isCrop } from '../extraBlocks';
import { MAX_BUILD_Y, MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { turnToward } from '../rotation';
import { groundAt } from '../vehicles';
import { BlockKind, voxelKey } from '../voxel';
import type { AnimalKind } from '../animals';
import { Animal, AnimalHit, AnimalMesh, AnimalMotion, AnimalPosition, Chunk, HorseRider, Player, PlayerHealth, PlayerPosition } from '../traits';
import { damagePlayer } from '../combat';

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

function isLoaded(world: World, x: number, z: number) {
  const cx = chunkCoordinate(x);
  const cz = chunkCoordinate(z);
  return world.query(Chunk).some((entity) => {
    const chunk = entity.get(Chunk)!;
    return chunk.x === cx && chunk.z === cz;
  });
}

function bodyClear(world: World, x: number, z: number, feetY: number) {
  for (const height of [0.35, 1.15]) {
    const block = blockAt(world, x, feetY + height, z);
    if (!block || block.kind === BlockKind.Water || isCrop(block.kind) || block.open) continue;
    return false;
  }
  return true;
}

function canAdvance(world: World, kind: AnimalKind, position: Vector3, yaw: number) {
  const x = position.x + Math.sin(yaw) * 0.8;
  const z = position.z + Math.cos(yaw) * 0.8;
  if (!isLoaded(world, x, z)) return false;
  if (kind === 'duck') {
    const ground = groundAt(world, x, z, MAX_BUILD_Y);
    return ground < SEA_LEVEL + 0.5 && blockAt(world, x, SEA_LEVEL, z)?.kind === BlockKind.Water;
  }
  const ground = groundAt(world, x, z, position.y + 1.05);
  return ground >= SEA_LEVEL + 0.5 && ground <= position.y + 1.05 && bodyClear(world, x, z, ground);
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
      const ground = groundAt(world, x, z, position.y + 1.05);
      if (ground >= SEA_LEVEL + 0.5 && ground <= position.y + 1.05 && bodyClear(world, x, z, ground)) {
        position.x = x;
        position.z = z;
        if (motion.grounded && ground > position.y) position.y = ground;
      } else {
        blocked = true;
      }
    } else {
      blocked = true;
    }

    const ground = groundAt(world, position.x, position.z, position.y + 0.2);
    if (position.y <= ground + 0.001 && motion.velocityY <= 0) {
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
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  const health = playerEntity?.get(PlayerHealth);

  world.query(Animal, AnimalHit, AnimalPosition, AnimalMotion, AnimalMesh).updateEach(([animal, hit, position, motion, mesh], entity) => {
    if (entity.get(HorseRider)?.mounted) return;
    hit.time = Math.max(0, hit.time - dt);
    hit.panic = Math.max(0, hit.panic - dt);
    hit.attackIn = Math.max(0, hit.attackIn - dt);
    const aggressive = animal.kind === 'bear' || animal.kind === 'snowBear' || animal.kind === 'wolf' || animal.kind === 'snowWolf';
    if (aggressive && playerEntity && player && health && hit.attackIn <= 0 && position.distanceToSquared(player) < 2.2 * 2.2) {
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

    motion.idle = Math.max(0, motion.idle - dt);
    motion.turnIn -= motion.idle > 0 ? 0 : dt;
    motion.phase += dt * 3;
    if (hit.panic > 0) {
      motion.idle = 0;
      motion.turnIn = Math.min(motion.turnIn, 1.2);
      motion.yaw += Math.sin(entity * 3.17 + motion.phase * 2) * dt * 0.65;
    }
    if (motion.turnIn <= 0) {
      motion.yaw += Math.sin(entity * 17.31 + motion.phase) * 0.75;
      motion.turnIn = hit.panic > 0 ? 1.5 : 8 + (Math.sin(entity * 7.13 + motion.phase) + 1) * 3.5;
      if (hit.panic === 0 && Math.sin(entity * 5.73 + motion.phase) > 0.72) {
        motion.idle = 0.7 + (Math.sin(entity * 9.37 + motion.phase) + 1) * 0.65;
      }
    }

    if (moveAnimal(world, animal.kind, position, motion, dt, entity, hit.panic) && mesh.value) {
      mesh.value.position.copy(position);
      motion.displayYaw = turnToward(motion.displayYaw, motion.yaw, dt * 6);
      mesh.value.rotation.y = motion.displayYaw;
    }
  });
}
