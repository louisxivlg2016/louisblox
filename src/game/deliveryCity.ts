import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

export const DELIVERY_START = { x: 0, y: 8.51, z: 5 };
export const DELIVERY_POST = { x: 0, y: 8, z: 3 };
export const DELIVERY_POINTS = [
  { x: -36, y: 15, z: -36, name: 'Boulangerie', englishName: 'Bakery' },
  { x: 36, y: 17, z: -12, name: 'Villa bleue', englishName: 'Blue Villa' },
  { x: 36, y: 14, z: 36, name: 'Maison rose', englishName: 'Pink House' },
  { x: 0, y: 8, z: 3, name: 'Poste centrale', englishName: 'Central Post Office' },
] as const;

function put(blocks: Voxel[], cx: number, cz: number, x: number, y: number, z: number, kind: BlockKind, protectedBlock = true, facing?: Voxel['facing']) {
  if (Math.floor(x / CHUNK_SIZE) !== cx || Math.floor(z / CHUNK_SIZE) !== cz) return;
  const block: Voxel = { x, y, z, kind, ...(protectedBlock ? { protected: true } : {}), ...(facing ? { facing } : {}) };
  blocks.push(block);
  return block;
}

function roadDistance(value: number) {
  const modulo = ((value % 24) + 24) % 24;
  return Math.min(modulo, 24 - modulo);
}

function house(blocks: Voxel[], cx: number, cz: number, x: number, z: number, height: number, wall: BlockKind, roof: BlockKind, name?: string) {
  const roofY = 7 + height + 1;
  for (let dx = -5; dx <= 5; dx += 1) for (let dz = -5; dz <= 5; dz += 1) {
    put(blocks, cx, cz, x + dx, 7, z + dz, BlockKind.OakPlanks);
    put(blocks, cx, cz, x + dx, roofY, z + dz, roof);
    const edge = dx === -5 || dx === 5 || dz === -5 || dz === 5;
    if (!edge) continue;
    for (let y = 8; y < roofY; y += 1) {
      const door = dz === 5 && Math.abs(dx) <= 1 && y <= 10;
      const window = y >= 10 && y <= 11 && (dx + dz) % 4 === 0;
      if (!door) put(blocks, cx, cz, x + dx, y, z + dz, window ? BlockKind.Glass : wall);
    }
  }
  for (let dx = -1; dx <= 1; dx += 1) for (let y = 8; y <= 10; y += 1) put(blocks, cx, cz, x + dx, y, z + 5, BlockKind.DoorBrown, true, 'north');
  for (let y = 8; y <= roofY; y += 1) put(blocks, cx, cz, x + 5, y, z, BlockKind.Ladder, true, 'west');
  put(blocks, cx, cz, x + 2, roofY + 1, z - 2, BlockKind.GrayBrick);
  put(blocks, cx, cz, x + 2, roofY + 2, z - 2, BlockKind.GrayBrick);
  put(blocks, cx, cz, x, roofY + 1, z, BlockKind.Chest);
  if (name) {
    const sign = put(blocks, cx, cz, x, 12, z + 6, BlockKind.Sign, true, 'south');
    if (sign) sign.text = name;
  }
  for (let step = 0; step < 3; step += 1) put(blocks, cx, cz, x - 2, roofY + 1 + step, z + 4 + step, BlockKind.OakPlanks);
}

export function generateDeliveryChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
    if (x < -48 || x >= 48 || z < -48 || z >= 48) continue;
    const road = roadDistance(x) <= 3 || roadDistance(z) <= 3;
    put(blocks, cx, cz, x, 7, z, road ? BlockKind.ConcreteGray : BlockKind.Grass);
    if (x === -48 || x === 47 || z === -48 || z === 47) for (let y = 8; y <= 11; y += 1) put(blocks, cx, cz, x, y, z, BlockKind.Bedrock);
  }

  const houses = [
    [-36, -36, 7, BlockKind.BeigeBrick, BlockKind.ConcreteRed, 'BOULANGERIE'],
    [-12, -36, 6, BlockKind.WhiteBrick, BlockKind.ConcreteGray],
    [12, -36, 8, BlockKind.BeigeBrick, BlockKind.ConcreteRed],
    [36, -36, 7, BlockKind.WhiteBrick, BlockKind.ConcreteGray],
    [-36, -12, 8, BlockKind.ConcreteLightBlue, BlockKind.ConcreteBlue],
    [-12, -12, 6, BlockKind.WhiteBrick, BlockKind.ConcreteGray],
    [12, -12, 7, BlockKind.BeigeBrick, BlockKind.ConcreteRed],
    [36, -12, 9, BlockKind.ConcreteLightBlue, BlockKind.ConcreteBlue, 'VILLA BLEUE'],
    [-36, 12, 6, BlockKind.WhiteBrick, BlockKind.ConcreteGray],
    [-12, 12, 7, BlockKind.BeigeBrick, BlockKind.ConcreteRed],
    [12, 12, 8, BlockKind.WhiteBrick, BlockKind.ConcreteGray],
    [36, 12, 6, BlockKind.BeigeBrick, BlockKind.ConcreteRed],
    [-36, 36, 7, BlockKind.WhiteBrick, BlockKind.ConcreteGray],
    [-12, 36, 8, BlockKind.BeigeBrick, BlockKind.ConcreteRed],
    [12, 36, 6, BlockKind.WhiteBrick, BlockKind.ConcreteGray],
    [36, 36, 6, BlockKind.ConcretePink, BlockKind.ConcreteMagenta, 'MAISON ROSE'],
  ] as const;
  for (const [x, z, height, wall, roof, name] of houses) house(blocks, cx, cz, x, z, height, wall, roof, name);

  for (let x = -7; x <= 7; x += 1) for (let z = -7; z <= 7; z += 1) {
    put(blocks, cx, cz, x, 7, z, BlockKind.OakPlanks);
    put(blocks, cx, cz, x, 16, z, BlockKind.ConcreteRed);
    if (x === -7 || x === 7 || z === -7 || z === 7) for (let y = 8; y <= 15; y += 1) if (!(z === 7 && Math.abs(x) <= 1 && y <= 10)) put(blocks, cx, cz, x, y, z, BlockKind.WhiteBrick);
  }
  for (let x = -1; x <= 1; x += 1) for (let y = 8; y <= 10; y += 1) put(blocks, cx, cz, x, y, 7, BlockKind.DoorRed, true, 'north');
  for (let y = 8; y <= 16; y += 1) put(blocks, cx, cz, 5, y, 0, BlockKind.Ladder, true, 'west');
  put(blocks, cx, cz, 0, 8, 3, BlockKind.Chest);
  const postSign = put(blocks, cx, cz, 0, 12, 8, BlockKind.Sign, true, 'south');
  if (postSign) postSign.text = 'POSTE CENTRALE\nCOLIS';
  for (const [x, z] of [[-20, -20], [20, -20], [-20, 20], [20, 20]] as const) {
    for (let y = 8; y <= 11; y += 1) put(blocks, cx, cz, x, y, z, BlockKind.Wood);
    for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) put(blocks, cx, cz, x + dx, 12, z + dz, BlockKind.Leaves);
  }
  return { blocks, water: [] };
}
