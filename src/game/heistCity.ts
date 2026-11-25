import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';

export const HEIST_CITY_LIMIT = 60;
export const HEIST_HIDEOUT = { x: -42, y: 8.51, z: 42 };
export const HEIST_DEPOSIT = { x: -42, y: 8, z: 42 };
export const HEIST_PRISON_SPAWN = { x: 30, y: 8.51, z: 34 };
export const HEIST_GUARD_SPAWN = { x: 38, y: 8.51, z: 25 };
export const HEIST_TUNNEL_EXIT = { x: -27, y: 8.51, z: 42 };
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
  { id: 'painting-1', building: 'museum', name: 'Tableau 1', value: 500, x: -13, y: 10, z: -30 },
  { id: 'painting-2', building: 'museum', name: 'Tableau 2', value: 500, x: 12, y: 10, z: -30 },
  { id: 'painting-3', building: 'museum', name: 'Tableau 3', value: 500, x: 0, y: 14, z: -41 },
  { id: 'gold-1', building: 'bank', name: 'Sac d’or 1', value: 1500, x: 30, y: 4, z: -25 },
  { id: 'gold-2', building: 'bank', name: 'Sac d’or 2', value: 1500, x: 35, y: 4, z: -25 },
  { id: 'gold-3', building: 'bank', name: 'Sac d’or 3', value: 1500, x: 40, y: 4, z: -25 },
  { id: 'gold-4', building: 'bank', name: 'Sac d’or 4', value: 1500, x: 35, y: 4, z: -32 },
];

export type HeistEntry = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  duration: number;
  blocks: Array<{ x: number; y: number; z: number }>;
  requiresTnt?: boolean;
  alarm?: boolean;
  destination?: { x: number; y: number; z: number };
};

function entryBlocks(x: number, y: number, z: number, width = 1, height = 3) {
  const blocks: Array<{ x: number; y: number; z: number }> = [];
  for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx += 1) for (let dy = 0; dy < height; dy += 1) blocks.push({ x: x + dx, y: y + dy, z });
  return blocks;
}

export const HEIST_ENTRIES: HeistEntry[] = [
  { id: 'hideout-front', name: 'Porte du repaire', x: -42, y: 9, z: 49, duration: 500, blocks: entryBlocks(-42, 8, 49, 3) },
  { id: 'jewelry-front', name: 'Porte de la bijouterie', x: -35, y: 9, z: -18, duration: 5000, blocks: entryBlocks(-35, 8, -18, 3) },
  { id: 'museum-service', name: 'Porte de service du musée', x: -14, y: 9, z: -30, duration: 8000, blocks: entryBlocks(-14, 8, -30) },
  { id: 'museum-sewer', name: 'Trappe des égouts du musée', x: 8, y: 7, z: -30, duration: 500, blocks: [{ x: 8, y: 7, z: -30 }], destination: { x: 8, y: 2.51, z: -30 } },
  { id: 'bank-main', name: 'Porte principale de la banque', x: 35, y: 9, z: -11, duration: 500, blocks: entryBlocks(35, 8, -11, 3) },
  { id: 'bank-vault', name: 'Porte blindée de la banque', x: 35, y: 4, z: -20, duration: 15000, blocks: entryBlocks(35, 3, -20, 3, 2), alarm: true },
  { id: 'bank-cracked-wall', name: 'Mur fissuré de la banque', x: 35, y: 3, z: -15, duration: 3000, blocks: entryBlocks(35, 2, -15, 1, 3), requiresTnt: true, alarm: true },
];

function put(blocks: Voxel[], x: number, y: number, z: number, kind: BlockKind, protectedBlock = true, facing?: Voxel['facing']) {
  const block: Voxel = { x, y, z, kind, ...(protectedBlock ? { protected: true } : {}), ...(facing ? { facing } : {}) };
  blocks.push(block);
  return block;
}

function clear(blocks: Voxel[], x: number, y: number, z: number) {
  const index = blocks.findIndex((block) => block.x === x && block.y === y && block.z === z);
  if (index >= 0) blocks.splice(index, 1);
}

