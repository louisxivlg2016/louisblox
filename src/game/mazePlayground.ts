import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';
import { useMazeCourseStore } from './mazeCourses';

export const MAZE_PLAYGROUND_CENTER = { x: 128, z: 128 };
export const MAZE_PLAYGROUND_BOUNDS = { minX: 93.5, maxX: 162.5, minZ: 93.5, maxZ: 162.5 };

export function mazePlaygroundSpawn(index = 0) {
  return { x: 124 + Math.abs(index) % 5 * 2, y: 8.51, z: 156 + Math.floor(Math.abs(index) / 5) * 2, yaw: 0 };
}

export function isMazePlaygroundChunk(cx: number, cz: number) {
  return Math.abs(cx * CHUNK_SIZE + CHUNK_SIZE / 2 - MAZE_PLAYGROUND_CENTER.x) <= 40 && Math.abs(cz * CHUNK_SIZE + CHUNK_SIZE / 2 - MAZE_PLAYGROUND_CENTER.z) <= 40;
}

function generateMazeVariant(cx: number, cz: number, course: number): GeneratedChunk {
  const blocks = new Map<string, Voxel>();
  const put = (x: number, y: number, z: number, kind: BlockKind, extra: Partial<Voxel> = {}) => blocks.set(voxelKey(x, y, z), { x, y, z, kind, ...extra });
  const colors = [BlockKind.ConcreteOrange, BlockKind.ConcreteYellow, BlockKind.ConcreteLime, BlockKind.ConcreteCyan, BlockKind.ConcretePurple, BlockKind.ConcretePink];
  const pathColor = colors[course % colors.length];
  const lanes = new Map<number, number>();
  let lane = 128;
  for (let z = 158; z >= 92; z -= 1) {
    const target = Math.max(121, Math.min(135, Math.round(128 + Math.sin(z * 0.29 + course * 1.7) * (2 + course % 4) + Math.sin(z * 0.11 + course * 2.3) * 2)));
    lane += Math.max(-1, Math.min(1, target - lane));
    lanes.set(z, lane);
  }
  const firstLava = 145 + course % 3;
  const secondLava = 122 - course % 4;
  const bands = [[firstLava, firstLava + 4], [secondLava, secondLava + 5], ...(course % 4 === 0 ? [[134, 137]] : [])];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
    if (Math.abs(x - MAZE_PLAYGROUND_CENTER.x) > 36 || Math.abs(z - MAZE_PLAYGROUND_CENTER.z) > 36) continue;
    put(x, 7, z, BlockKind.Stone);
    put(x, 8, z, BlockKind.ForestGrass);
    if (Math.abs(x - MAZE_PLAYGROUND_CENTER.x) === 35 || Math.abs(z - MAZE_PLAYGROUND_CENTER.z) === 35) for (let y = 9; y <= 11; y += 1) put(x, y, z, BlockKind.Stone);
    if (x >= 120 && x <= 136 && z >= 153) put(x, 8, z, z % 2 === 0 ? BlockKind.ConcreteWhite : BlockKind.ConcreteLightBlue);
    if (bands.some(([start, end]) => z >= start && z <= end) && x >= 119 && x <= 137) put(x, 8, z, BlockKind.Wildfire);
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
      if (Math.abs(x - gap) <= 1 || Math.abs(x - gap - 1) <= 1) continue;
      for (let y = 9; y <= 11; y += 1) put(x, y, z, colors[(course + 2) % colors.length]);
    }
  }
  for (let z = 102; z <= 116; z += 2) {
    const x = lanes.get(z)!;
    put(x, 9 + (z % 4 === 0 ? 1 : 0), z, colors[(course + z) % colors.length]);
    put(x + 1, 9 + (z % 4 === 0 ? 1 : 0), z, colors[(course + z) % colors.length]);
  }
  for (const side of [-1, 1]) for (let z = 105; z <= 140; z += 7) {
    const x = 128 + side * (8 + course % 3);
    for (let y = 9; y <= 10 + course % 3; y += 1) put(x, y, z, colors[(course + 3) % colors.length]);
  }
  put(122, 9, 158, BlockKind.Sign, { text: `Parcours ${course + 1}/100 · trouve le gâteau !`, facing: 'north' });
  put(128, 9, 94, BlockKind.Food, { food: 'cake' });
  put(130, 9, 94, BlockKind.Sign, { text: `Arrivée du parcours ${course + 1}`, facing: 'south' });
  return { blocks: [...blocks.values()], water: [] };
}

