import type { World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex, explodeVoxels } from '../chunks';
import { damageAnimal, findAnimalTarget } from '../combat';
import { damageBattlePlayersInRadius, findBattleTarget } from '../battleCombat';
import { requestBattleHit } from '../battle';
import { syncProjectileMotion, syncProjectileRemoval, syncProjectileSpawn } from '../projectileSync';
import { AnimalPosition, Explosion, ExplosionMaterial, ExplosionMesh, ExplosionPosition, Projectile, ProjectileMesh, ProjectilePosition, ProjectileVelocity } from '../traits';
import { MIN_WORLD_Y } from '../levels';
import { raycastVoxel } from '../voxel';
import { spawnPaintSplash } from '../paintball';
import { playSound } from '../audio';

const step = new Vector3();
const next = new Vector3();

function paintImpact(world: World, color: string | undefined, position: Vector3, normal: Vector3) {
  if (!color) return undefined;
  spawnPaintSplash(world, position, normal, color);
  return { position: position.clone(), normal: normal.clone() };
}

export function fireProjectile(world: World, origin: Vector3, direction: Vector3, kind: 'arrow' | 'bullet' | 'bomb', damage = 1, color?: string | null) {
  if (kind !== 'arrow' && !color) playSound('gunshot', 0.45);
  const velocity = direction.clone().normalize().multiplyScalar(kind === 'bullet' ? 48 : kind === 'bomb' ? 18 : 30);
  const position = origin.clone().addScaledVector(direction, 0.8);
  const entity = world.spawn(
    Projectile({ id: crypto.randomUUID(), kind, life: kind === 'bullet' ? 1.5 : 8, damage, color: color ?? undefined }),
    ProjectilePosition(position),
    ProjectileVelocity(velocity),
    ProjectileMesh(),
  );
  syncProjectileSpawn(world, entity);
  return entity;
}

export function detonateProjectile(world: World, position: Vector3, damagePlayers = true) {
  playSound('explosion', 0.6);
  explodeVoxels(world, position.x, position.y, position.z, 2.8);
  if (damagePlayers) damageBattlePlayersInRadius(world, position, 3.5);
  world.spawn(
    Explosion({ time: 0.45, maxTime: 0.45 }),
    ExplosionPosition(position.clone()),
    ExplosionMesh(),
    ExplosionMaterial(),
  );
}

export function projectileSystem(world: World, dt: number) {
  const blocks = getBlockIndex(world);
  world.query(Projectile, ProjectilePosition, ProjectileVelocity).updateEach(([projectile, position, velocity], entity) => {
    projectile.life -= dt;
    if (projectile.kind === 'bomb') velocity.y -= 8 * dt;
    if (projectile.remote) {
      if (projectile.life <= 0) {
        entity.destroy();
        return;
      }
      if (projectile.kind === 'bomb') {
        step.copy(velocity).multiplyScalar(dt);
        const distance = step.length();
        const hit = raycastVoxel(blocks, position, step.normalize(), distance);
        if (hit) {
          position.set(hit.x + hit.normal.x * 0.6, hit.y + hit.normal.y * 0.6, hit.z + hit.normal.z * 0.6);
          detonateProjectile(world, position, false);
          syncProjectileRemoval(world, entity, true);
          entity.destroy();
          return;
        }
      }
      position.addScaledVector(velocity, dt);
    } else {
      step.copy(velocity).multiplyScalar(dt);
      const distance = step.length();
      next.copy(position).add(step);
      const direction = step.normalize();
      const hit = raycastVoxel(blocks, position, direction, distance);
      const playerTarget = findBattleTarget(world, position, direction, distance + 1.2);
      if (playerTarget && (!hit || playerTarget.distance < hit.distance)) {
        if (projectile.kind === 'bomb') {
          position.copy(playerTarget.position);
          detonateProjectile(world, position);
        } else {
          requestBattleHit(playerTarget.playerId, projectile.kind === 'bullet' && projectile.damage > 1 ? 'rifle' : projectile.kind);
        }
        const paint = paintImpact(world, projectile.color, playerTarget.position, direction.clone().negate());
        syncProjectileRemoval(world, entity, projectile.kind === 'bomb', paint);
        entity.destroy();
        return;
      }
      const target = findAnimalTarget(world, position, direction, distance + 0.7);
      if (target && (!hit || target.distance < hit.distance)) {
        const animalPosition = target.entity.get(AnimalPosition)!;
        if (projectile.kind === 'bomb') {
          position.copy(animalPosition);
          detonateProjectile(world, position);
        } else {
          damageAnimal(world, target.entity, projectile.damage, position);
        }
        const paint = paintImpact(world, projectile.color, animalPosition, direction.clone().negate());
        syncProjectileRemoval(world, entity, projectile.kind === 'bomb', paint);
        entity.destroy();
        return;
      }
      if (hit || next.y < MIN_WORLD_Y || projectile.life <= 0) {
        if (projectile.kind === 'bomb') {
          if (hit) next.set(hit.x + hit.normal.x * 0.6, hit.y + hit.normal.y * 0.6, hit.z + hit.normal.z * 0.6);
          position.copy(next);
          detonateProjectile(world, position);
        }
        const paint = hit ? paintImpact(world, projectile.color, position.clone().addScaledVector(direction, hit.distance), new Vector3(hit.normal.x, hit.normal.y, hit.normal.z)) : undefined;
        syncProjectileRemoval(world, entity, projectile.kind === 'bomb', paint);
        entity.destroy();
        return;
      }
      position.copy(next);
      syncProjectileMotion(world, entity);
    }
    const mesh = entity.get(ProjectileMesh)?.value;
    if (mesh) {
      mesh.position.copy(position);
      next.copy(position).add(velocity);
      mesh.lookAt(next);
    }
  });
}
