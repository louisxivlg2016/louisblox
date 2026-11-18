import type { World } from 'koota';
import { addVoxel, batchVoxelEdits, getBlockIndex, getWaterIndex, isChunkLoaded, removeVoxel, setVoxelFloodSource, setVoxelWaterlogged } from '../chunks';
import { MIN_WORLD_Y } from '../levels';
import { Player, PlayerPosition } from '../traits';
import { hasWaterOpening } from '../extraBlocks';
import { BlockKind, isWaterBlock, voxelKey } from '../voxel';
import type { Voxel, VoxelHit } from '../voxel';

const timers = new WeakMap<World, number>();
const directions = [
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

type FlowCandidate = { source: Voxel; x: number; y: number; z: number; priority: number; lateral: boolean };
const flowEnergy = new WeakMap<Voxel, number>();
const FLOW_DISTANCE = 12;

function canEnter(world: World, blocks: ReadonlyMap<string, Voxel>, x: number, y: number, z: number) {
  if (y < MIN_WORLD_Y || !isChunkLoaded(world, x, z)) return false;
  const target = blocks.get(voxelKey(x, y, z));
  return !target || hasWaterOpening(target) && !target.waterlogged;
}

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
      } else {
        removeVoxel(world, { block, x: block.x, y: block.y, z: block.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 });
        if (!blocks.has(key)) drained += 1;
      }
    }
  });
  return drained;
}

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
  const candidates: FlowCandidate[] = [];

  for (const source of getWaterIndex(world).values()) {
    if (Math.abs(source.x - player.x) > 20 || Math.abs(source.z - player.z) > 20) continue;
    const energy = flowEnergy.get(source) ?? 0;
    const unlimited = source.floodSource === true;
    for (const [dx, dy, dz] of directions) {
      const x = source.x + dx;
      const y = source.y + dy;
      const z = source.z + dz;
      if (!canEnter(world, blocks, x, y, z)) continue;
      const lateral = dy === 0;
      if (lateral && !unlimited && energy === 0 && !canEnter(world, blocks, x, y - 1, z)) continue;
      candidates.push({ source, x, y, z, priority: (unlimited ? -1 : lateral ? 1 : 0) + (x - player.x) ** 2 * 0.0001 + (z - player.z) ** 2 * 0.0001, lateral });
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);
  batchVoxelEdits(world, () => {
    let moved = 0;
    for (const candidate of candidates) {
      if (moved >= 48) break;
      const { source, x, y, z, lateral } = candidate;
      if (blocks.get(voxelKey(source.x, source.y, source.z)) !== source || !canEnter(world, blocks, x, y, z)) continue;
      const energy = flowEnergy.get(source) ?? 0;
      const existing = blocks.get(voxelKey(x, y, z));
      const target = existing ? setVoxelWaterlogged(world, existing, true, true) : addVoxel(world, x, y, z, BlockKind.Water);
      if (!target) continue;
      if (source.floodSource) {
        setVoxelFloodSource(world, target, true, true);
        moved += 1;
        continue;
      }
      if (source.waterlogged) setVoxelWaterlogged(world, source, false, true);
      else removeVoxel(world, { block: source, x: source.x, y: source.y, z: source.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, true);
      flowEnergy.delete(source);
      flowEnergy.set(target, lateral ? energy > 0 ? energy - 1 : FLOW_DISTANCE : Math.max(energy, FLOW_DISTANCE));
      moved += 1;
    }
  });
}
