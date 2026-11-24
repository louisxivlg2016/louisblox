import type { Entity, World } from 'koota';
import { Mesh, Vector3 } from 'three';
import { chunkCoordinate, getBlockIndex, getWorldSeed, isChunkLoaded } from '../chunks';
import { isCrop } from '../extraBlocks';
import { biomeAt, heightAt, MIN_WORLD_Y } from '../levels';
import { turnToward } from '../rotation';
import { groundAt } from '../vehicles';
import { isWaterBlock, voxelKey } from '../voxel';
import type { AnimalKind } from '../animals';
import { spawnChunkZombies } from '../animals';
import { Animal, AnimalHealth, AnimalHit, AnimalHome, AnimalLove, AnimalMesh, AnimalMotion, AnimalPosition, AnimalRest, AnimalTame, CamelLeash, Chunk, HorseRider, Player, PlayerHealth, PlayerPosition, Sleep } from '../traits';
import { damageAnimal, damagePlayer, killAnimal, removeAnimal } from '../combat';
import { isNight } from '../dayNight';
import { useGameStore } from '../store';
import { translate } from '../language';
import { companionAnimalName, findDefenseTarget, isOwnTamedAnimal, isTamedAnimal, tamingSystem, WILD_ANIMALS } from '../taming';
import { canSeePlayer, canZombieAttackPlayer } from '../hostility';
import { hasEffect } from '../effects';
import { alertAnimalSound } from './animalSoundSystem';
import { getFireSources, nearestFire } from '../hazards';
import { interpolateAnimalMovement, isAnimalAuthority, syncAnimalState } from '../animalSync';
import { isCollidable } from './collisionSystem';
import { isDoor } from '../extraBlocks';
import { replaceVoxel } from '../chunks';
import { useRemotePlayerStore } from '../multiplayerStore';
import { playerIdentity } from '../playerIdentity';

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