export function generateMazePlaygroundChunk(cx: number, cz: number): GeneratedChunk {
  const course = useMazeCourseStore.getState().index;
  if (course > 0) return generateMazeVariant(cx, cz, course);
  const blocks = new Map<string, Voxel>();
  const put = (x: number, y: number, z: number, kind: BlockKind, extra: Partial<Voxel> = {}) => blocks.set(voxelKey(x, y, z), { x, y, z, kind, ...extra });
  const platform = (x: number, y: number, z: number, kind: BlockKind, width = 1) => {
    for (let dx = 0; dx < width; dx += 1) put(x + dx, y, z, kind);
  };

  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) {
    for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
      if (Math.abs(x - MAZE_PLAYGROUND_CENTER.x) > 36 || Math.abs(z - MAZE_PLAYGROUND_CENTER.z) > 36) continue;
      put(x, 7, z, BlockKind.Stone);
      put(x, 8, z, BlockKind.ForestGrass);
      if (Math.abs(x - MAZE_PLAYGROUND_CENTER.x) === 35 || Math.abs(z - MAZE_PLAYGROUND_CENTER.z) === 35) {
        for (let y = 9; y <= 11; y += 1) put(x, y, z, BlockKind.Stone);
      }
      if (x >= 120 && x <= 136 && z >= 153) put(x, 8, z, z % 2 === 0 ? BlockKind.ConcreteWhite : BlockKind.ConcreteLightBlue);
      if (x >= 120 && x <= 136 && z >= 145 && z <= 152) put(x, 8, z, BlockKind.Wildfire);
      if (x >= 120 && x <= 136 && z >= 123 && z <= 133) put(x, 8, z, BlockKind.Wildfire);
      if (x >= 124 && x <= 132 && z >= 134 && z <= 144) {
        const colors = [BlockKind.ConcreteOrange, BlockKind.ConcreteYellow, BlockKind.ConcreteLime, BlockKind.ConcreteCyan, BlockKind.ConcretePurple, BlockKind.ConcretePink];
        put(x, 8, z, colors[Math.abs(x + z) % colors.length]);
      }
      if (x >= 120 && x <= 136 && z <= 99) put(x, 8, z, BlockKind.ConcreteYellow);
    }
  }

  for (const [index, z] of [151, 149, 147, 145].entries()) platform(index % 2 === 0 ? 128 : 126, 9, z, BlockKind.ConcreteYellow, 2);
  for (const [index, z] of [142, 139, 136].entries()) platform(124, 9, z, index % 2 === 0 ? BlockKind.Wood : BlockKind.ConcreteOrange, 9);

  const zigzag = [[126, 9, 132], [128, 9, 130], [126, 10, 128], [130, 9, 126], [128, 9, 124]] as const;
  for (const [x, y, z] of zigzag) platform(x, y, z, BlockKind.ConcretePink, 2);

  for (let x = 124; x <= 132; x += 1) put(x, 11, 120, BlockKind.ConcreteMagenta);
  for (const x of [123, 133]) for (let y = 9; y <= 10; y += 1) put(x, y, 120, BlockKind.ConcretePurple);

  for (let index = 0; index < 5; index += 1) platform(126, 9 + index, 118 - index * 2, index % 2 === 0 ? BlockKind.ConcreteCyan : BlockKind.ConcreteLightBlue, 5);
  platform(126, 13, 110, BlockKind.OakPlanks, 5);
  for (let z = 104; z <= 109; z += 1) platform(126, 13, z, z % 2 === 0 ? BlockKind.ConcreteYellow : BlockKind.ConcreteOrange, 5);
  for (let index = 0; index < 4; index += 1) platform(126, 12 - index, 102 - index * 2, BlockKind.ConcreteLime, 5);
  for (let y = 9; y <= 14; y += 1) put(136, y, 108, BlockKind.Ladder, { facing: 'west' });
  platform(134, 14, 106, BlockKind.ConcretePurple, 3);

  for (const z of [143, 121]) {
    for (const x of [119, 137]) for (let y = 9; y <= 12; y += 1) put(x, y, z, BlockKind.ConcreteLightBlue);
    for (let x = 119; x <= 137; x += 1) put(x, 13, z, z === 143 ? BlockKind.ConcreteYellow : BlockKind.ConcretePink);
  }

  put(122, 9, 158, BlockKind.Sign, { text: 'Après-course · Saute et amuse-toi !', facing: 'north' });
  put(121, 9, 144, BlockKind.Sign, { text: 'Haies et lave · saute !', facing: 'north' });
  put(134, 9, 122, BlockKind.Sign, { text: 'Zigzag sur les plateformes', facing: 'north' });
  put(128, 9, 94, BlockKind.Food, { food: 'cake' });
  put(130, 9, 94, BlockKind.Sign, { text: 'Arrivée · gâteau des champions', facing: 'south' });

  return { blocks: [...blocks.values()], water: [] };
}
