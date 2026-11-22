import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';
import { useMazeCourseStore } from './mazeCourses';

export const MAZE_PLAYGROUND_CENTER = { x: 128, z: 128 };
export const MAZE_PLAYGROUND_BOUNDS = { minX: 93.5, maxX: 162.5, minZ: 93.5, maxZ: 162.5 };

export function mazePlaygroundSpawn(index = 0) {
  return { x: 122 + Math.abs(index) % 8 * 2, y: 8.51, z: 154 + Math.floor(Math.abs(index) / 8) % 3 * 2, yaw: 0 };
}

export function isMazePlaygroundChunk(cx: number, cz: number) {
  return Math.abs(cx * CHUNK_SIZE + CHUNK_SIZE / 2 - MAZE_PLAYGROUND_CENTER.x) <= 40 && Math.abs(cz * CHUNK_SIZE + CHUNK_SIZE / 2 - MAZE_PLAYGROUND_CENTER.z) <= 40;
}

function courseLanes(course: number) {
  const lanes = new Map<number, number>();
  let lane = 124;
  for (let z = 158; z >= 94; z -= 1) {
    const target = z <= 100 ? 128 : Math.max(121, Math.min(135, Math.round(128 + Math.sin(z * 0.29 + course * 1.7) * (2 + course % 4) + Math.sin(z * 0.11 + course * 2.3) * 2)));
    lane += Math.max(-1, Math.min(1, target - lane));
    lanes.set(z, lane);
  }
  return lanes;
}

function generateMazeVariant(cx: number, cz: number, course: number): GeneratedChunk {
  const blocks = new Map<string, Voxel>();
  const put = (x: number, y: number, z: number, kind: BlockKind, extra: Partial<Voxel> = {}) => blocks.set(voxelKey(x, y, z), { x, y, z, kind, ...extra });
  const colors = [BlockKind.ConcreteOrange, BlockKind.ConcreteYellow, BlockKind.ConcreteLime, BlockKind.ConcreteCyan, BlockKind.ConcretePurple, BlockKind.ConcretePink];
  const pathColor = colors[course % colors.length];
  const lanes = courseLanes(course);
  const firstLava = 145 + course % 3;
  const secondLava = 122 - course % 4;
  const bands = [[firstLava, firstLava + 4], [secondLava, secondLava + 5], ...(course % 4 === 0 ? [[134, 137]] : [])];
  const inLava = (z: number) => bands.some(([start, end]) => z >= start && z <= end);

  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
    if (Math.abs(x - MAZE_PLAYGROUND_CENTER.x) > 36 || Math.abs(z - MAZE_PLAYGROUND_CENTER.z) > 36) continue;
    put(x, 7, z, BlockKind.Stone);
    put(x, 8, z, BlockKind.ForestGrass);
    if (Math.abs(x - MAZE_PLAYGROUND_CENTER.x) === 35 || Math.abs(z - MAZE_PLAYGROUND_CENTER.z) === 35) for (let y = 9; y <= 11; y += 1) put(x, y, z, BlockKind.Stone);
    if (inLava(z) && x >= 119 && x <= 137) put(x, 8, z, BlockKind.Wildfire);
    if (x >= 120 && x <= 136 && z <= 99) put(x, 8, z, pathColor);
  }

  for (const [start, end] of bands) for (let z = start - 1; z <= end + 1; z += 1) {
    const x = lanes.get(z)!;
    put(x, 9, z, pathColor);
    put(x + 1, 9, z, course % 2 === 0 ? pathColor : BlockKind.OakPlanks);
  }

  for (const z of [143 - course % 5, 120 + course % 3]) {
    const gap = lanes.get(z)!;
    for (let x = 119; x <= 137; x += 1) {
      if (Math.abs(x - gap) <= 2) continue;
      for (let y = 9; y <= 11; y += 1) put(x, y, z, colors[(course + 2) % colors.length]);
    }
  }

  for (let z = 102; z <= 116; z += 2) {
    const x = lanes.get(z)!;
    put(x, 9, z, colors[(course + z) % colors.length]);
    put(x + 1, 9, z, colors[(course + z) % colors.length]);
  }

  for (const side of [-1, 1]) for (let z = 105; z <= 140; z += 7) {
    const x = 128 + side * (8 + course % 3);
    if (Math.abs(x - lanes.get(z)!) <= 2) continue;
    for (let y = 9; y <= 10 + course % 3; y += 1) put(x, y, z, colors[(course + 3) % colors.length]);
  }

  for (let z = 158; z >= 100; z -= 1) {
    if (inLava(z)) continue;
    const x = lanes.get(z)!;
    if (!blocks.has(voxelKey(x, 9, z))) put(x, 8, z, z % 5 === 0 ? BlockKind.ConcreteWhite : pathColor);
    if (!blocks.has(voxelKey(x + 1, 9, z))) put(x + 1, 8, z, pathColor);
  }

  put(120, 9, 158, BlockKind.Sign, { text: `Parcours ${course + 1}/100 · Suis le chemin coloré jusqu'au gâteau !`, facing: 'north' });
  put(128, 9, 94, BlockKind.Food, { food: 'cake' });
  put(130, 9, 94, BlockKind.Sign, { text: `Sortie du parcours ${course + 1}`, facing: 'south' });
  return { blocks: [...blocks.values()], water: [] };
}

export function generateMazePlaygroundChunk(cx: number, cz: number): GeneratedChunk {
  return generateMazeVariant(cx, cz, useMazeCourseStore.getState().index);
}
