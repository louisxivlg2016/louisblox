import type { World } from 'koota';
import type { Vector3 } from 'three';
import { GALLERY_ITEM_MAP, isGalleryItem } from './galleryCatalog';
import type { SelectedKind } from './items';
import { Explosion, ExplosionMaterial, ExplosionMesh, ExplosionPosition } from './traits';

export function paintballColor(kind: SelectedKind) {
  return typeof kind === 'string' && isGalleryItem(kind) && GALLERY_ITEM_MAP[kind].category === 'Paintball Items' ? GALLERY_ITEM_MAP[kind].color : null;
}

export function spawnPaintSplash(world: World, position: Vector3, normal: Vector3, color: string) {
  const existing = world.query(Explosion).filter((entity) => entity.get(Explosion)?.paintColor);
  if (existing.length >= 160) existing[0].destroy();
  const direction = normal.clone();
  if (direction.lengthSq() === 0) direction.set(0, 1, 0);
  direction.normalize();
  world.spawn(
    Explosion({ time: 90, maxTime: 90, paintColor: color, paintNormal: direction }),
    ExplosionPosition(position.clone().addScaledVector(direction, 0.015)),
    ExplosionMesh(),
    ExplosionMaterial(),
  );
}

export function clearPaintSplashAt(world: World, x: number, y: number, z: number, radius = 1.75) {
  for (const entity of world.query(Explosion, ExplosionPosition)) {
    if (!entity.get(Explosion)?.paintColor) continue;
    const position = entity.get(ExplosionPosition)!;
    if (Math.hypot(position.x - x, position.y - y, position.z - z) <= radius) entity.destroy();
  }
}
