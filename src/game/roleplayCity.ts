import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

export const ROLEPLAY_SPAWN = { x: 0, y: 8.51, z: 0 };
export const ROLEPLAY_HOMES = [
  { x: -20, y: 8.51, z: 20 },
  { x: 20, y: 8.51, z: 20 },
  { x: -20, y: 8.51, z: -2 },
  { x: 20, y: 8.51, z: -2 },
] as const;
export const ROLEPLAY_MARKET = { x: 0, y: 8.51, z: -20 };
export const ROLEPLAY_POLICE = { x: -20, y: 8.51, z: -20 };
export const ROLEPLAY_MINE = { x: 32, y: 8.51, z: -32 };

function put(blocks: Voxel[], cx: number, cz: number, x: number, y: number, z: number, kind: BlockKind, protectedBlock = true) {
  if (Math.floor(x / CHUNK_SIZE) !== cx || Math.floor(z / CHUNK_SIZE) !== cz) return;
  blocks.push({ x, y, z, kind, ...(protectedBlock ? { protected: true } : {}) });
}

function house(blocks: Voxel[], cx: number, cz: number, centerX: number, centerZ: number, color: BlockKind) {
  for (let x = centerX - 6; x <= centerX + 6; x += 1) for (let z = centerZ - 6; z <= centerZ + 6; z += 1) {
    put(blocks, cx, cz, x, 7, z, BlockKind.OakPlanks, false);
    put(blocks, cx, cz, x, 13, z, color, false);
    const edge = x === centerX - 6 || x === centerX + 6 || z === centerZ - 6 || z === centerZ + 6;
    if (!edge) continue;
    for (let y = 8; y <= 12; y += 1) {
      const door = z === centerZ - 6 && Math.abs(x - centerX) <= 1 && y <= 10;
      if (!door) put(blocks, cx, cz, x, y, z, y === 10 && (x + z) % 3 === 0 ? BlockKind.Glass : color, false);
    }
  }
  put(blocks, cx, cz, centerX + 4, 8, centerZ + 4, BlockKind.Chest, false);
  put(blocks, cx, cz, centerX - 4, 8, centerZ + 4, BlockKind.Bed, false);
}

export function generateRoleplayChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
    if (x < -48 || x >= 48 || z < -48 || z >= 48) continue;
    const road = Math.abs(x) <= 4 || Math.abs(z + 20) <= 4 || Math.abs(x - 32) <= 3;
    put(blocks, cx, cz, x, 7, z, road ? BlockKind.ConcreteGray : BlockKind.Grass);
    if (x === -48 || x === 47 || z === -48 || z === 47) for (let y = 8; y <= 12; y += 1) put(blocks, cx, cz, x, y, z, BlockKind.Bedrock);
  }
  const colors = [BlockKind.BeigeBrick, BlockKind.ConcreteLightBlue, BlockKind.ConcretePink, BlockKind.ConcreteLime] as const;
  ROLEPLAY_HOMES.forEach((home, index) => house(blocks, cx, cz, home.x, home.z, colors[index]));
  for (let x = -4; x <= 4; x += 1) for (let z = -24; z <= -16; z += 1) {
    put(blocks, cx, cz, x, 12, z, BlockKind.ConcreteRed);
    if (x === -4 || x === 4 || z === -24) for (let y = 8; y <= 11; y += 1) put(blocks, cx, cz, x, y, z, BlockKind.WhiteBrick);
  }
  put(blocks, cx, cz, ROLEPLAY_MARKET.x, 8, ROLEPLAY_MARKET.z, BlockKind.Chest);
  for (let x = -26; x <= -14; x += 1) for (let z = -26; z <= -14; z += 1) {
    put(blocks, cx, cz, x, 14, z, BlockKind.ConcreteBlue);
    if (x === -26 || x === -14 || z === -26 || z === -14) for (let y = 8; y <= 13; y += 1) put(blocks, cx, cz, x, y, z, BlockKind.ConcreteLightBlue);
  }
  put(blocks, cx, cz, ROLEPLAY_POLICE.x, 8, ROLEPLAY_POLICE.z, BlockKind.Chest);
  for (let x = 26; x <= 42; x += 1) for (let z = -42; z <= -24; z += 1) {
    put(blocks, cx, cz, x, 6, z, BlockKind.Stone, false);
    if ((x * 7 + z * 11) % 9 === 0) put(blocks, cx, cz, x, 7, z, (x + z) % 3 === 0 ? BlockKind.IronOre : BlockKind.CoalOre, false);
  }
  return { blocks, water: [] };
}
