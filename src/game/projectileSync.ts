import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { Explosion, ExplosionMaterial, ExplosionMesh, ExplosionPosition, Projectile, ProjectileMesh, ProjectilePosition, ProjectileVelocity } from './traits';
import { spawnPaintSplash } from './paintball';

export type ProjectileSnapshot = {
  id: string;
  kind: 'arrow' | 'bullet' | 'bomb';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  damage: number;
  color?: string;
};

export type ExplosionSnapshot = { x: number; y: number; z: number };
export type PaintSplashSnapshot = { x: number; y: number; z: number; nx: number; ny: number; nz: number; color: string };
export type ProjectileSyncMessage =
  | { type: 'projectile-spawn' | 'projectile-state'; projectile: ProjectileSnapshot }
  | { type: 'projectile-remove'; projectileId: string; explosion?: ExplosionSnapshot; paint?: PaintSplashSnapshot };

export function isProjectileSnapshot(value: unknown): value is ProjectileSnapshot {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.id === 'string' && data.id.length > 0 && data.id.length <= 80
    && (data.kind === 'arrow' || data.kind === 'bullet' || data.kind === 'bomb')
    && ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'damage'].every((key) => typeof data[key] === 'number' && Number.isFinite(data[key]))
    && (data.life as number) >= 0 && (data.life as number) <= 30
    && (data.damage as number) >= 0 && (data.damage as number) <= 100
    && (data.color === undefined || typeof data.color === 'string' && /^#[0-9a-f]{6}$/i.test(data.color));
}

export function isExplosionSnapshot(value: unknown): value is ExplosionSnapshot | undefined {
  return value === undefined || Boolean(value && typeof value === 'object'
    && ['x', 'y', 'z'].every((key) => typeof (value as Record<string, unknown>)[key] === 'number' && Number.isFinite((value as Record<string, unknown>)[key])));
}

export function isPaintSplashSnapshot(value: unknown): value is PaintSplashSnapshot | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.color === 'string' && /^#[0-9a-f]{6}$/i.test(data.color)
    && ['x', 'y', 'z', 'nx', 'ny', 'nz'].every((key) => typeof data[key] === 'number' && Number.isFinite(data[key]));
}

type Listener = (message: ProjectileSyncMessage) => void;
const listeners = new WeakMap<World, Set<Listener>>();
const applying = new WeakMap<World, boolean>();
const motionTimes = new WeakMap<World, number>();

export function onProjectileSync(world: World, listener: Listener) {
  let worldListeners = listeners.get(world);
  if (!worldListeners) {
    worldListeners = new Set();
    listeners.set(world, worldListeners);
  }
  worldListeners.add(listener);
  return () => worldListeners.delete(listener);
}

function emit(world: World, message: ProjectileSyncMessage) {
  if (applying.get(world)) return;
  for (const listener of listeners.get(world) ?? []) listener(message);
}

function snapshotFromEntity(entity: Entity): ProjectileSnapshot | null {
  const projectile = entity.get(Projectile);
  const position = entity.get(ProjectilePosition);
  const velocity = entity.get(ProjectileVelocity);
  if (!projectile?.id || !position || !velocity) return null;
  return {
    id: projectile.id,
    kind: projectile.kind,
    x: position.x,
    y: position.y,
    z: position.z,
    vx: velocity.x,
    vy: velocity.y,
    vz: velocity.z,
    life: Math.max(0, projectile.life),
    damage: projectile.damage,
    color: projectile.color,
  };
}

export function syncProjectileSpawn(world: World, entity: Entity) {
  const projectile = snapshotFromEntity(entity);
  if (projectile) emit(world, { type: 'projectile-spawn', projectile });
}

export function syncProjectileMotion(world: World, entity: Entity) {
  const now = performance.now();
  if (now - (motionTimes.get(world) ?? 0) < 50) return;
  const projectile = snapshotFromEntity(entity);
  if (!projectile) return;
  motionTimes.set(world, now);
  emit(world, { type: 'projectile-state', projectile });
}

export function syncProjectileRemoval(world: World, entity: Entity, exploded: boolean, paint?: { position: Vector3; normal: Vector3 }) {
  const projectile = entity.get(Projectile);
  const position = entity.get(ProjectilePosition);
  if (!projectile?.id || !position) return;
  emit(world, {
    type: 'projectile-remove',
    projectileId: projectile.id,
    explosion: exploded ? { x: position.x, y: position.y, z: position.z } : undefined,
    paint: paint && projectile.color ? { x: paint.position.x, y: paint.position.y, z: paint.position.z, nx: paint.normal.x, ny: paint.normal.y, nz: paint.normal.z, color: projectile.color } : undefined,
  });
}

export function applyProjectileSnapshot(world: World, snapshot: ProjectileSnapshot) {
  const existing = world.query(Projectile).find((entity) => entity.get(Projectile)?.id === snapshot.id);
  if (existing && !existing.get(Projectile)?.remote) return;
  applying.set(world, true);
  try {
    if (existing) {
      existing.set(Projectile, { life: snapshot.life, damage: snapshot.damage, color: snapshot.color });
      existing.get(ProjectilePosition)?.set(snapshot.x, snapshot.y, snapshot.z);
      existing.get(ProjectileVelocity)?.set(snapshot.vx, snapshot.vy, snapshot.vz);
    } else {
      world.spawn(
        Projectile({ id: snapshot.id, kind: snapshot.kind, life: snapshot.life, damage: snapshot.damage, remote: true, color: snapshot.color }),
        ProjectilePosition(new Vector3(snapshot.x, snapshot.y, snapshot.z)),
        ProjectileVelocity(new Vector3(snapshot.vx, snapshot.vy, snapshot.vz)),
        ProjectileMesh(),
      );
    }
  } finally {
    applying.set(world, false);
  }
}

export function applyProjectileRemoval(world: World, projectileId: string, explosion?: ExplosionSnapshot, paint?: PaintSplashSnapshot) {
  applying.set(world, true);
  try {
    for (const entity of world.query(Projectile)) {
      const projectile = entity.get(Projectile);
      if (projectile?.remote && projectile.id === projectileId) entity.destroy();
    }
    if (explosion) {
      world.spawn(
        Explosion({ time: 0.45, maxTime: 0.45 }),
        ExplosionPosition(new Vector3(explosion.x, explosion.y, explosion.z)),
        ExplosionMesh(),
        ExplosionMaterial(),
      );
    }
    if (paint) spawnPaintSplash(world, new Vector3(paint.x, paint.y, paint.z), new Vector3(paint.nx, paint.ny, paint.nz), paint.color);
  } finally {
    applying.set(world, false);
  }
}
