import type { World } from 'koota';
import { getBlockIndex, isChunkLoaded } from '../chunks';
import { MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { groundAt } from '../vehicles';
import { BlockKind, isWaterBlock, voxelKey } from '../voxel';
import { isDoor } from '../extraBlocks';
import { canOccupyVoxelCharacter, isCollidable } from './collisionSystem';

const foliage = new Set<BlockKind>([BlockKind.Leaves, BlockKind.PineLeaves, BlockKind.AutumnLeaves, BlockKind.JungleLeaves, BlockKind.JungleVine, BlockKind.Apple]);

export function walkableGround(world: World, x: number, z: number, currentY: number, rise = 1.05, outside = false) {
  if (!isChunkLoaded(world, x, z)) return null;
  const blocks = getBlockIndex(world);
  const climb = Math.min(rise, 1.05);
  let ground = groundAt(world, x, z, currentY + climb);
  const overhead = blocks.get(voxelKey(Math.round(x), Math.floor(ground), Math.round(z)));
  if (overhead && foliage.has(overhead.kind) && ground > currentY + 1.05) ground = groundAt(world, x, z, currentY + 1.05);
  if (ground > currentY + 1.05) {
    const doorway = blocks.get(voxelKey(Math.round(x), Math.round(currentY + 0.5), Math.round(z)));
    if (doorway && isDoor(doorway.kind) && doorway.open) ground = groundAt(world, x, z, currentY + 0.51);
  }
  let swimming = false;
  for (let y = Math.max(Math.floor(ground), Math.floor(currentY - 8)); y <= Math.floor(currentY + rise); y += 1) {
    const block = blocks.get(voxelKey(Math.round(x), y, Math.round(z)));
    if (!isWaterBlock(block?.kind)) continue;
    ground = y + 0.5;
    swimming = true;
  }
  if (ground <= MIN_WORLD_Y + 0.5) return null;
  if (!swimming && ground < SEA_LEVEL + 0.5) return null;
  if (ground - currentY > climb || currentY - ground > 8.05) return null;
  const groundBlock = blocks.get(voxelKey(Math.round(x), Math.floor(ground), Math.round(z)));
  if (groundBlock && foliage.has(groundBlock.kind)) return null;
  for (const height of [0.5, 1.75]) {
    const block = blocks.get(voxelKey(Math.round(x), Math.round(ground + height), Math.round(z)));
    if (block && (isCollidable(block) || !swimming && isWaterBlock(block.kind))) return null;
  }
  if (!swimming && !canOccupyVoxelCharacter(blocks, { x, y: ground + 0.01, z })) return null;
  if (outside) for (let height = 3; height <= 24; height += 1) {
    const block = blocks.get(voxelKey(Math.round(x), Math.round(ground + height), Math.round(z)));
    if (block && isCollidable(block) && !foliage.has(block.kind)) return null;
  }
  return ground;
}

export function clearRoute(world: World, x: number, y: number, z: number, yaw: number, distance: number) {
  for (let step = 1; step <= distance; step++) {
    if (walkableGround(world, x + Math.sin(yaw) * step, z + Math.cos(yaw) * step, y, 1.05, true) === null) return false;
  }
  return true;
}

export function routeDirection(world: World, position: import('three').Vector3, yaw: number, distance = 10) {
  const offsets = [0, 0.45, -0.45];
  return offsets.map((offset) => yaw + offset).find((candidate) => clearRoute(world, position.x, position.y, position.z, candidate, distance));
}

type PathNode = { x: number; y: number; z: number; g: number; f: number; parent: PathNode | null };

export function findPath(world: World, position: import('three').Vector3, targetX: number, targetZ: number, outside = true) {
  const yaw = Math.atan2(targetX - position.x, targetZ - position.z);
  let goal: { x: number; y: number; z: number } | null = null;
  if (Math.hypot(targetX - position.x, targetZ - position.z) <= 12) {
    const x = Math.round(targetX);
    const z = Math.round(targetZ);
    const ground = walkableGround(world, x, z, position.y, 1.05, outside);
    if (ground !== null) goal = { x, y: ground, z };
  }
  for (const distance of [12, 18, 24]) {
    if (goal) break;
    const x = Math.round(position.x + Math.sin(yaw) * distance);
    const z = Math.round(position.z + Math.cos(yaw) * distance);
    const ground = walkableGround(world, x, z, position.y, 1.05, outside);
    if (ground !== null) {
      goal = { x, y: ground, z };
      break;
    }
  }
  if (!goal) return null;
  const start = { x: Math.round(position.x), z: Math.round(position.z) };
  const heuristic = (x: number, z: number) => Math.abs(goal.x - x) + Math.abs(goal.z - z);
  const open: PathNode[] = [{ x: start.x, y: position.y, z: start.z, g: 0, f: heuristic(start.x, start.z), parent: null }];
  const best = new Map<string, number>([[`${start.x},${start.z}`, 0]]);
  const closed = new Set<string>();
  let visited = 0;
  while (open.length > 0 && visited < 1200) {
    let bestIndex = 0;
    for (let index = 1; index < open.length; index++) if (open[index].f < open[bestIndex].f) bestIndex = index;
    const current = open.splice(bestIndex, 1)[0];
    const key = `${current.x},${current.z}`;
    if (closed.has(key)) continue;
    closed.add(key);
    visited++;
    if (current.x === goal.x && current.z === goal.z) {
      const path: Array<{ x: number; y: number; z: number }> = [];
      let cursor: PathNode | null = current;
      while (cursor?.parent) {
        path.unshift({ x: cursor.x, y: cursor.y, z: cursor.z });
        cursor = cursor.parent;
      }
      return path;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = current.x + dx;
      const z = current.z + dz;
      if (Math.abs(x - start.x) > 26 || Math.abs(z - start.z) > 26) continue;
      const ground = walkableGround(world, x, z, current.y, 1.05, outside);
      if (ground === null) continue;
      const neighborKey = `${x},${z}`;
      if (closed.has(neighborKey)) continue;
      const g = current.g + 1;
      if (g >= (best.get(neighborKey) ?? Infinity)) continue;
      best.set(neighborKey, g);
      open.push({ x, y: ground, z, g, f: g + heuristic(x, z), parent: current });
    }
  }
  return null;
}
