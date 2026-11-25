import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

export const ZOMBIE_PLANET_SPAWN = { x: 0, y: 9.51, z: 10 };
export const ZOMBIE_POSITIONS = [
  { x: -8, y: 8.51, z: -4 },
  { x: 8, y: 8.51, z: -4 },
  { x: -6, y: 8.51, z: -12 },
  { x: 6, y: 8.51, z: -12 },
  { x: -12, y: 8.51, z: 2 },
  { x: 12, y: 8.51, z: 2 },
] as const;
export const GIRL_POSITION = { x: 0, y: 8.51, z: -5 };
export const SURVIVOR_POSITIONS = [
  { id: 'worker', outfit: 'worker' as const, x: -12, y: 8.51, z: 8 },
  { id: 'police', outfit: 'police' as const, x: 12, y: 8.51, z: 8 },
  { id: 'king', outfit: 'king' as const, x: 0, y: 8.51, z: -14 },
] as const;

function put(blocks: Voxel[], cx: number, cz: number, x: number, y: number, z: number, kind: BlockKind, protectedBlock = false, facing?: Voxel['facing']) {
  if (Math.floor(x / CHUNK_SIZE) !== cx || Math.floor(z / CHUNK_SIZE) !== cz) return undefined;
  const voxel: Voxel = { x, y, z, kind, ...(protectedBlock ? { protected: true } : {}), ...(facing ? { facing } : {}) };
  blocks.push(voxel);
  return voxel;
}

export function generateZombiePlanetChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  const radius = 20;
  for (let dx = -radius; dx <= radius; dx += 1) for (let dz = -radius; dz <= radius; dz += 1) for (let dy = -radius; dy <= 0; dy += 1) {
    const distance = dx * dx + dz * dz + dy * dy;
    if (distance > radius * radius) continue;
    const x = dx, y = 7 + dy, z = dz;
    put(blocks, cx, cz, x, y, z, dy === 0 ? BlockKind.Snow : BlockKind.Ice, dy < -2);
  }
  for (let x = -2; x <= 2; x += 1) for (let z = -7; z <= -3; z += 1) for (let y = 8; y <= 11; y += 1) {
    if (x !== -2 && x !== 2 && z !== -7 && z !== -3) continue;
    put(blocks, cx, cz, x, y, z, BlockKind.TrapdoorIron, true);
  }
  for (let x = -2; x <= 2; x += 1) for (let z = -7; z <= -3; z += 1) put(blocks, cx, cz, x, 12, z, BlockKind.TrapdoorIron, true);
  for (const [x, z] of [[-12, 8], [12, 8], [0, -14]] as const) {
    for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
      put(blocks, cx, cz, x + dx, 7, z + dz, BlockKind.OakPlanks);
      if ((dx === -2 || dx === 2 || dz === -2 || dz === 2) && !(dz === 2 && dx === 0)) for (let y = 8; y <= 10; y += 1) put(blocks, cx, cz, x + dx, y, z + dz, BlockKind.WhiteBrick);
    }
    put(blocks, cx, cz, x, 11, z, BlockKind.ConcreteRed);
    const sign = put(blocks, cx, cz, x, 9, z + 3, BlockKind.Sign, true, 'south');
    if (sign) sign.text = 'AIDEZ-MOI !';
  }
  return { blocks, water: [] };
}
