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
export const ROLEPLAY_FIRE_STATION = { x: 20, y: 8.51, z: -20 };
export const ROLEPLAY_MINE = { x: 32, y: 8.51, z: -32 };

function put(blocks: Voxel[], cx: number, cz: number, x: number, y: number, z: number, kind: BlockKind, protectedBlock = true, facing?: Voxel['facing']) {
  if (Math.floor(x / CHUNK_SIZE) !== cx || Math.floor(z / CHUNK_SIZE) !== cz) return undefined;
  const block: Voxel = { x, y, z, kind, ...(protectedBlock ? { protected: true } : {}), ...(facing ? { facing } : {}) };
  blocks.push(block);
  return block;
}

function sign(blocks: Voxel[], cx: number, cz: number, x: number, y: number, z: number, text: string) {
  const block = put(blocks, cx, cz, x, y, z, BlockKind.Sign, true, 'south');
  if (block) block.text = text;
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
  if (color === BlockKind.ConcreteLightBlue) for (let y = 8; y <= 10; y += 1) put(blocks, cx, cz, centerX, y, centerZ - 6, BlockKind.DoorBlue, false, 'north');
  put(blocks, cx, cz, centerX + 4, 8, centerZ + 4, BlockKind.Chest, false);
  put(blocks, cx, cz, centerX - 4, 8, centerZ + 4, BlockKind.Bed, false);
}

function mine(blocks: Voxel[], cx: number, cz: number) {
  for (let x = 26; x <= 42; x += 1) for (let z = -42; z <= -25; z += 1) {
    put(blocks, cx, cz, x, 2, z, (x * 5 + z * 7) % 13 === 0 ? BlockKind.CoalOre : BlockKind.Stone, false);
    put(blocks, cx, cz, x, 7, z, BlockKind.Stone, false);
    const wall = x === 26 || x === 42 || z === -42 || z === -25 && (x < 31 || x > 33);
    if (wall) for (let y = 3; y <= 6; y += 1) {
      const ore = (x * 11 + z * 7 + y * 3) % 17 === 0 ? BlockKind.IronOre : (x + z + y) % 19 === 0 ? BlockKind.CoalOre : BlockKind.Stone;
      put(blocks, cx, cz, x, y, z, ore, false);
    }
  }
  for (let z = -40; z <= -26; z += 5) {
    for (const x of [27, 41]) for (let y = 3; y <= 6; y += 1) put(blocks, cx, cz, x, y, z, BlockKind.Wood, false);
    for (let x = 27; x <= 41; x += 1) put(blocks, cx, cz, x, 6, z, BlockKind.OakPlanks, false);
    put(blocks, cx, cz, 28, 4, z, BlockKind.Candle, false);
    put(blocks, cx, cz, 40, 4, z, BlockKind.Candle, false);
  }
  for (let step = 0; step <= 4; step += 1) {
    const z = -20 - step;
    const floorY = 7 - step;
    for (let x = 31; x <= 33; x += 1) {
      put(blocks, cx, cz, x, floorY, z, BlockKind.Stone, false);
      if (x === 32) put(blocks, cx, cz, x, floorY + 1, z, BlockKind.Rail, false);
    }
    for (const x of [30, 34]) for (let y = floorY + 1; y <= floorY + 3; y += 1) put(blocks, cx, cz, x, y, z, BlockKind.Stone, false);
  }
  for (let z = -40; z <= -26; z += 1) put(blocks, cx, cz, 32, 3, z, BlockKind.Rail, false);
  sign(blocks, cx, cz, 29, 8, -20, 'MINE SOUTERRAINE\nDESCENDRE');
}

export function generateRoleplayChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
    if (x < -48 || x >= 48 || z < -48 || z >= 48) continue;
    const road = Math.abs(x) <= 4 || Math.abs(z + 20) <= 4 || Math.abs(x - 32) <= 3;
    const mineCavity = x >= 26 && x <= 42 && z >= -42 && z <= -25 || x >= 31 && x <= 33 && z >= -24 && z <= -20;
    if (!mineCavity) put(blocks, cx, cz, x, 7, z, road ? BlockKind.ConcreteGray : BlockKind.Grass);
    if (x === -48 || x === 47 || z === -48 || z === 47) for (let y = 8; y <= 12; y += 1) put(blocks, cx, cz, x, y, z, BlockKind.Bedrock);
  }
  const colors = [BlockKind.BeigeBrick, BlockKind.ConcreteLightBlue, BlockKind.ConcretePink, BlockKind.ConcreteLime] as const;
  ROLEPLAY_HOMES.forEach((home, index) => house(blocks, cx, cz, home.x, home.z, colors[index]));
  for (const x of [-3, 3]) for (const z of [-22, -18]) for (let y = 8; y <= 11; y += 1) put(blocks, cx, cz, x, y, z, BlockKind.OakPlanks, false);
  for (let x = -3; x <= 3; x += 1) {
    put(blocks, cx, cz, x, 8, -18, BlockKind.OakPlanks, false);
    put(blocks, cx, cz, x, 9, -18, BlockKind.OakPlanks, false);
    put(blocks, cx, cz, x, 9, -22, BlockKind.OakPlanks, false);
  }
  for (let x = -4; x <= 4; x += 1) for (let z = -23; z <= -17; z += 1) put(blocks, cx, cz, x, 12, z, x % 2 === 0 ? BlockKind.ConcreteRed : BlockKind.ConcreteWhite, false);
  for (let x = -3; x <= 3; x += 1) for (let z = -22; z <= -18; z += 1) put(blocks, cx, cz, x, 13, z, x % 2 === 0 ? BlockKind.ConcreteRed : BlockKind.ConcreteWhite, false);
  put(blocks, cx, cz, 2, 8, -20, BlockKind.Chest);
  for (let x = -26; x <= -14; x += 1) for (let z = -26; z <= -14; z += 1) {
    put(blocks, cx, cz, x, 14, z, BlockKind.ConcreteBlue);
    if (x === -26 || x === -14 || z === -26 || z === -14) for (let y = 8; y <= 13; y += 1) put(blocks, cx, cz, x, y, z, BlockKind.ConcreteLightBlue);
  }
  put(blocks, cx, cz, ROLEPLAY_POLICE.x, 8, ROLEPLAY_POLICE.z, BlockKind.Chest);
  for (let x = 14; x <= 26; x += 1) for (let z = -26; z <= -14; z += 1) {
    put(blocks, cx, cz, x, 14, z, BlockKind.ConcreteRed);
    if (x === 14 || x === 26 || z === -26 || z === -14) for (let y = 8; y <= 13; y += 1) put(blocks, cx, cz, x, y, z, y % 2 === 0 ? BlockKind.ConcreteRed : BlockKind.WhiteBrick);
  }
  put(blocks, cx, cz, ROLEPLAY_FIRE_STATION.x, 8, ROLEPLAY_FIRE_STATION.z, BlockKind.Chest);
  mine(blocks, cx, cz);
  sign(blocks, cx, cz, 0, 9, -15, 'TRAVAIL · MARCHAND');
  sign(blocks, cx, cz, -20, 9, -13, 'TRAVAIL · POLICIER');
  sign(blocks, cx, cz, 20, 9, -13, 'TRAVAIL · POMPIER');
  sign(blocks, cx, cz, 32, 8, -23, 'TRAVAIL · MINEUR');
  sign(blocks, cx, cz, 8, 9, -15, 'TRAVAIL · CONSTRUCTEUR\nVILLE ENTIÈRE');
  return { blocks, water: [] };
}
