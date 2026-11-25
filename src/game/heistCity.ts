import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

export const HEIST_CITY_LIMIT = 60;
export const HEIST_HIDEOUT = { x: -42, y: 8.51, z: 42 };
export const HEIST_DEPOSIT = { x: -42, y: 8, z: 42 };
export const HEIST_PRISON_SPAWN = { x: 33, y: 8.51, z: 39 };
export const HEIST_TUNNEL_EXIT = { x: 24, y: 8.51, z: 47 };
export const HEIST_DELIVERY_START = { x: -42, y: 16.51, z: 42 };
export const HEIST_DELIVERY_POINTS = [
  { x: -35, y: 16, z: -25, name: 'Bijouterie' },
  { x: 0, y: 20, z: -30, name: 'Musée' },
  { x: 35, y: 22, z: -25, name: 'Grande Banque' },
  { x: -42, y: 16, z: 42, name: 'Repaire' },
] as const;

export type HeistLoot = { id: string; building: 'jewelry' | 'museum' | 'bank'; name: string; value: number; x: number; y: number; z: number };
export const HEIST_LOOT: HeistLoot[] = [
  { id: 'diamonds-1', building: 'jewelry', name: 'Sac de diamants 1', value: 500, x: -40, y: 8, z: -25 },
  { id: 'diamonds-2', building: 'jewelry', name: 'Sac de diamants 2', value: 500, x: -35, y: 8, z: -25 },
  { id: 'diamonds-3', building: 'jewelry', name: 'Sac de diamants 3', value: 500, x: -30, y: 8, z: -25 },
  { id: 'crown', building: 'museum', name: 'Couronne royale', value: 2000, x: 0, y: 8, z: -30 },
  { id: 'painting-1', building: 'museum', name: 'Tableau 1', value: 500, x: -10, y: 9, z: -30 },
  { id: 'painting-2', building: 'museum', name: 'Tableau 2', value: 500, x: 10, y: 9, z: -30 },
  { id: 'painting-3', building: 'museum', name: 'Tableau 3', value: 500, x: 0, y: 14, z: -30 },
  { id: 'gold-1', building: 'bank', name: 'Sac d’or 1', value: 1500, x: 30, y: 4, z: -25 },
  { id: 'gold-2', building: 'bank', name: 'Sac d’or 2', value: 1500, x: 35, y: 4, z: -25 },
  { id: 'gold-3', building: 'bank', name: 'Sac d’or 3', value: 1500, x: 40, y: 4, z: -25 },
  { id: 'gold-4', building: 'bank', name: 'Sac d’or 4', value: 1500, x: 35, y: 4, z: -32 },
];

function put(blocks: Voxel[], x: number, y: number, z: number, kind: BlockKind, protectedBlock = true, facing?: Voxel['facing']) {
  blocks.push({ x, y, z, kind, ...(protectedBlock ? { protected: true } : {}), ...(facing ? { facing } : {}) });
}

function building(blocks: Voxel[], centerX: number, centerZ: number, width: number, depth: number, height: number, wall: BlockKind, roof: BlockKind) {
  const x1 = centerX - Math.floor(width / 2);
  const x2 = centerX + Math.floor(width / 2);
  const z1 = centerZ - Math.floor(depth / 2);
  const z2 = centerZ + Math.floor(depth / 2);
  for (let x = x1; x <= x2; x += 1) for (let z = z1; z <= z2; z += 1) {
    put(blocks, x, 7, z, BlockKind.OakPlanks);
    put(blocks, x, 7 + height + 1, z, roof);
    const edge = x === x1 || x === x2 || z === z1 || z === z2;
    if (!edge) continue;
    for (let y = 8; y <= 7 + height; y += 1) {
      const door = z === z2 && Math.abs(x - centerX) <= 1 && y <= 10;
      const window = y >= 10 && y <= 11 && (x + z) % 4 === 0;
      if (!door) put(blocks, x, y, z, window ? BlockKind.Glass : wall);
    }
  }
  for (let x = x1; x <= x2; x += 1) for (const z of [z1, z2]) for (let y = 8; y <= 7 + height; y += 1) {
    if (Math.abs(x - centerX) <= 1 && z === z2 && y <= 10) put(blocks, x, y, z, BlockKind.DoorBlack, true, 'north');
  }
  put(blocks, centerX, 8 + height, z1 + 1, BlockKind.Ladder, true, 'south');
}

