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

export const DELIVERY_LEVEL_COUNT = 10;
const destinations = [
  ...DELIVERY_POINTS.slice(0, 3),
  { x: -12, y: 14, z: -36, name: 'Café', englishName: 'Café' },
  { x: 12, y: 16, z: -36, name: 'Bibliothèque', englishName: 'Library' },
  { x: 36, y: 15, z: -36, name: 'Hôtel', englishName: 'Hotel' },
  { x: -36, y: 16, z: -12, name: 'Résidence Azur', englishName: 'Azure Residence' },
  { x: -12, y: 14, z: -12, name: 'Maison familiale', englishName: 'Family House' },
  { x: 12, y: 15, z: -12, name: 'Appartements', englishName: 'Apartments' },
  { x: -36, y: 14, z: 12, name: 'Ferme urbaine', englishName: 'Urban Farm' },
  { x: -12, y: 15, z: 12, name: 'Maison du parc', englishName: 'Park House' },
  { x: 12, y: 16, z: 12, name: 'Maison du marché', englishName: 'Market House' },
  { x: 36, y: 14, z: 12, name: 'Maison des fleurs', englishName: 'Flower House' },
  { x: -36, y: 15, z: 36, name: 'Atelier', englishName: 'Workshop' },
  { x: -12, y: 16, z: 36, name: 'Maison du canal', englishName: 'Canal House' },
  { x: 12, y: 14, z: 36, name: 'Maison centrale', englishName: 'Central House' },
] as const;

export function deliveryPointAt(level: number, index: number) {
  if (index === 3) return DELIVERY_POINTS[3];
  if (level === 0) return { ...DELIVERY_POINTS[index], y: 8.51 };
  const start = level * 3 % destinations.length;
  return { ...destinations[(start + index * 5) % destinations.length], y: 8.51 };
}

export const DELIVERY_CHIMNEYS = destinations.map((destination) => ({ x: destination.x + 2, y: destination.y + 1, z: destination.z - 2, houseX: destination.x, houseZ: destination.z }));

function put(blocks: Voxel[], cx: number, cz: number, x: number, y: number, z: number, kind: BlockKind, protectedBlock = true, facing?: Voxel['facing']) {
  if (Math.floor(x / CHUNK_SIZE) !== cx || Math.floor(z / CHUNK_SIZE) !== cz) return;
  const block: Voxel = { x, y, z, kind, ...(protectedBlock ? { protected: true } : {}), ...(facing ? { facing } : {}) };
  blocks.push(block);
  return block;
}

function clear(blocks: Voxel[], x: number, y: number, z: number) {
  const index = blocks.findIndex((block) => block.x === x && block.y === y && block.z === z);
  if (index >= 0) blocks.splice(index, 1);
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
  for (let y = 8; y <= roofY + 2; y += 1) {
    clear(blocks, x + 2, y, z - 2);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) put(blocks, cx, cz, x + 2 + dx, y, z - 2 + dz, BlockKind.GrayBrick);
  }
  for (let y = 8; y <= roofY + 1; y += 1) put(blocks, cx, cz, x + 2, y, z - 2, BlockKind.Ladder, true, 'east');
  put(blocks, cx, cz, x, roofY + 1, z, BlockKind.Chest);
  if (name) {
    const sign = put(blocks, cx, cz, x + 2, 9, z + 6, BlockKind.Sign, true, 'south');
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
    [-36, -36, 7, BlockKind.BeigeBrick, BlockKind.ConcreteRed, 'BOULANGERIE\nCOLIS ALIMENTAIRE'],
    [-12, -36, 6, BlockKind.WhiteBrick, BlockKind.ConcreteGray, 'CAFÉ'],
    [12, -36, 8, BlockKind.BeigeBrick, BlockKind.ConcreteRed, 'BIBLIOTHÈQUE'],
    [36, -36, 7, BlockKind.WhiteBrick, BlockKind.ConcreteGray, 'HÔTEL'],
    [-36, -12, 8, BlockKind.ConcreteLightBlue, BlockKind.ConcreteBlue, 'RÉSIDENCE AZUR'],
    [-12, -12, 6, BlockKind.WhiteBrick, BlockKind.ConcreteGray, 'MAISON FAMILIALE'],
    [12, -12, 7, BlockKind.BeigeBrick, BlockKind.ConcreteRed, 'APPARTEMENTS'],
    [36, -12, 9, BlockKind.ConcreteLightBlue, BlockKind.ConcreteBlue, 'VILLA BLEUE\nCOLIS FRAGILE'],
    [-36, 12, 6, BlockKind.WhiteBrick, BlockKind.ConcreteGray, 'FERME URBAINE'],
    [-12, 12, 7, BlockKind.BeigeBrick, BlockKind.ConcreteRed, 'MAISON DU PARC'],
    [12, 12, 8, BlockKind.WhiteBrick, BlockKind.ConcreteGray, 'MAISON DU MARCHÉ'],
    [36, 12, 6, BlockKind.BeigeBrick, BlockKind.ConcreteRed, 'MAISON DES FLEURS'],
    [-36, 36, 7, BlockKind.WhiteBrick, BlockKind.ConcreteGray, 'ATELIER'],
    [-12, 36, 8, BlockKind.BeigeBrick, BlockKind.ConcreteRed, 'MAISON DU CANAL'],
    [12, 36, 6, BlockKind.WhiteBrick, BlockKind.ConcreteGray, 'MAISON CENTRALE'],
    [36, 36, 6, BlockKind.ConcretePink, BlockKind.ConcreteMagenta, 'MAISON ROSE\nCOLIS PERSONNEL'],
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
