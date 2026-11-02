import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

export const MAZE_LANES = [-18, -14, -10, -6, -2, 2, 6, 10, 14, 18] as const;
export const MAZE_BARRIERS = MAZE_LANES.flatMap((x) => [{ x, y: 9, z: 21 }, { x, y: 10, z: 21 }]);
export const MAZE_OVERVIEW = { x: 0, y: 16.51, z: 24 };

export function mazeSpawn(index: number) {
  return { x: MAZE_LANES[Math.abs(index) % MAZE_LANES.length], y: 8.51, z: 23 };
}

function mazeWalls() {
  const size = 21;
  const walls = new Set<string>();
  for (let x = 0; x < size * 2 + 1; x += 1) for (let z = 0; z < size * 2 + 1; z += 1) walls.add(`${x - size},${z - size}`);
  const visited = new Set<string>();
  const stack = [{ x: 1, z: 19 }];
  visited.add('1,19');
  let seed = 127;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const x = current.x * 2 - 21;
    const z = current.z * 2 - 21;
    walls.delete(`${x},${z}`);
    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => ({ x: current.x + dx, z: current.z + dz, dx, dz })).filter((next) => next.x > 0 && next.x <= size && next.z > 0 && next.z <= size && !visited.has(`${next.x},${next.z}`));
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const next = neighbors[Math.floor(random() * neighbors.length)];
    walls.delete(`${x + next.dx},${z + next.dz}`);
    walls.delete(`${x + next.dx * 2},${z + next.dz * 2}`);
    visited.add(`${next.x},${next.z}`);
    stack.push({ x: next.x, z: next.z });
  }
  for (const x of MAZE_LANES) {
    for (let dx = -1; dx <= 1; dx += 1) for (let z = 18; z <= 21; z += 1) walls.delete(`${x + dx},${z}`);
  }
  for (let x = 17; x <= 19; x += 1) for (let z = -24; z <= -18; z += 1) walls.delete(`${x},${z}`);
  return walls;
}

export function generateMazeChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  const walls = mazeWalls();
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) {
    for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
      if (Math.abs(x) > 27 || Math.abs(z) > 27) continue;
      blocks.push({ x, y: 7, z, kind: BlockKind.Stone });
      const finish = Math.abs(x - 18) <= 1 && z <= -22 && z >= -24;
      const start = z >= 22 && z <= 24 && MAZE_LANES.includes(x as (typeof MAZE_LANES)[number]);
      blocks.push({ x, y: 8, z, kind: finish ? BlockKind.ConcreteYellow : start ? BlockKind.ConcreteWhite : walls.has(`${x},${z}`) ? BlockKind.ForestGrass : BlockKind.Dirt });
      if (walls.has(`${x},${z}`)) {
        for (let y = 9; y <= 11; y += 1) blocks.push({ x, y, z, kind: Math.abs(x) === 21 || Math.abs(z) === 21 ? BlockKind.Stone : BlockKind.PineLeaves });
      }
      if ((Math.abs(x) === 22 || z === 25 || z === -25) && Math.abs(z) <= 25) {
        for (let y = 9; y <= 12; y += 1) blocks.push({ x, y, z, kind: BlockKind.Stone });
      }
      for (const barrier of MAZE_BARRIERS) {
        if (barrier.x === x && barrier.y === 9 && barrier.z === z) blocks.push({ x, y: 9, z, kind: BlockKind.DoorBlack, facing: 'north', open: false });
        if (barrier.x === x && barrier.y === 10 && barrier.z === z) blocks.push({ x, y: 10, z, kind: BlockKind.DoorBlack, facing: 'north', open: false });
      }
      if (x >= -2 && x <= 2 && z >= 22 && z <= 26) {
        if (Math.abs(x) === 1 && (z === 22 || z === 26)) {
          for (let y = 9; y <= 15; y += 1) blocks.push({ x, y, z, kind: BlockKind.Wood });
        }
        blocks.push({ x, y: 16, z, kind: BlockKind.OakPlanks });
        if ((Math.abs(x) === 2 || z === 26) && !(x === 2 && z === 24)) blocks.push({ x, y: 17, z, kind: BlockKind.OakPlanks });
      }
    }
  }
  for (let y = 9; y <= 16; y += 1) blocks.push({ x: 2, y, z: 24, kind: BlockKind.Ladder, facing: 'west' });
  return { blocks, water: [] };
}
