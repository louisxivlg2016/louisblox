import type { World } from 'koota';
import { addVoxel, batchVoxelEdits, getBlockIndex, getWaterIndex, isChunkLoaded } from '../chunks';
import { MIN_WORLD_Y } from '../levels';
import { Player, PlayerPosition } from '../traits';
import { BlockKind, voxelKey } from '../voxel';

const timers = new WeakMap<World, number>();
const directions = [
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

type FlowCandidate = { x: number; y: number; z: number; priority: number };

export function waterSystem(world: World, dt: number) {
  const timer = (timers.get(world) ?? 0) - dt;
  if (timer > 0) {
    timers.set(world, timer);
    return;
  }
  timers.set(world, 0.2);
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return;
  const blocks = getBlockIndex(world);
  const candidates = new Map<string, FlowCandidate>();

  for (const source of getWaterIndex(world).values()) {
    if (Math.abs(source.x - player.x) > 20 || Math.abs(source.z - player.z) > 20) continue;
    for (const [dx, dy, dz] of directions) {
      const x = source.x + dx;
      const y = source.y + dy;
      const z = source.z + dz;
      if (y < MIN_WORLD_Y) continue;
      const key = voxelKey(x, y, z);
      if (blocks.has(key) || !isChunkLoaded(world, x, z)) continue;
      const priority = (x - player.x) ** 2 + (z - player.z) ** 2 + (dy === 0 ? 0.5 : 0);
      const previous = candidates.get(key);
      if (!previous || priority < previous.priority) candidates.set(key, { x, y, z, priority });
    }
  }

  const flowing = [...candidates.values()].sort((a, b) => a.priority - b.priority || b.y - a.y);
  batchVoxelEdits(world, () => {
    for (const target of flowing.slice(0, 48)) {
      addVoxel(world, target.x, target.y, target.z, BlockKind.Water);
    }
  });
}
