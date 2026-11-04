import type { World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex } from './chunks';
import { spawnPaintStroke } from './paintball';
import { syncPaintStroke } from './projectileSync';
import { raycastVoxel } from './voxel';

const previous = new WeakMap<World, { point: Vector3; normal: Vector3 }>();

export function endPaintStroke(world: World) {
  previous.delete(world);
}

export function drawPaintStroke(world: World, origin: Vector3, direction: Vector3, color: string) {
  const hit = raycastVoxel(getBlockIndex(world), origin, direction, 60);
  if (!hit) {
    endPaintStroke(world);
    return;
  }
  const point = origin.clone().addScaledVector(direction, hit.distance);
  const normal = new Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
  const last = previous.get(world);
  if (!last || last.point.distanceToSquared(point) > 0.000001) {
    const from = last && last.normal.equals(normal) && last.point.distanceTo(point) <= 1.5 ? last.point : point;
    spawnPaintStroke(world, from, point, normal, color);
    syncPaintStroke(world, from, point, normal, color);
  }
  previous.set(world, { point, normal });
}
