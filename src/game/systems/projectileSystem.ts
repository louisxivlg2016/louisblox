import type { World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex, explodeVoxels } from '../chunks';
import { damageAnimal, findAnimalTarget } from '../combat';
import { AnimalPosition, Explosion, ExplosionMaterial, ExplosionMesh, ExplosionPosition, Projectile, ProjectileMesh, ProjectilePosition, ProjectileVelocity } from '../traits';
import { MIN_WORLD_Y } from '../levels';
import { raycastVoxel } from '../voxel';

const step = new Vector3();
const next = new Vector3();

export function fireProjectile(world: World, origin: Vector3, direction: Vector3, kind: 'arrow' | 'bullet' | 'bomb') {
  const velocity = direction.clone().normalize().multiplyScalar(kind === 'bullet' ? 48 : kind === 'bomb' ? 18 : 30);
  const position = origin.clone().addScaledVector(direction, 0.8);
  return world.spawn(
    Projectile({ kind, life: kind === 'bullet' ? 1.5 : 8, damage: 1 }),
    ProjectilePosition(position),
    ProjectileVelocity(velocity),
    ProjectileMesh(),
  );
}

export function detonateProjectile(world: World, position: Vector3) {
  explodeVoxels(world, position.x, position.y, position.z, 2.8);
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
    step.copy(velocity).multiplyScalar(dt);
    const distance = step.length();
    next.copy(position).add(step);
    const direction = step.normalize();
    const hit = raycastVoxel(blocks, position, direction, distance);
    const target = findAnimalTarget(world, position, direction, distance + 0.7);
    if (target && (!hit || target.distance < hit.distance)) {
      const animalPosition = target.entity.get(AnimalPosition)!;
      if (projectile.kind === 'bomb') detonateProjectile(world, animalPosition);
      else damageAnimal(world, target.entity, projectile.damage, position);
      entity.destroy();
      return;
    }
    if (hit || next.y < MIN_WORLD_Y || projectile.life <= 0) {
      if (projectile.kind === 'bomb') {
        if (hit) next.set(hit.x + hit.normal.x * 0.6, hit.y + hit.normal.y * 0.6, hit.z + hit.normal.z * 0.6);
        detonateProjectile(world, next);
      }
      entity.destroy();
      return;
    }
    position.copy(next);
    const mesh = entity.get(ProjectileMesh)?.value;
    if (mesh) {
      mesh.position.copy(position);
      next.copy(position).add(velocity);
      mesh.lookAt(next);
    }
  });
}
