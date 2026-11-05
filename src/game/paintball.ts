import { create } from 'zustand';
import type { World } from 'koota';
import type { Vector3 } from 'three';
import { GALLERY_ITEM_MAP, isGalleryItem } from './galleryCatalog';
import type { GalleryItemId } from './galleryCatalog';
import type { SelectedKind } from './items';
import { Explosion, ExplosionMaterial, ExplosionMesh, ExplosionPosition } from './traits';

export const WHITE_PAINTBALL_GUN_ID = 'gallery_paintball_white_paintball_gun' as const;
export const PAINT_COLORS = [
  { name: 'Rouge', value: '#c93d35' },
  { name: 'Orange', value: '#df8730' },
  { name: 'Jaune', value: '#dfc33c' },
  { name: 'Lime', value: '#71ad3f' },
  { name: 'Vert', value: '#478c42' },
  { name: 'Cyan', value: '#43a9b3' },
  { name: 'Bleu', value: '#4567b5' },
  { name: 'Bleu clair', value: '#65a8d8' },
  { name: 'Rose', value: '#db87a7' },
  { name: 'Violet', value: '#7850a7' },
  { name: 'Magenta', value: '#b454af' },
  { name: 'Marron', value: '#795238' },
  { name: 'Blanc', value: '#e4e7df' },
  { name: 'Gris clair', value: '#a7b0b4' },
  { name: 'Gris', value: '#666d75' },
  { name: 'Noir', value: '#2b3038' },
] as const;
type PaintColor = (typeof PAINT_COLORS)[number]['value'];

export function isPaintballGun(kind: unknown): kind is GalleryItemId {
  return typeof kind === 'string' && isGalleryItem(kind) && GALLERY_ITEM_MAP[kind].category === 'Paintball Items' && GALLERY_ITEM_MAP[kind].shape === 'gun';
}

export function normalizePaintballGun(kind: SelectedKind): SelectedKind {
  return isPaintballGun(kind) ? WHITE_PAINTBALL_GUN_ID : kind;
}

export function normalizePaintballCounts(counts: Partial<Record<string, number>> | undefined) {
  const normalized: Record<string, number> = {};
  let whiteCount = 0;
  for (const [kind, count] of Object.entries(counts ?? {})) {
    if (typeof count !== 'number') continue;
    if (isPaintballGun(kind)) whiteCount += count;
    else normalized[kind] = count;
  }
  if (whiteCount > 0) normalized[WHITE_PAINTBALL_GUN_ID] = whiteCount;
  return normalized;
}

function initialPaintColor(): PaintColor {
  try {
    const saved = localStorage.getItem('louisblox-paint-color');
    if (PAINT_COLORS.some((color) => color.value === saved)) return saved as PaintColor;
  } catch {
  }
  return '#e4e7df';
}

export const usePaintballStore = create<{ color: PaintColor; setColor: (color: PaintColor) => void }>((set) => ({
  color: initialPaintColor(),
  setColor: (color) => {
    try {
      localStorage.setItem('louisblox-paint-color', color);
    } catch {
    }
    set({ color });
  },
}));

export function paintballColor(kind: SelectedKind) {
  return isPaintballGun(kind) ? usePaintballStore.getState().color : null;
}

export function spawnPaintStroke(world: World, from: Vector3, to: Vector3, normal: Vector3, color: string, width = 0.1) {
  const direction = normal.clone();
  if (direction.lengthSq() === 0) direction.set(0, 1, 0);
  direction.normalize();
  const paintFrom = from.clone();
  const paintTo = to.clone();
  world.spawn(
    Explosion({ time: Infinity, maxTime: Infinity, paintColor: color, paintNormal: direction, paintFrom, paintTo, paintWidth: width * (0.9 + Math.sin(from.x * 19.3 + from.y * 13.7 + from.z * 7.1) * 0.12) }),
    ExplosionPosition(paintFrom.clone().add(paintTo).multiplyScalar(0.5).addScaledVector(direction, 0.015)),
    ExplosionMesh(),
    ExplosionMaterial(),
  );
}

export function spawnPaintSplash(world: World, position: Vector3, normal: Vector3, color: string) {
  spawnPaintStroke(world, position, position, normal, color);
}

export function clearPaintSplashAt(world: World, x: number, y: number, z: number, radius = 1.75) {
  for (const entity of world.query(Explosion, ExplosionPosition)) {
    if (!entity.get(Explosion)?.paintColor) continue;
    const position = entity.get(ExplosionPosition)!;
    if (Math.hypot(position.x - x, position.y - y, position.z - z) <= radius) entity.destroy();
  }
}
