import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

export const FOOTBALL_LIMIT_X = 26.5;
export const FOOTBALL_LIMIT_Z = 14.5;

export function footballSpawn(team: 'red' | 'blue' | null) {
  return { x: team === 'blue' ? 10 : -10, y: 8.51, z: 0 };
}

function line(blocks: Voxel[], x: number, z: number) {
  blocks.push({ x, y: 8, z, kind: BlockKind.ConcreteWhite });
}

export function generateFootballChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) {
    for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
      if (Math.abs(x) > 35 || Math.abs(z) > 25) continue;
      blocks.push({ x, y: 7, z, kind: BlockKind.Stone });
      if (Math.abs(x) <= 27 && Math.abs(z) <= 15) {
        const centerCircle = Math.abs(Math.hypot(x, z) - 5) < 0.55;
        const penalty = Math.abs(x) === 19 && Math.abs(z) <= 8 || Math.abs(z) === 8 && Math.abs(x) >= 19 && Math.abs(x) <= 27;
        const goalArea = Math.abs(x) === 23 && Math.abs(z) <= 4 || Math.abs(z) === 4 && Math.abs(x) >= 23 && Math.abs(x) <= 27;
        const marking = x === 0 || Math.abs(z) === 15 || Math.abs(x) === 27 || centerCircle || penalty || goalArea;
        if (marking) line(blocks, x, z);
        else blocks.push({ x, y: 8, z, kind: (Math.floor((x + 27) / 5) % 2 === 0) ? BlockKind.ForestGrass : BlockKind.Grass });
      } else if (Math.abs(z) <= 18 && Math.abs(x) <= 29) {
        blocks.push({ x, y: 8, z, kind: BlockKind.Stone });
      }
      if ((Math.abs(z) === 16 && Math.abs(x) <= 28) || (Math.abs(x) === 28 && Math.abs(z) <= 16 && (Math.abs(z) > 4))) {
        for (let y = 9; y <= 11; y += 1) blocks.push({ x, y, z, kind: BlockKind.ConcreteLightGray });
      }
      if (Math.abs(x) === 27 && Math.abs(z) === 4) {
        for (let y = 9; y <= 12; y += 1) blocks.push({ x, y, z, kind: BlockKind.ConcreteWhite });
      }
      if (Math.abs(x) === 27 && Math.abs(z) <= 4) blocks.push({ x, y: 12, z, kind: BlockKind.ConcreteWhite });
      if (Math.abs(x) >= 30 && Math.abs(z) <= 22) {
        const height = Math.min(5, Math.floor((Math.abs(x) - 29) / 2) + 1);
        for (let y = 8; y < 8 + height; y += 1) blocks.push({ x, y, z, kind: BlockKind.Stone });
        blocks.push({ x, y: 8 + height, z, kind: Math.abs(x + z) % 3 === 0 ? BlockKind.ConcreteRed : BlockKind.ConcreteBlue });
      }
      if (Math.abs(z) >= 20 && Math.abs(z) <= 24 && Math.abs(x) <= 29) {
        const height = Math.abs(z) - 18;
        for (let y = 8; y < 8 + height; y += 1) blocks.push({ x, y, z, kind: BlockKind.Stone });
        blocks.push({ x, y: 8 + height, z, kind: BlockKind.ConcreteLightGray });
      }
    }
  }
  return { blocks, water: [] };
}
