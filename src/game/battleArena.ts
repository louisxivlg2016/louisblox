import { EXTRA_BLOCKS } from './extraBlocks';
import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

export type BattleTeam = 'red' | 'blue';
export const BATTLE_LIMIT = 22.5;

export function battleSpawn(team: BattleTeam | null) {
  return { x: team === 'red' ? -16 : team === 'blue' ? 16 : 0, y: 8.51, z: 0 };
}

export function generateBattleChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) {
    for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
      const ax = Math.abs(x);
      const az = Math.abs(z);
      if (ax > 24 || az > 24) continue;
      blocks.push({ x, y: 7, z, kind: BlockKind.Bedrock });
      blocks.push({ x, y: 8, z, kind: BlockKind.Grass });
      if (ax === 24 || az === 24) {
        for (let y = 9; y <= 11; y += 1) blocks.push({ x, y, z, kind: BlockKind.Bedrock });
        continue;
      }
      const cover = (ax === 5 && az <= 3) || (az === 7 && ax <= 2);
      if (cover) {
        blocks.push({ x, y: 9, z, kind: BlockKind.Stone });
        if ((x + z) % 2 === 0) blocks.push({ x, y: 10, z, kind: BlockKind.Stone });
      }
      if ((x === -18 || x === 18) && az <= 2) {
        blocks.push({ x, y: 9, z, kind: (x < 0 ? EXTRA_BLOCKS.ConcreteRed : EXTRA_BLOCKS.ConcreteBlue) as BlockKind });
      }
    }
  }
  return { blocks, water: [] };
}