function openBearDoor(world: World, x: number, feetY: number, z: number, kind: AnimalKind) {
  if (kind !== 'bear') return;
  for (const height of [0.35, 1.15]) {
    const block = blockAt(world, x, feetY + height, z);
    if (!block || !isDoor(block.kind) || block.open === true) continue;
    replaceVoxel(world, { block, x: block.x, y: block.y, z: block.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, block.kind, true);
  }
}

const MAX_CLIMB_RISE = 4;
const TAMED_MAX_CLIMB_RISE = 24;
const MAX_WALK_DOWN = 4.05;

const climbRise = (entity: Entity) => isTamedAnimal(entity) ? TAMED_MAX_CLIMB_RISE : MAX_CLIMB_RISE;

function walkableGround(world: World, x: number, z: number, ground: number) {
  const block = blockAt(world, x, ground - 0.5, z);
  return ground > MIN_WORLD_Y + 0.5 && !isWaterBlock(block?.kind) && block?.waterlogged !== true;
}

const safePositions = new WeakMap<World, Map<Entity, Vector3>>();
const hungerNotices = new WeakMap<World, Map<Entity, number>>();

function announceHunger(world: World, entity: Entity, kind: AnimalKind, distanceSquared: number) {
  if (distanceSquared > 4 * 4) return;
  const now = Date.now();
  let notices = hungerNotices.get(world);
  if (!notices) {
    notices = new Map();
    hungerNotices.set(world, notices);
  }
  if (now - (notices.get(entity) ?? -Infinity) < 20000) return;
  notices.set(entity, now);
  useGameStore.getState().setNotice(translate(`${companionAnimalName(kind)} : J’ai faim ! Clique sur moi avec de la nourriture.`, `${companionAnimalName(kind)}: I am hungry! Click on me with food.`));
}

function animalOwnerPosition(entity: Entity, localPlayer: Vector3 | undefined, selfId: string, remotePlayers: ReturnType<typeof useRemotePlayerStore.getState>['players'], cache: Map<string, Vector3>) {
  const ownerId = entity.get(AnimalTame)?.ownerId;
  if (!ownerId || ownerId === selfId) return localPlayer;
  const remote = remotePlayers[ownerId];
  if (!remote) return null;
  let position = cache.get(ownerId);
  if (!position) {
    position = new Vector3();
    cache.set(ownerId, position);
  }
  position.set(remote.x, remote.y, remote.z);
  return position;
}

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
  if (!saved || saved.distanceToSquared(position) < 0.0001 || !withinHomeBiome(world, entity, saved.x, saved.z) || !isLoaded(world, saved.x, saved.z)) return false;
  const ground = groundAt(world, saved.x, saved.z, saved.y + 0.2);
  if (kind === 'zombie' && ground > heightAt(Math.round(saved.x), Math.round(saved.z), getWorldSeed(world)) + 1.05) return false;
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
    if (!withinHomeBiome(world, entity, x, z) || !isLoaded(world, x, z)) continue;
    const ground = groundAt(world, x, z, position.y + 2.2);
    if (kind === 'zombie' && ground > heightAt(Math.round(x), Math.round(z), getWorldSeed(world)) + 1.05) continue;
    if (!walkableGround(world, x, z, ground) || ground > position.y + climbRise(entity) || position.y - ground > 4 || !bodyClear(world, x, z, ground)) continue;
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

function withinHomeBiome(world: World, entity: Entity, x: number, z: number) {
  const home = entity.get(AnimalHome);
  if (!home || isTamedAnimal(entity)) return true;
  const seed = getWorldSeed(world);
  return biomeAt(home.x, home.z, seed) === biomeAt(x, z, seed);
}

function moveInDirection(world: World, kind: AnimalKind, position: Vector3, motion: Motion, yaw: number, speed: number, dt: number, entity: Entity) {
  const x = position.x + Math.sin(yaw) * speed * dt;
  const z = position.z + Math.cos(yaw) * speed * dt;
  if (!withinHomeBiome(world, entity, x, z)) return false;
  if (!isLoaded(world, x, z)) return false;
  openBearDoor(world, x, position.y, z, kind);
  const ground = groundAt(world, x, z, position.y + climbRise(entity) + 0.05);
  if (kind === 'zombie' && ground > heightAt(Math.round(x), Math.round(z), getWorldSeed(world)) + 1.05) return false;
  if (!walkableGround(world, x, z, ground) || ground > position.y + climbRise(entity) || (position.y - ground > MAX_WALK_DOWN && motion.grounded) || !bodyClear(world, x, z, ground)) return false;
  position.x = x;
  position.z = z;
  if (motion.grounded && ground > position.y) {
    if (ground - position.y > 1.05) {
      if (!isTamedAnimal(entity)) return false;
      motion.climbTarget = ground;
    } else position.y = ground;
  }
  if (!updateAnimalVertical(world, position, motion, dt, entity)) return false;
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

function keepZombieOnNaturalGround(world: World, kind: AnimalKind, position: Vector3, motion: Motion) {
  if (kind !== 'zombie') return;
  const naturalGround = heightAt(Math.round(position.x), Math.round(position.z), getWorldSeed(world)) + 0.5;
  const ground = groundAt(world, position.x, position.z, position.y + MAX_CLIMB_RISE + 0.05);
  if (ground <= naturalGround + 1.05) return;
  motion.climbTarget = null;
  if (position.y > naturalGround + 1.05) {
    position.y = naturalGround;
    motion.velocityY = 0;
    motion.grounded = true;
  }
}

function moveAnimalStep(world: World, kind: AnimalKind, position: Vector3, motion: Motion, dt: number, entity: Entity, panic = 0, speedOverride?: number) {
  keepZombieOnNaturalGround(world, kind, position, motion);
  const naturalGround = kind === 'zombie' ? heightAt(Math.round(position.x), Math.round(position.z), getWorldSeed(world)) + 0.5 : null;
  if (!isLoaded(world, position.x, position.z) && !recoverSafePosition(world, kind, position, entity) && !rescueAnimal(world, kind, position, entity)) return true;
  if (motion.climbTarget === null && !bodyClear(world, position.x, position.z, position.y)) {
    const ground = groundAt(world, position.x, position.z, position.y + MAX_CLIMB_RISE + 0.05);
    if (ground > position.y && ground <= position.y + MAX_CLIMB_RISE && (naturalGround === null || ground <= naturalGround + 1.05) && walkableGround(world, position.x, position.z, ground) && bodyClear(world, position.x, position.z, ground)) {
      motion.climbTarget = ground;
      motion.velocityY = 0;
      motion.grounded = false;
    } else if (!recoverSafePosition(world, kind, position, entity)) rescueAnimal(world, kind, position, entity);
  }
  motion.avoid = Math.max(0, motion.avoid - dt);
  motion.running = panic > 0;
  const baseSpeed = kind === 'duck' ? motion.speed * 0.35 : motion.speed;
  const normalSpeed = speedOverride ?? Math.max(baseSpeed, kind === 'duck' ? 0.65 : 2.4);
  const chaseSpeed = kind === 'duck' ? 1.4 : kind === 'zombie' ? 2.2 : 6.8;
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

function separateZombieFromPlayer(world: World, position: Vector3, motion: Motion, player: Vector3, entity: Entity) {
  const dx = position.x - player.x;
  const dz = position.z - player.z;
  if (dx * dx + dz * dz >= 1.35 * 1.35) return;
  const away = Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) : entity * 2.39;
  for (let index = 0; index < 8; index += 1) {
    const angle = away + index * Math.PI / 4;
    const x = player.x + Math.sin(angle) * 1.55;
    const z = player.z + Math.cos(angle) * 1.55;
    if (!withinHomeBiome(world, entity, x, z) || !isLoaded(world, x, z)) continue;
    const ground = groundAt(world, x, z, player.y + MAX_CLIMB_RISE);
    if (ground > heightAt(Math.round(x), Math.round(z), getWorldSeed(world)) + 1.05) continue;
    if (!walkableGround(world, x, z, ground) || !bodyClear(world, x, z, ground)) continue;
    position.set(x, ground, z);
    motion.velocityY = 0;
    motion.grounded = true;
    motion.climbTarget = null;
    rememberSafePosition(world, entity, position);
    return;
  }
}

const clocks = new WeakMap<World, number>();
const wallClocks = new WeakMap<World, number>();
const zombieNights = new WeakMap<World, boolean>();

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
    world.query(Animal, AnimalHit, AnimalMesh).updateEach(([, hit, mesh]) => {
      hit.time = Math.max(0, hit.time - dt);
      if (!mesh.value) return;
      if (hit.time > 0 && !hit.flashed) {
        tint(mesh.value, '#ff3028');
        hit.flashed = true;
      } else if (hit.time === 0 && hit.flashed) {
        tint(mesh.value, '#ffffff');
        hit.flashed = false;
      }
    });
    syncAnimalState(world, dt);
    interpolateAnimalMovement(world, dt);
    return;
  }
  tamingSystem(world, dt);
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  const selfId = playerIdentity();
  const remotePlayers = useRemotePlayerStore.getState().players;
  const ownerPositions = new Map<string, Vector3>();
  const health = playerEntity?.get(PlayerHealth);
  const survival = useGameStore.getState().gameplayMode === 'survival';
  const night = isNight(world);
  if (survival && night && !zombieNights.get(world) && player) {
    const centerX = chunkCoordinate(player.x);
    const centerZ = chunkCoordinate(player.z);
    const seed = getWorldSeed(world);
    for (const entity of world.query(Chunk)) {
      const chunk = entity.get(Chunk)!;
      if (Math.abs(chunk.x - centerX) <= 2 && Math.abs(chunk.z - centerZ) <= 2) spawnChunkZombies(world, chunk.x, chunk.z, seed);
    }
  }
  zombieNights.set(world, survival && night);
  const fires = getFireSources(world);
  const neighbors = world.query(Animal, AnimalPosition).map((entity) => ({ entity, position: entity.get(AnimalPosition)!, stationary: Boolean(entity.get(CamelLeash) || entity.get(HorseRider)?.mounted || entity.get(HorseRider)?.passenger) }));

  world.query(Animal, AnimalHealth, AnimalHit, AnimalPosition, AnimalMotion, AnimalMesh).updateEach(([animal, animalHealth, hit, position, motion, mesh], entity) => {
    keepZombieOnNaturalGround(world, animal.kind, position, motion);
    const tamed = isTamedAnimal(entity);
    const owner = tamed ? animalOwnerPosition(entity, player, selfId, remotePlayers, ownerPositions) : null;
    const hungry = tamed && (entity.get(AnimalTame)?.happiness ?? 100) <= 0;
    let distanceSquared = tamed ? owner ? position.distanceToSquared(owner) : Infinity : player ? position.distanceToSquared(player) : Infinity;
    if (hungry && owner && isOwnTamedAnimal(entity)) announceHunger(world, entity, animal.kind, distanceSquared);
    if (distanceSquared > 48 * 48 && !tamed) {
      if (mesh.value) mesh.value.visible = false;
      motion.running = false;
      motion.speed = 0;
      return;
    }
    if (mesh.value) mesh.value.visible = true;
    if (animal.kind === 'zombie' && survival && !night && animalHealth.value > 0) {
      killAnimal(world, entity, false);
      animalHealth.value = 0;
      hit.time = 0.45;
      hit.deathIn = 0.45;
      hit.panic = 0;
      hit.attackIn = 0;
      hit.flashed = true;
      if (mesh.value) tint(mesh.value, '#ff3028');
      return;
    }
    if (animal.kind === 'zombie' && animalHealth.value <= 0) {
      hit.deathIn = Math.max(0, hit.deathIn - dt);
      motion.hunting = false;
      motion.running = false;
      if (mesh.value) {
        if (!hit.flashed) {
          tint(mesh.value, '#ff3028');
          hit.flashed = true;
        }
        mesh.value.position.copy(position);
        mesh.value.rotation.z = (1 - hit.deathIn / 0.45) * Math.PI / 2;
      }
      if (hit.deathIn <= 0) removeAnimal(world, entity);
      return;
    }
    const fire = nearestFire(fires, position, 6, tamed);
    const leash = entity.get(CamelLeash);
    if (leash && !fire) return;
    if (leash && fire) {
      leash.trader = null;
      entity.remove(CamelLeash);
      hit.panic = Math.max(hit.panic, 2.4);
    }
    if (entity.get(HorseRider)?.mounted || entity.get(HorseRider)?.passenger) return;
    const rest = entity.get(AnimalRest);
    if (hungry && rest?.sleeping) entity.set(AnimalRest, { sleeping: false, birthRestUntil: null });
    if (tamed && !hungry && (rest?.sleeping || world.queryFirst(Sleep))) {
      if (rest && !rest.sleeping) entity.set(AnimalRest, { sleeping: true });
      motion.speed = 0;
      motion.running = false;
      motion.velocityY = 0;
      if (mesh.value) mesh.value.rotation.z = Math.PI / 2;
      return;
    }
    if (tamed && mesh.value) mesh.value.rotation.z = 0;
    const stepDt = dt;
    hit.time = Math.max(0, hit.time - stepDt);
    hit.panic = Math.max(0, hit.panic - stepDt);
    hit.attackIn = Math.max(0, hit.attackIn - stepDt);
    const love = entity.get(AnimalLove);
    if (love) love.time = Math.max(0, love.time - stepDt);
    const aggressive = (animal.kind === 'zombie' || animal.kind === 'bear' || animal.kind === 'snowBear' || animal.kind === 'wolf' || animal.kind === 'snowWolf') && (useGameStore.getState().gameplayMode !== 'creative' || hit.panic > 0);
    const defenseTarget = tamed && owner && WILD_ANIMALS.has(animal.kind) ? findDefenseTarget(world, entity, owner) : null;
    const targetPosition = defenseTarget?.get(AnimalPosition);
    const targetDistanceSquared = targetPosition ? position.distanceToSquared(targetPosition) : Infinity;
    if (tamed && owner && !targetPosition && distanceSquared > 30 * 30) {
      const yaw = Math.atan2(owner.x - position.x, owner.z - position.z);
      const x = owner.x - Math.sin(yaw) * 2.5;
      const z = owner.z - Math.cos(yaw) * 2.5;
      if (isLoaded(world, x, z)) {
        const ground = groundAt(world, x, z, position.y + 24);
        if (walkableGround(world, x, z, ground) && bodyClear(world, x, z, ground)) {
          position.set(x, ground, z);
          rememberSafePosition(world, entity, position);
          distanceSquared = position.distanceToSquared(owner);
        }
      }
    }
    motion.sightIn -= stepDt;
    if (fire) {
      motion.hunting = false;
      motion.yaw = Math.atan2(position.x - fire.x, position.z - fire.z);
      motion.turnIn = Math.max(motion.turnIn, 0.5);
      hit.panic = Math.max(hit.panic, 0.2);
    } else {
      if (aggressive && distanceSquared > 6 * 6) motion.hunting = false;
      else if (aggressive && !tamed && player && !hasEffect('invisibility') && motion.sightIn <= 0) {
        motion.hunting = canSeePlayer(world, position, player, 6);
        motion.sightIn = 0.35;
      }
      if (!aggressive || tamed || !player || hasEffect('invisibility')) motion.hunting = false;
      if (motion.hunting && player) {
        motion.idle = 0;
        motion.yaw = Math.atan2(player.x - position.x, player.z - position.z);
        motion.turnIn = Math.max(motion.turnIn, 0.5);
      }
      if (tamed && owner && (targetPosition || distanceSquared > 2.8 * 2.8)) {
        const target = targetPosition ?? owner;
        const distance = Math.sqrt(targetPosition ? targetDistanceSquared : distanceSquared);
        motion.yaw = Math.atan2(target.x - position.x, target.z - position.z);
        motion.turnIn = Math.max(motion.turnIn, 0.5);
        motion.speed = targetPosition ? 8 : distance > 18 ? 14 : distance > 8 ? 9 : 4.5;
      }
    }
    if (!fire && defenseTarget && targetDistanceSquared < 2.2 * 2.2 && hit.attackIn <= 0) {
      damageAnimal(world, defenseTarget, 1, player, false, false);
      alertAnimalSound(world, entity);
      hit.attackIn = 1.2;
    }
    const canAttack = animal.kind !== 'zombie' || motion.hunting && canZombieAttackPlayer(world, position, player!, motion.displayYaw);
    if (!fire && aggressive && !tamed && playerEntity && player && health && !hasEffect('invisibility') && hit.attackIn <= 0 && distanceSquared < 2.2 * 2.2 && canAttack) {
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
    if (!motion.hunting && motion.avoid <= 0) {
      for (const neighbor of neighbors) {
        if (neighbor.entity === entity || neighbor.stationary || !neighbor.entity.isAlive()) continue;
        const dx = position.x - neighbor.position.x;
        const dz = position.z - neighbor.position.z;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared >= 1.2 * 1.2 || Math.abs(position.y - neighbor.position.y) > 1.2) continue;
        const away = distanceSquared < 0.0001 ? entity * 2.39 : Math.atan2(dx, dz);
        motion.yaw = turnToward(motion.yaw, away + Math.sin(entity * 2.17) * 0.4, stepDt * 1.2);
        motion.turnIn = Math.max(motion.turnIn, 0.5);
        break;
      }
    }

    const zombieNearPlayer = !fire && animal.kind === 'zombie' && !tamed && distanceSquared < 1.8 * 1.8;
    const zombieTooClose = zombieNearPlayer && distanceSquared < 1.35 * 1.35;
    const stayClose = !fire && (tamed && (defenseTarget ? targetDistanceSquared < 2.2 * 2.2 : distanceSquared < 2.8 * 2.8) || zombieNearPlayer);
    const tamedOnPlayer = tamed && distanceSquared < 1.5 * 1.5;
    const tamedNeighbor = tamed ? neighbors.find((neighbor) => neighbor.entity !== entity && isTamedAnimal(neighbor.entity) && position.distanceToSquared(neighbor.position) < 0.65 * 0.65) : undefined;
    if (tamedNeighbor) {
      const dx = position.x - tamedNeighbor.position.x;
      const dz = position.z - tamedNeighbor.position.z;
      const distanceSquared = dx * dx + dz * dz;
      const away = distanceSquared < 0.0001 ? entity * 2.39 : Math.atan2(dx, dz);
      moveInDirection(world, animal.kind, position, motion, away, 3, stepDt, entity);
    } else if (tamedOnPlayer && owner) {
      motion.yaw = Math.atan2(position.x - owner.x, position.z - owner.z);
      moveAnimal(world, animal.kind, position, motion, stepDt, entity, 0, 2.4);
    } else if (stayClose) updateAnimalVertical(world, position, motion, stepDt, entity);
    const home = entity.get(AnimalHome);
    if (zombieTooClose && player) {
      motion.yaw = Math.atan2(position.x - player.x, position.z - player.z);
      moveAnimal(world, animal.kind, position, motion, stepDt, entity, 0, 2.4);
    } else if (home && home.radius > 0 && !tamed) {
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
    for (const neighbor of neighbors) {
      if (neighbor.entity === entity || !neighbor.entity.isAlive()) continue;
      const dx = position.x - neighbor.position.x;
      const dz = position.z - neighbor.position.z;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared >= (tamed ? 0.7 * 0.7 : 0.95 * 0.95) || Math.abs(position.y - neighbor.position.y) > 1.2) continue;
      const away = distanceSquared < 0.0001 ? entity * 2.39 : Math.atan2(dx, dz);
      moveInDirection(world, animal.kind, position, motion, away, 4, stepDt, entity);
      break;
    }
    if (animal.kind === 'zombie' && !tamed && player) separateZombieFromPlayer(world, position, motion, player, entity);
    if (mesh.value) {
      mesh.value.position.copy(position);
      motion.displayYaw = turnToward(motion.displayYaw, motion.yaw, stepDt * 10);
      if (animal.kind === 'zombie') mesh.value.rotation.z = Math.sin(motion.phase) * 0.035;
    }
  });
  syncAnimalState(world, dt);
}