export function generateHeistChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) {
    for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
      if (Math.abs(x) > HEIST_CITY_LIMIT || Math.abs(z) > HEIST_CITY_LIMIT) continue;
      const road = Math.abs(x % 24) <= 4 || Math.abs(z % 24) <= 4;
      put(blocks, x, 7, z, road ? BlockKind.ConcreteGray : BlockKind.ConcreteLightGray);
      if (Math.abs(x) === HEIST_CITY_LIMIT || Math.abs(z) === HEIST_CITY_LIMIT) for (let y = 8; y <= 27; y += 1) put(blocks, x, y, z, BlockKind.Bedrock);
      if (road && (x % 24 === 0 || z % 24 === 0)) put(blocks, x, 8, z, BlockKind.WhiteBrick);
    }
  }
  building(blocks, -42, 42, 16, 16, 8, BlockKind.Wood, BlockKind.OakPlanks);
  building(blocks, -35, -25, 20, 16, 8, BlockKind.BeigeBrick, BlockKind.Glass);
  building(blocks, 0, -30, 28, 24, 12, BlockKind.WhiteBrick, BlockKind.ConcreteGray);
  building(blocks, 35, -25, 34, 30, 14, BlockKind.GrayBrick, BlockKind.ConcreteBlack);
  building(blocks, 38, 38, 24, 20, 5, BlockKind.Bedrock, BlockKind.Bedrock);
  put(blocks, -42, 8, 42, BlockKind.Chest);
  put(blocks, -42, 16, 42, BlockKind.Ladder, true, 'south');
  for (let y = 8; y <= 16; y += 1) put(blocks, -42, y, 42, BlockKind.Ladder, true, 'south');

  for (const loot of HEIST_LOOT) put(blocks, loot.x, loot.y, loot.z, BlockKind.Chest);
  for (let x = 25; x <= 45; x += 1) for (let z = -35; z <= -15; z += 1) for (let y = 2; y <= 6; y += 1) {
    const edge = x === 25 || x === 45 || z === -35 || z === -15 || y === 2 || y === 6;
    if (edge) put(blocks, x, y, z, BlockKind.Bedrock);
  }
  for (const [x, y, z] of [[29, 4, -25], [41, 4, -25], [35, 4, -20]] as const) put(blocks, x, y, z, BlockKind.Tnt);
  for (const z of [-35, -33, -31, -29]) for (let x = -10; x <= 10; x += 1) put(blocks, x, 9, z, BlockKind.RedBrick);

  for (const [cellX, cellZ] of [[31, 36], [37, 36], [43, 36], [31, 43], [37, 43], [43, 43]] as const) {
    for (let x = cellX - 2; x <= cellX + 2; x += 1) for (let z = cellZ - 2; z <= cellZ + 2; z += 1) {
      if (x !== cellX - 2 && x !== cellX + 2 && z !== cellZ - 2 && z !== cellZ + 2) continue;
      for (let y = 8; y <= 11; y += 1) put(blocks, x, y, z, x === cellX - 2 && z === cellZ ? BlockKind.TrapdoorIron : BlockKind.Bedrock);
    }
    put(blocks, cellX, 8, cellZ, BlockKind.Bed);
    put(blocks, cellX, 6, cellZ, BlockKind.Dirt, false);
  }
  for (let x = 24; x <= 42; x += 1) for (let z = 40; z <= 52; z += 1) {
    put(blocks, x, 0, z, BlockKind.Bedrock);
    for (let y = 1; y <= 3; y += 1) {
      const pillar = x % 7 === 0 && z % 5 === 0;
      const gravel = (x * 13 + z * 7) % 10 < 2;
      put(blocks, x, y, z, pillar ? BlockKind.Bedrock : gravel ? BlockKind.Sand : BlockKind.Dirt, pillar ? true : false);
    }
  }
  put(blocks, 36, 2, 46, BlockKind.Chest, false);
  const hidden = blocks.find((block) => block.x === 36 && block.y === 2 && block.z === 46);
  if (hidden) hidden.items = ['pickaxe_stone'];
  for (let y = 1; y <= 3; y += 1) put(blocks, 24, y, 47, BlockKind.GrayBrick, false);
  for (let y = 1; y <= 8; y += 1) put(blocks, 24, y, 47, BlockKind.Ladder, true, 'east');
  for (let x = -50; x <= 50; x += 1) for (const z of [-8, 8]) {
    put(blocks, x, 0, z, BlockKind.Bedrock);
    if (x % 3 !== 0) put(blocks, x, 1, z, BlockKind.CalmWater, false);
  }
  return { blocks, water: [] };
}
