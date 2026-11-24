import type { World } from 'koota';
import { addVoxel, batchVoxelEdits, getBlockIndex, isChunkLoaded, removeVoxel, setVoxelFloodSource, setVoxelWaterlogged } from '../chunks';
import { isCollidable } from './collisionSystem';
import { MIN_WORLD_Y } from '../levels';
import { BlockKind, isWaterBlock, voxelKey } from '../voxel';
import type { Voxel, VoxelHit } from '../voxel';

const directions = [
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

export function drainConnectedWater(world: World, hit: VoxelHit) {
  const blocks = getBlockIndex(world);
  const water: Voxel[] = [hit.block];
  const visited = new Set([voxelKey(hit.x, hit.y, hit.z)]);
  for (let index = 0; index < water.length; index += 1) {
    const source = water[index];
    for (const [dx, dy, dz] of [...directions, [0, 1, 0]] as const) {
      const x = source.x + dx;
      const y = source.y + dy;
      const z = source.z + dz;
      if (y < MIN_WORLD_Y || !isChunkLoaded(world, x, z)) continue;
      const key = voxelKey(x, y, z);
      if (visited.has(key)) continue;
      const block = blocks.get(key);
      if (!isWaterBlock(block?.kind) && block?.waterlogged !== true) continue;
      visited.add(key);
      water.push(block!);
    }
  }
  let drained = 0;
  batchVoxelEdits(world, () => {
    for (const block of water) {
      const key = voxelKey(block.x, block.y, block.z);
      if (blocks.get(key) !== block) continue;
      if (block.waterlogged) {
        setVoxelWaterlogged(world, block, false);
        if (!block.waterlogged) drained += 1;
      } else if (isWaterBlock(block.kind)) {
        removeVoxel(world, { block, x: block.x, y: block.y, z: block.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 });
        if (!blocks.has(key)) drained += 1;
      }
    }
  });
  return drained;
}

const floodClocks = new WeakMap<World, number>();
const MAX_FLOOD_DEPTH = 4;
const MAX_FLOOD_BLOCKS_PER_TICK = 32;

export function waterSystem(world: World, dt: number) {
  const elapsed = (floodClocks.get(world) ?? 0) + dt;
  if (elapsed < 0.35) {
    floodClocks.set(world, elapsed);
    return;
  }
  floodClocks.set(world, 0);
  const blocks = getBlockIndex(world);
  const sources = [...blocks.values()].filter((block) => block.kind === BlockKind.Water && block.floodSource === true && (block.floodDepth ?? 0) < MAX_FLOOD_DEPTH);
  const pending = new Set<string>();
  let added = 0;
  batchVoxelEdits(world, () => {
    for (const source of sources) {
      const depth = (source.floodDepth ?? 0) + 1;
      const below = blocks.get(voxelKey(source.x, source.y - 1, source.z));
      const canFlowDown = source.y - 1 >= MIN_WORLD_Y && isChunkLoaded(world, source.x, source.z) && below === undefined;
      const available = canFlowDown ? [[0, -1, 0] as const] : directions.slice(1);
      for (const [dx, dy, dz] of available) {
        if (added >= MAX_FLOOD_BLOCKS_PER_TICK) return;
        const x = source.x + dx;
        const y = source.y + dy;
        const z = source.z + dz;
        if (y < MIN_WORLD_Y || !isChunkLoaded(world, x, z)) continue;
        const key = voxelKey(x, y, z);
        if (pending.has(key)) continue;
        const target = blocks.get(key);
        if (isWaterBlock(target?.kind) || target !== undefined && (target.protected === true || isCollidable(target))) continue;
        const placed = addVoxel(world, x, y, z, BlockKind.Water, depth, undefined, 0, undefined, undefined, false, true);
        if (!placed) continue;
        placed.floodDepth = depth;
        setVoxelFloodSource(world, placed, true, true);
        pending.add(key);
        added += 1;
      }
    }
  });
}
