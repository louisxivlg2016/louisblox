import type { Entity, World } from 'koota';
import { Mesh, Vector3 } from 'three';
import { getBlockIndex, isChunkLoaded } from '../chunks';
import { isCrop } from '../extraBlocks';
import { MAX_BUILD_Y, MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { turnToward } from '../rotation';
import { groundAt } from '../vehicles';
import { isWaterBlock, voxelKey } from '../voxel';
import type { AnimalKind } from '../animals';
import { Animal, AnimalHit, AnimalHome, AnimalLove, AnimalMesh, AnimalMotion, AnimalPosition, CamelLeash, HorseRider, Player, PlayerHealth, PlayerPosition } from '../traits';
import { damageAnimal, damagePlayer } from '../combat';
import { findDefenseTarget, isTamedAnimal, tamingSystem, WILD_ANIMALS } from '../taming';
import { canSeePlayer } from '../hostility';
import { hasEffect } from '../effects';
import { getFireSources, nearestFire } from '../hazards';
import { interpolateAnimalMovement, isAnimalAuthority, syncAnimalState } from '../animalSync';
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
const MAX_WALK_DOWN = 4.05;

function walkableGround(world: World, x: number, z: number, ground: number) {
  return ground > MIN_WORLD_Y + 0.5 && !isWaterBlock(blockAt(world, x, ground + 1, z)?.kind);
}

const safePositions = new WeakMap<World, Map<Entity, Vector3>>();

function rememberSafePosition(world: World, entity: Entity, position: Vector3) {
  let positions = safePositions.get(world);
  if (!positions) {
    positions = new Map();
    safePositions.set(world, positions);
  }
  positions.set(entity, position.clone());
}

function recoverSafePosition(world: World, kind: AnimalKind, position: Vector3, entity: Entity) {
  const saved = safePositions.get(world)?.get(entity);
  if (!saved || saved.distanceToSquared(position) < 0.0001 || !isLoaded(world, saved.x, saved.z)) return false;
  const ground = groundAt(world, saved.x, saved.z, saved.y + 0.2);
  if (!walkableGround(world, saved.x, saved.z, ground) || !bodyClear(world, saved.x, saved.z, ground)) return false;
  position.set(saved.x, ground, saved.z);
  return true;
}

function rescueAnimal(world: World, kind: AnimalKind, position: Vector3, entity: Entity) {
  const direction = entity % 2 === 0 ? 1 : -1;
  const offsets = [[0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]];
  for (const [dx, dz] of offsets) {
    const x = position.x + dx * direction;
    const z = position.z + dz * direction;
    if (!isLoaded(world, x, z)) continue;
    const ground = groundAt(world, x, z, position.y + 2.2);
    if (!walkableGround(world, x, z, ground) || ground > position.y + 2.2 || position.y - ground > 4 || !bodyClear(world, x, z, ground)) continue;
    position.set(x, ground, z);
    return true;
  }
  return false;
}

function updateAnimalVertical(world: World, position: Vector3, motion: Motion, dt: number, entity: Entity) {
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
  return true;
}

function moveInDirection(world: World, kind: AnimalKind, position: Vector3, motion: Motion, yaw: number, speed: number, dt: number, entity: Entity) {
  const x = position.x + Math.sin(yaw) * speed * dt;
  const z = position.z + Math.cos(yaw) * speed * dt;
  if (!isLoaded(world, x, z)) return false;
  if (kind === 'duck' && !isTamedAnimal(entity)) {
    const ground = groundAt(world, x, z, MAX_BUILD_Y);
    if (ground >= SEA_LEVEL + 0.5 || !isWaterBlock(blockAt(world, x, SEA_LEVEL, z)?.kind)) return false;
    position.set(x, SEA_LEVEL + 0.35 + Math.sin(motion.phase) * 0.05, z);
    motion.velocityY = 0;
    motion.grounded = true;
  } else {
    const ground = groundAt(world, x, z, position.y + MAX_CLIMB_RISE + 0.05);
    if (!walkableGround(world, x, z, ground) || ground > position.y + MAX_CLIMB_RISE || (position.y - ground > MAX_WALK_DOWN && motion.grounded) || !bodyClear(world, x, z, ground)) return false;
    position.x = x;
    position.z = z;
    if (motion.grounded && ground > position.y) {
      if (ground - position.y > 1.05) motion.climbTarget = ground;
      else position.y = ground;
    }
    if (!updateAnimalVertical(world, position, motion, dt, entity)) return false;
  }
  motion.yaw = yaw;
  rememberSafePosition(world, entity, position);
  return true;
}

function moveAroundObstacle(world: World, kind: AnimalKind, position: Vector3, motion: Motion, speed: number, dt: number, entity: Entity) {
  const direction = entity % 2 === 0 ? 1 : -1;
  const candidates = [motion.yaw, motion.yaw + direction * Math.PI / 4, motion.yaw - direction * Math.PI / 4, motion.yaw + direction * Math.PI / 2, motion.yaw - direction * Math.PI / 2, motion.yaw + direction * Math.PI * 0.75, motion.yaw - direction * Math.PI * 0.75, motion.yaw + Math.PI];
  for (let index = 0; index < candidates.length; index += 1) {
    if (moveInDirection(world, kind, position, motion, candidates[index], speed, dt, entity)) {
      if (index > 0) {
        motion.avoid = Math.max(motion.avoid, 0.4);
        motion.turnIn = Math.max(motion.turnIn, 0.8);
      }
      return true;
    }
  }
  return false;
}

function moveAnimalStep(world: World, kind: AnimalKind, position: Vector3, motion: Motion, dt: number, entity: Entity, panic = 0, speedOverride?: number) {
  if (!isLoaded(world, position.x, position.z) && !recoverSafePosition(world, kind, position, entity) && !rescueAnimal(world, kind, position, entity)) return true;
  if (motion.climbTarget === null && !bodyClear(world, position.x, position.z, position.y)) {
    const ground = groundAt(world, position.x, position.z, position.y + MAX_CLIMB_RISE + 0.05);
    if (ground > position.y && ground <= position.y + MAX_CLIMB_RISE && walkableGround(world, position.x, position.z, ground) && bodyClear(world, position.x, position.z, ground)) {
      motion.climbTarget = ground;
      motion.velocityY = 0;
      motion.grounded = false;
    } else if (!recoverSafePosition(world, kind, position, entity)) rescueAnimal(world, kind, position, entity);
  }
  motion.avoid = Math.max(0, motion.avoid - dt);
  motion.running = panic > 0;
  const baseSpeed = kind === 'duck' ? motion.speed * 0.35 : motion.speed;
  const normalSpeed = speedOverride ?? Math.max(baseSpeed, kind === 'duck' ? 0.65 : 2.4);
  const chaseSpeed = kind === 'duck' ? 1.4 : kind === 'zombie' ? 5.4 : 6.8;
  const speed = panic > 0 ? chaseSpeed : normalSpeed;
  if (moveAroundObstacle(world, kind, position, motion, speed, dt, entity)) return true;
  if (rescueAnimal(world, kind, position, entity) && moveAroundObstacle(world, kind, position, motion, speed, dt, entity)) return true;
  if (recoverSafePosition(world, kind, position, entity)) moveAroundObstacle(world, kind, position, motion, speed, dt, entity);
  return true;
}

export function moveAnimal(world: World, kind: AnimalKind, position: Vector3, motion: Motion, dt: number, entity: Entity, panic = 0, speedOverride?: number) {
  const steps = Math.max(1, Math.ceil(dt / 0.05));
  const stepDt = dt / steps;
  for (let step = 0; step < steps; step += 1) {
    if (!moveAnimalStep(world, kind, position, motion, stepDt, entity, panic, speedOverride)) return false;
  }
  return true;
}

const clocks = new WeakMap<World, number>();
const wallClocks = new WeakMap<World, number>();

export function animalSystem(world: World, dt: number) {
  const now = performance.now() / 1000;
  const previous = wallClocks.get(world);
  const elapsed = (clocks.get(world) ?? 0) + Math.min(2, Math.max(dt, previous === undefined ? dt : now - previous));
  wallClocks.set(world, now);
  if (elapsed < 1 / 30) {
    clocks.set(world, elapsed);
    return;
  }
  clocks.set(world, 0);
  dt = elapsed;
  if (!isAnimalAuthority()) {
    syncAnimalState(world, dt);
    interpolateAnimalMovement(world, dt);
    return;
  }
  tamingSystem(world, dt);
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  const health = playerEntity?.get(PlayerHealth);
  const fires = getFireSources(world);
  const neighbors = world.query(Animal, AnimalPosition).map((entity) => ({ entity, position: entity.get(AnimalPosition)!, stationary: Boolean(entity.get(CamelLeash) || entity.get(HorseRider)?.mounted || entity.get(HorseRider)?.passenger) }));

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
    if (entity.get(HorseRider)?.mounted || entity.get(HorseRider)?.passenger) return;
    const stepDt = dt;
    hit.time = Math.max(0, hit.time - stepDt);
    hit.panic = Math.max(0, hit.panic - stepDt);
    hit.attackIn = Math.max(0, hit.attackIn - stepDt);
    const love = entity.get(AnimalLove);
    if (love) love.time = Math.max(0, love.time - stepDt);
    const aggressive = animal.kind === 'zombie' || animal.kind === 'bear' || animal.kind === 'snowBear' || animal.kind === 'wolf' || animal.kind === 'snowWolf';
    const tamed = isTamedAnimal(entity);
    const defenseTarget = tamed && player && WILD_ANIMALS.has(animal.kind) ? findDefenseTarget(world, entity, player) : null;
    const targetPosition = defenseTarget?.get(AnimalPosition);
    const targetDistanceSquared = targetPosition ? position.distanceToSquared(targetPosition) : Infinity;
    motion.sightIn -= stepDt;
    if (fire) {
      motion.hunting = false;
      motion.yaw = Math.atan2(position.x - fire.x, position.z - fire.z);
      motion.turnIn = Math.max(motion.turnIn, 0.5);
      hit.panic = Math.max(hit.panic, 0.2);
    } else {
      if (aggressive && !tamed && player && !hasEffect('invisibility') && motion.sightIn <= 0) {
        motion.hunting = canSeePlayer(world, position, player);
        motion.sightIn = 0.35;
      }
      if (!aggressive || tamed || !player || hasEffect('invisibility')) motion.hunting = false;
      if (motion.hunting && player) {
        motion.idle = 0;
        motion.yaw = Math.atan2(player.x - position.x, player.z - position.z);
        motion.turnIn = Math.max(motion.turnIn, 0.5);
      }
      if (tamed && player && (targetPosition || distanceSquared > 2.8 * 2.8)) {
        const target = targetPosition ?? player;
        const distance = Math.sqrt(targetPosition ? targetDistanceSquared : distanceSquared);
        motion.yaw = Math.atan2(target.x - position.x, target.z - position.z);
        motion.turnIn = Math.max(motion.turnIn, 0.5);
        motion.speed = targetPosition ? 3.5 : distance > 10 ? 5.5 : distance > 5 ? 3.5 : 2.4;
      }
    }
    if (!fire && defenseTarget && targetDistanceSquared < 2.2 * 2.2 && hit.attackIn <= 0) {
      damageAnimal(world, defenseTarget, 1, player);
      hit.attackIn = 1.2;
    }
    if (!fire && aggressive && !tamed && playerEntity && player && health && !hasEffect('invisibility') && hit.attackIn <= 0 && distanceSquared < 2.2 * 2.2) {
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
    if (!fire && !tamed && hit.panic > 0 && !motion.hunting) {
      motion.idle = 0;
      motion.turnIn = Math.min(motion.turnIn, 1.2);
      motion.yaw += Math.sin(entity * 3.17 + motion.phase * 2) * stepDt * 0.65;
    }
    if (!fire && !tamed && motion.turnIn <= 0 && !motion.hunting && motion.avoid <= 0) {
      motion.yaw += Math.sin(entity * 17.31 + motion.phase) * 0.75;
      motion.turnIn = hit.panic > 0 ? 1.5 : 8 + (Math.sin(entity * 7.13 + motion.phase) + 1) * 3.5;
    }
    if (!tamed && !motion.hunting && motion.avoid <= 0) {
      for (const neighbor of neighbors) {
        if (neighbor.entity === entity || neighbor.stationary || !neighbor.entity.isAlive()) continue;
        const dx = position.x - neighbor.position.x;
        const dz = position.z - neighbor.position.z;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared >= 0.9 * 0.9 || Math.abs(position.y - neighbor.position.y) > 2.2) continue;
        const away = distanceSquared < 0.0001 ? entity * 2.39 : Math.atan2(dx, dz);
        motion.yaw = turnToward(motion.yaw, away + Math.sin(entity * 2.17) * 0.4, stepDt * 1.2);
        motion.turnIn = Math.max(motion.turnIn, 0.5);
        break;
      }
    }

    const stayClose = !fire && tamed && (defenseTarget ? targetDistanceSquared < 2.2 * 2.2 : distanceSquared < 2.8 * 2.8);
    const home = entity.get(AnimalHome);
    if (home && !tamed) {
      const angle = entity * 0.73 + motion.phase * 0.3;
      const radius = Math.min(0.75, home.radius);
      const dx = home.x + Math.sin(angle) * radius - position.x;
      const dz = home.z + Math.cos(angle) * radius - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.02) {
        motion.yaw = Math.atan2(dx, dz);
        moveAnimal(world, animal.kind, position, motion, stepDt, entity, 0, 0.3);
      }
    } else if (!stayClose) moveAnimal(world, animal.kind, position, motion, stepDt, entity, fire || defenseTarget ? 1 : motion.hunting ? 1 : hit.panic);
    if (mesh.value) {
      mesh.value.position.copy(position);
      motion.displayYaw = turnToward(motion.displayYaw, motion.yaw, stepDt * 6);
      mesh.value.rotation.y = motion.displayYaw;
      if (animal.kind === 'zombie') mesh.value.rotation.z = Math.sin(motion.phase) * 0.035;
    }
  });
  syncAnimalState(world, dt);
}