function building(blocks: Voxel[], centerX: number, centerZ: number, width: number, depth: number, height: number, wall: BlockKind, roof: BlockKind, protectedWalls = false) {
  const x1 = centerX - Math.floor(width / 2);
  const x2 = x1 + width - 1;
  const z1 = centerZ - Math.floor(depth / 2);
  const z2 = z1 + depth - 1;
  for (let x = x1; x <= x2; x += 1) for (let z = z1; z <= z2; z += 1) {
    put(blocks, x, 7, z, BlockKind.OakPlanks, protectedWalls);
    put(blocks, x, 7 + height + 1, z, roof, protectedWalls);
    const edge = x === x1 || x === x2 || z === z1 || z === z2;
    if (!edge) continue;
    for (let y = 8; y <= 7 + height; y += 1) {
      const door = z === z2 && Math.abs(x - centerX) <= 1 && y <= 10;
      const window = y >= 10 && y <= 11 && (x + z) % 4 === 0;
      if (!door) put(blocks, x, y, z, window ? BlockKind.Glass : wall, protectedWalls && !window);
    }
  }
  for (let x = centerX - 1; x <= centerX + 1; x += 1) for (let y = 8; y <= 10; y += 1) put(blocks, x, y, z2, BlockKind.DoorBlack, true, 'north');
  return { x1, x2, z1, z2, roofY: 7 + height + 1 };
}

function ladder(blocks: Voxel[], x: number, z: number, fromY: number, toY: number, facing: Voxel['facing'] = 'south') {
  for (let y = fromY; y <= toY; y += 1) put(blocks, x, y, z, BlockKind.Ladder, true, facing);
}

function sewerX(blocks: Voxel[], x1: number, x2: number, z: number) {
  for (let x = x1; x <= x2; x += 1) {
    put(blocks, x, 1, z, BlockKind.Stone);
    put(blocks, x, 5, z, BlockKind.Stone);
    for (const side of [z - 2, z + 2]) for (let y = 2; y <= 4; y += 1) put(blocks, x, y, side, BlockKind.GrayBrick);
  }
}

function sewerZ(blocks: Voxel[], z1: number, z2: number, x: number) {
  for (let z = z1; z <= z2; z += 1) {
    put(blocks, x, 1, z, BlockKind.Stone);
    put(blocks, x, 5, z, BlockKind.Stone);
    for (const side of [x - 2, x + 2]) for (let y = 2; y <= 4; y += 1) put(blocks, side, y, z, BlockKind.GrayBrick);
  }
}

