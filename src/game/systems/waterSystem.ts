import type { World } from 'koota';
import { addVoxel, chunkCoordinate, getBlockIndex } from '../chunks';
import { MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { Chunk } from '../traits';
import { BlockKind, voxelKey } from '../voxel';

const timers = new WeakMap<World, number>();
const directions = [
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

export function waterSystem(world: World, dt: number) {
  const timer = (timers.get(world) ?? 0) - dt;
  if (timer > 0) {
    timers.set(world, timer);
    return;
  }
  timers.set(world, 0.3);

  const blocks = getBlockIndex(world);
  const loaded = new Set(world.query(Chunk).map((entity) => {
    const chunk = entity.get(Chunk)!;
    return `${chunk.x},${chunk.z}`;
  }));
  let added = 0;
  for (const source of blocks.values()) {
    if (source.kind !== BlockKind.Water) continue;
    for (const [dx, dy, dz] of directions) {
      const x = source.x + dx;
      const y = source.y + dy;
      const z = source.z + dz;
      if (y < MIN_WORLD_Y || y > SEA_LEVEL) continue;
      if (blocks.has(voxelKey(x, y, z))) continue;
      if (!loaded.has(`${chunkCoordinate(x)},${chunkCoordinate(z)}`)) continue;
      addVoxel(world, x, y, z, BlockKind.Water);
      added += 1;
      if (added >= 32) return;
      break;
    }
  }
}
