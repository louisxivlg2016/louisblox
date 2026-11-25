import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

export const SKYFALL_SPAWN = { x: 0, y: 8.51, z: 0 };

export function generateSkyfallChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
    if (Math.abs(x) > 22 || Math.abs(z) > 22) continue;
    if (Math.abs(x) <= 20 && Math.abs(z) <= 20) blocks.push({ x, y: 7, z, kind: (x + z) % 2 === 0 ? BlockKind.ConcreteLightBlue : BlockKind.ConcreteWhite });
    if (Math.abs(x) === 22 || Math.abs(z) === 22) for (let y = 8; y <= 12; y += 1) blocks.push({ x, y, z, kind: BlockKind.Bedrock, protected: true });
  }
  return { blocks, water: [] };
}
