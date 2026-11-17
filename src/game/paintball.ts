import { create } from 'zustand';
import type { World } from 'koota';
import { Vector3 } from 'three';
import { GALLERY_ITEM_MAP, isGalleryItem } from './galleryCatalog';
import type { GalleryItemId } from './galleryCatalog';
import type { SelectedKind } from './items';
import { Explosion, ExplosionMaterial, ExplosionMesh, ExplosionPosition } from './traits';
import { translate } from './language';

export const WHITE_PAINTBALL_GUN_ID = 'gallery_paintball_white_paintball_gun' as const;
export const PAINT_COLORS = () => [
  { name: translate('Rouge', 'Red'), value: '#c93d35' },
  { name: 'Orange', value: '#df8730' },
  { name: translate('Jaune', 'Yellow'), value: '#dfc33c' },
  { name: 'Lime', value: '#71ad3f' },
  { name: translate('Vert', 'Green'), value: '#478c42' },
  { name: 'Cyan', value: '#43a9b3' },
  { name: translate('Bleu', 'Blue'), value: '#4567b5' },
  { name: translate('Bleu clair', 'Light Blue'), value: '#65a8d8' },
  { name: translate('Rose', 'Pink'), value: '#db87a7' },
  { name: translate('Violet', 'Purple'), value: '#7850a7' },
  { name: 'Magenta', value: '#b454af' },
  { name: translate('Marron', 'Brown'), value: '#795238' },
  { name: translate('Blanc', 'White'), value: '#e4e7df' },
  { name: translate('Gris clair', 'Light Gray'), value: '#a7b0b4' },
  { name: translate('Gris', 'Gray'), value: '#666d75' },
  { name: translate('Noir', 'Black'), value: '#2b3038' },
];
type PaintColor = ReturnType<typeof PAINT_COLORS>[number]['value'];

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
    if (PAINT_COLORS().some((color) => color.value === saved)) return saved as PaintColor;
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

export function spawnPaintStroke(world: World, from: Vector3, to: Vector3, normal: Vector3, color: string, width = 0.1, exact = false) {
  const direction = normal.clone();
  if (direction.lengthSq() === 0) direction.set(0, 1, 0);
  direction.normalize();
  const paintFrom = from.clone();
  const paintTo = to.clone();
  if (!exact) {
    paintFrom.addScaledVector(direction, 0.012);
    paintTo.addScaledVector(direction, 0.012);
  }
  world.spawn(
    Explosion({ time: Infinity, maxTime: Infinity, paintColor: color, paintNormal: direction, paintFrom, paintTo, paintWidth: exact ? width : width * (0.9 + Math.sin(from.x * 19.3 + from.y * 13.7 + from.z * 7.1) * 0.12) }),
    ExplosionPosition(paintFrom.clone().add(paintTo).multiplyScalar(0.5)),
    ExplosionMesh(),
    ExplosionMaterial(),
  );
}

export function spawnPaintSplash(world: World, position: Vector3, normal: Vector3, color: string) {
  spawnPaintStroke(world, position, position, normal, color);
}

type SavedVector = [number, number, number];
export type SavedPaintStroke = { color: string; normal: SavedVector; from: SavedVector; to: SavedVector; width: number };

const saveVector = (vector: Vector3): SavedVector => [vector.x, vector.y, vector.z];

export function snapshotPaintStrokes(world: World): SavedPaintStroke[] {
  const strokes: SavedPaintStroke[] = [];
  for (const entity of world.query(Explosion)) {
    const paint = entity.get(Explosion);
    if (!paint?.paintColor || !paint.paintNormal || !paint.paintFrom || !paint.paintTo) continue;
    strokes.push({ color: paint.paintColor, normal: saveVector(paint.paintNormal), from: saveVector(paint.paintFrom), to: saveVector(paint.paintTo), width: paint.paintWidth ?? 0.1 });
  }
  return strokes;
}

function restoredVector(value: unknown) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))) return null;
  return new Vector3(value[0], value[1], value[2]);
}

export function restorePaintStrokes(world: World, saved: unknown) {
  if (!Array.isArray(saved)) return;
  for (const entry of saved) {
    if (!entry || typeof entry !== 'object') continue;
    const stroke = entry as Partial<SavedPaintStroke>;
    const normal = restoredVector(stroke.normal);
    const from = restoredVector(stroke.from);
    const to = restoredVector(stroke.to);
    if (!normal || !from || !to || typeof stroke.color !== 'string' || typeof stroke.width !== 'number' || !Number.isFinite(stroke.width) || stroke.width <= 0) continue;
    spawnPaintStroke(world, from, to, normal, stroke.color.slice(0, 32), stroke.width, true);
  }
}

export function clearAllPaint(world: World) {
  let removed = 0;
  for (const entity of [...world.query(Explosion)]) {
    if (!entity.get(Explosion)?.paintColor) continue;
    entity.destroy();
    removed += 1;
  }
  return removed;
}

export function clearPaintSplashAt(world: World, x: number, y: number, z: number) {
  for (const entity of world.query(Explosion, ExplosionPosition)) {
    const explosion = entity.get(Explosion);
    if (!explosion?.paintColor) continue;
    const position = entity.get(ExplosionPosition)!;
    const from = explosion.paintFrom ?? position;
    const to = explosion.paintTo ?? position;
    const segment = to.clone().sub(from);
    const lengthSquared = segment.lengthSq();
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, new Vector3(x - from.x, y - from.y, z - from.z).dot(segment) / lengthSquared)) : 0;
    const closest = from.clone().addScaledVector(segment, t);
    if (Math.abs(closest.x - x) <= 0.56 && Math.abs(closest.y - y) <= 0.56 && Math.abs(closest.z - z) <= 0.56) entity.destroy();
  }
}