function hash(x: number, z: number, seed: number) {
  let value = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function roadDistance(value: number) {
  const modulo = ((value % 24) + 24) % 24;
  return Math.min(modulo, 24 - modulo);
}

export function generateHeistChunk(cx: number, cz: number, seed = 0): GeneratedChunk {
  const blocks: Voxel[] = [];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
    if (x < -HEIST_CITY_LIMIT || x >= HEIST_CITY_LIMIT || z < -HEIST_CITY_LIMIT || z >= HEIST_CITY_LIMIT) continue;
    const road = roadDistance(x) <= 3 || roadDistance(z) <= 3;
    put(blocks, x, 7, z, road ? BlockKind.ConcreteGray : BlockKind.ConcreteLightGray, false);
    const boundary = x === -HEIST_CITY_LIMIT || x === HEIST_CITY_LIMIT - 1 || z === -HEIST_CITY_LIMIT || z === HEIST_CITY_LIMIT - 1;
    if (boundary) for (let y = 8; y <= 27; y += 1) put(blocks, x, y, z, BlockKind.Bedrock);
    if (!boundary && road && (roadDistance(x) === 0 || roadDistance(z) === 0) && (x + z) % 4 === 0) put(blocks, x, 8, z, BlockKind.CarpetWhite, false);
  }

  building(blocks, -42, 42, 16, 16, 8, BlockKind.Wood, BlockKind.OakPlanks);
  for (let y = 8; y <= 10; y += 1) clear(blocks, -50, y, 42);
  put(blocks, -50, 9, 42, BlockKind.PaintingForest, false, 'east');
  put(blocks, -42, 8, 42, BlockKind.Chest);
  ladder(blocks, -42, 42, 8, 16);
  clear(blocks, -42, 16, 42);
  put(blocks, -42, 16, 42, BlockKind.Ladder, true, 'south');

  building(blocks, -35, -25, 20, 16, 8, BlockKind.BeigeBrick, BlockKind.Glass);
  for (let x = -36; x <= -34; x += 1) for (let z = -26; z <= -24; z += 1) put(blocks, x, 16, z, BlockKind.Glass, false);
  for (let y = 8; y <= 10; y += 1) put(blocks, -35, y, -33, BlockKind.Glass, false);
  put(blocks, -35, 8, -25, BlockKind.CarpetRed, false);

  building(blocks, 0, -30, 28, 24, 12, BlockKind.WhiteBrick, BlockKind.ConcreteGray);
  for (let x = -1; x <= 1; x += 1) for (let y = 8; y <= 10; y += 1) put(blocks, x, y, -19, BlockKind.WhiteBrick, false);
  for (let x = -13; x <= 12; x += 1) for (let z = -41; z <= -20; z += 1) if (!(x === 0 && z === -41)) put(blocks, x, 13, z, BlockKind.OakPlanks);
  ladder(blocks, 0, -41, 8, 20);
  put(blocks, 0, 20, -41, BlockKind.TrapdoorIron, false);
  for (let y = 8; y <= 10; y += 1) put(blocks, -14, y, -30, BlockKind.DoorBlack, true, 'east');
  put(blocks, 8, 7, -30, BlockKind.TrapdoorIron, false);
  ladder(blocks, 8, -30, 2, 7);
  sewerZ(blocks, -30, -8, 8);

  building(blocks, 35, -25, 34, 30, 14, BlockKind.GrayBrick, BlockKind.ConcreteBlack);
  for (let x = 19; x <= 50; x += 1) for (let z = -39; z <= -12; z += 1) if (!(x === 49 && z === -25)) put(blocks, x, 14, z, BlockKind.ConcreteGray);
  ladder(blocks, 49, -25, 8, 22, 'west');
  ladder(blocks, 44, -25, 3, 14, 'west');
  clear(blocks, 44, 7, -25);
  clear(blocks, 44, 14, -25);
  for (let x = 25; x <= 45; x += 1) for (let z = -35; z <= -15; z += 1) for (let y = 2; y <= 6; y += 1) {
    const edge = x === 25 || x === 45 || z === -35 || z === -15 || y === 2 || y === 6;
    if (edge) put(blocks, x, y, z, BlockKind.Bedrock);
  }
  for (let x = 26; x <= 44; x += 1) for (let y = 3; y <= 5; y += 1) put(blocks, x, y, -20, BlockKind.Bedrock);
  for (let x = 34; x <= 36; x += 1) for (let y = 3; y <= 4; y += 1) put(blocks, x, y, -20, BlockKind.TrapdoorIron);
  for (let y = 2; y <= 4; y += 1) put(blocks, 35, y, -15, BlockKind.GrayBrick, false);
  sewerZ(blocks, -15, -8, 35);

  building(blocks, 38, 38, 24, 20, 5, BlockKind.Bedrock, BlockKind.Bedrock, true);
  for (const [cellX, cellZ] of [[31, 34], [37, 34], [43, 34], [31, 42], [37, 42], [43, 42]] as const) {
    for (let x = cellX - 2; x <= cellX + 1; x += 1) for (let z = cellZ - 2; z <= cellZ + 1; z += 1) {
      if (x !== cellX - 2 && x !== cellX + 1 && z !== cellZ - 2 && z !== cellZ + 1) continue;
      for (let y = 8; y <= 11; y += 1) put(blocks, x, y, z, x === cellX - 2 && z === cellZ ? BlockKind.TrapdoorIron : BlockKind.Bedrock);
    }
    put(blocks, cellX, 8, cellZ, BlockKind.Bed);
    for (let y = 4; y <= 7; y += 1) put(blocks, cellX, y, cellZ, BlockKind.Dirt, false);
  }

  const chestCandidates: Array<[number, number, number]> = [[29, 2, 44], [33, 2, 49], [38, 2, 46], [40, 2, 51]];
  const hiddenChest = chestCandidates[Math.floor(hash(0, 0, seed) * chestCandidates.length) % chestCandidates.length];
  for (let x = 24; x <= 41; x += 1) for (let z = 41; z <= 52; z += 1) {
    put(blocks, x, 0, z, BlockKind.Bedrock);
    put(blocks, x, 4, z, BlockKind.Stone);
    for (let y = 1; y <= 3; y += 1) {
      const value = Math.floor(hash(x + y * 31, z, seed) * 10);
      put(blocks, x, y, z, value === 0 ? BlockKind.Bedrock : value <= 2 ? BlockKind.Sand : BlockKind.Dirt, value === 0);
    }
  }
  put(blocks, hiddenChest[0], hiddenChest[1], hiddenChest[2], BlockKind.Chest, false).items = ['pickaxe_stone'];
  for (let y = 1; y <= 3; y += 1) put(blocks, 24, y, 47, BlockKind.GrayBrick, false);
  put(blocks, 23, 2, 47, BlockKind.JungleVine, false, 'east');
  sewerX(blocks, -27, 24, 47);
  sewerZ(blocks, 42, 47, -27);
  ladder(blocks, -27, 42, 2, 8, 'east');

  for (const z of [-8, 8]) sewerX(blocks, -50, 50, z);
  for (const x of [-8, 8]) sewerZ(blocks, -50, 50, x);
  for (let x = -50; x <= 50; x += 1) for (const z of [-8, 8]) if (x % 3 !== 0) put(blocks, x, 2, z, BlockKind.CalmWater, false);

  for (const [x, y, z, text] of [
    [-42, 10, 50, 'REPAIRE DES VOLEURS'],
    [-35, 10, -17, 'BIJOUTERIE'],
    [0, 10, -18, 'MUSEE'],
    [35, 10, -10, 'GRANDE BANQUE\nCOFFRE-FORT'],
    [38, 10, 48, 'PRISON\nTUNNEL D’ÉVASION'],
  ] as const) put(blocks, x, y, z, BlockKind.Sign, true, 'south').text = text;
  for (const diamond of HEIST_LOOT.filter((loot) => loot.building === 'jewelry')) {
    put(blocks, diamond.x - 1, 8, diamond.z, BlockKind.Glass, false);
    put(blocks, diamond.x + 1, 8, diamond.z, BlockKind.Glass, false);
    put(blocks, diamond.x, 8, diamond.z + 1, BlockKind.Glass, false);
    put(blocks, diamond.x, 9, diamond.z, BlockKind.Glass, false);
    put(blocks, diamond.x, 7, diamond.z, BlockKind.ConcreteBlack);
  }
  for (const x of [-42, -28]) for (const z of [-30, -20]) put(blocks, x, 12, z, BlockKind.ModernCeilingLight);
  for (const [x, z] of [[-8, -26], [8, -26], [-8, -35], [8, -35]] as const) {
    put(blocks, x, 8, z, BlockKind.StairOak, true, 'north');
    put(blocks, x, 9, z + 1, BlockKind.OakPlanks);
  }
  put(blocks, 0, 7, -30, BlockKind.ConcreteBlack);
  for (const [x, z] of [[-11, -25], [11, -25], [-11, -36], [11, -36]] as const) put(blocks, x, 17, z, BlockKind.ModernCeilingLight);

  for (let x = 29; x <= 41; x += 3) put(blocks, x, 8, -15, BlockKind.GrayBrick);
  for (const [x, z] of [[25, -25], [32, -20], [42, -32]] as const) {
    put(blocks, x, 15, z, BlockKind.OakPlanks);
    put(blocks, x + 1, 15, z, BlockKind.StairOak, true, 'west');
    put(blocks, x, 16, z + 1, BlockKind.ModernCeilingLight);
  }
  for (const [x, z] of [[27, -30], [27, -22], [43, -30], [43, -22], [31, -34], [39, -34]] as const) {
    put(blocks, x, 3, z, BlockKind.SafeChest);
    put(blocks, x, 4, z, BlockKind.SafeChest);
  }
  for (const x of [30, 40]) put(blocks, x, 12, -13, BlockKind.ModernCeilingLight);

  for (const loot of HEIST_LOOT) {
    if (loot.id === 'painting-1') put(blocks, loot.x, loot.y, loot.z, BlockKind.PaintingCastle, true, 'east');
    else if (loot.id === 'painting-2') put(blocks, loot.x, loot.y, loot.z, BlockKind.PaintingForest, true, 'west');
    else if (loot.id === 'painting-3') put(blocks, loot.x, loot.y, loot.z, BlockKind.PaintingKing, true, 'south');
    else if (loot.id !== 'crown') put(blocks, loot.x, loot.y, loot.z, BlockKind.Chest);
  }
  const unique = [...new Map(blocks.map((block) => [voxelKey(block.x, block.y, block.z), block])).values()];
  return { blocks: unique.filter((block) => Math.floor(block.x / CHUNK_SIZE) === cx && Math.floor(block.z / CHUNK_SIZE) === cz), water: [] };
}
