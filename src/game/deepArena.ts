import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

export const DEEP_SPAWN = { x: 0, y: 19.51, z: 0 };
export const DEEP_SURFACE_Y = 18.5;
export const DEEP_VENDOR = { x: 2, y: 18.5, z: 0 };
export const DEEP_CHESTS = [
  { id: 'shallow', name: 'Coffre peu profond', x: 8, y: 15, z: 8, value: 50, gear: 0 },
  { id: 'reef', name: 'Coffre du récif', x: 16, y: 9, z: 16, value: 100, gear: 1 },
  { id: 'deep', name: 'Coffre des profondeurs', x: -20, y: 1, z: -16, value: 200, gear: 2 },
  { id: 'trench', name: 'Coffre de la fosse', x: 24, y: -3, z: -24, value: 400, gear: 3 },
] as const;

function put(blocks: Voxel[], cx: number, cz: number, x: number, y: number, z: number, kind: BlockKind, protectedBlock = false, facing?: Voxel['facing']) {
  if (Math.floor(x / CHUNK_SIZE) !== cx || Math.floor(z / CHUNK_SIZE) !== cz) return undefined;
  const block: Voxel = { x, y, z, kind, ...(protectedBlock ? { protected: true } : {}), ...(facing ? { facing } : {}) };
  blocks.push(block);
  return block;
}

function cave(blocks: Voxel[], cx: number, cz: number, chest: (typeof DEEP_CHESTS)[number]) {
  for (let dx = -4; dx <= 4; dx += 1) for (let dz = -4; dz <= 4; dz += 1) {
    if (Math.abs(dx) === 4 || Math.abs(dz) === 4) for (let y = chest.y; y <= chest.y + 3; y += 1) {
      if (dz === 4 && Math.abs(dx) <= 1 && y <= chest.y + 2) continue;
      put(blocks, cx, cz, chest.x + dx, y, chest.z + dz, BlockKind.Stone, true);
    }
    if (Math.abs(dx) <= 4 && Math.abs(dz) <= 4) put(blocks, cx, cz, chest.x + dx, chest.y + 4, chest.z + dz, BlockKind.Stone, true);
  }
}

export function generateDeepChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
    if (x < -40 || x >= 40 || z < -40 || z >= 40) continue;
    const radius = Math.hypot(x, z);
    const floor = radius < 12 ? 14 : radius < 24 ? 8 : radius < 30 ? 0 : -4;
    put(blocks, cx, cz, x, floor, z, radius < 24 ? BlockKind.Sand : BlockKind.Stone, true);
    for (let y = floor + 1; y <= 18; y += 1) put(blocks, cx, cz, x, y, z, BlockKind.CalmWater);
  }
  for (let x = -2; x <= 2; x += 1) for (let z = -2; z <= 2; z += 1) put(blocks, cx, cz, x, 18, z, BlockKind.OakPlanks, true);
  put(blocks, cx, cz, DEEP_VENDOR.x, 18, DEEP_VENDOR.z, BlockKind.Chest, true);
  const vendorSign = put(blocks, cx, cz, DEEP_VENDOR.x, 19, DEEP_VENDOR.z, BlockKind.Sign, true, 'south');
  if (vendorSign) vendorSign.text = 'VENTE & OXYGÈNE';
  for (const chest of DEEP_CHESTS) cave(blocks, cx, cz, chest);
  for (const chest of DEEP_CHESTS) put(blocks, cx, cz, chest.x, chest.y, chest.z, BlockKind.Chest);
  return { blocks, water: [] };
}
