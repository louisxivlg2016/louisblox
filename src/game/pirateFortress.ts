import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';
import { PIRATE_CHEST_OFFSETS } from './pirateShipGeometry';
import { voxelKey } from './voxel';
import type { World } from 'koota';

const wallHits = new WeakMap<World, Map<string, number>>();

export function damagePirateFortressWalls(world: World, blocks: Map<string, Voxel>, removeBlock: (block: Voxel) => void, position: { x: number; y: number; z: number }, radius = 1.6) {
  const hits = wallHits.get(world) ?? new Map<string, number>();
  for (const block of [...blocks.values()]) {
    if (block.kind !== BlockKind.GrayBrick && block.kind !== BlockKind.Stone || Math.hypot(block.x - position.x, block.y - position.y, block.z - position.z) > radius) continue;
    const key = voxelKey(block.x, block.y, block.z);
    const count = (hits.get(key) ?? 0) + 1;
    hits.set(key, count);
    if (count >= 20) {
      removeBlock(block);
      hits.delete(key);
    }
  }
  wallHits.set(world, hits);
}

export function pirateFortressSpawn(team: 'red' | 'blue' | null) {
  return { x: team === 'red' ? -18 : 18, y: 9.51, z: 3 };
}

function put(blocks: Voxel[], cx: number, cz: number, x: number, y: number, z: number, kind: BlockKind, protectedBlock = true, facing?: Voxel['facing']) {
  if (Math.floor(x / CHUNK_SIZE) !== cx || Math.floor(z / CHUNK_SIZE) !== cz) return;
  const block: Voxel = { x, y, z, kind, ...(protectedBlock ? { protected: true } : {}), ...(facing ? { facing } : {}) };
  blocks.push(block);
  return block;
}

function fortress(blocks: Voxel[], cx: number, cz: number, centerX: number, team: 'red' | 'blue') {
  const color = team === 'red' ? BlockKind.ConcreteRed : BlockKind.ConcreteBlue;
  const gateX = team === 'red' ? centerX + 10 : centerX - 10;
  const inward = team === 'red' ? 1 : -1;
  for (let x = centerX - 10; x <= centerX + 10; x += 1) for (let z = -10; z <= 10; z += 1) {
    put(blocks, cx, cz, x, 7, z, Math.abs(x - centerX) <= 6 && Math.abs(z) <= 6 ? BlockKind.Stone : BlockKind.Grass);
    const edge = x === centerX - 10 || x === centerX + 10 || z === -10 || z === 10;
    if (edge) {
      for (let y = 8; y <= 14; y += 1) {
        const gate = x === gateX && Math.abs(z) <= 1 && y <= 10;
        const window = y === 12 && (x + z) % 4 === 0;
        if (!gate) put(blocks, cx, cz, x, y, z, window ? BlockKind.Glass : BlockKind.GrayBrick);
      }
      if ((x + z) % 2 === 0) put(blocks, cx, cz, x, 15, z, BlockKind.Stone);
    }
  }
  for (const towerX of [centerX - 10, centerX + 10]) for (const towerZ of [-10, 10]) {
    for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
      for (let y = 8; y <= 17; y += 1) {
        const edge = dx === -2 || dx === 2 || dz === -2 || dz === 2;
        const window = edge && (y === 12 || y === 15) && (dx === 0 || dz === 0);
        if (edge) put(blocks, cx, cz, towerX + dx, y, towerZ + dz, window ? BlockKind.Glass : BlockKind.GrayBrick);
      }
      put(blocks, cx, cz, towerX + dx, 18, towerZ + dz, BlockKind.Stone);
      if ((dx + dz) % 2 === 0 && (dx === -2 || dx === 2 || dz === -2 || dz === 2)) put(blocks, cx, cz, towerX + dx, 19, towerZ + dz, BlockKind.Stone);
    }
    put(blocks, cx, cz, towerX, 20, towerZ, color);
    put(blocks, cx, cz, towerX, 21, towerZ, color);
  }
  for (let dx = -3; dx <= 3; dx += 1) for (let dz = -3; dz <= 3; dz += 1) {
    put(blocks, cx, cz, centerX + dx, 7, dz, BlockKind.Stone);
    put(blocks, cx, cz, centerX + dx, 18, dz, BlockKind.Stone);
    const edge = dx === -3 || dx === 3 || dz === -3 || dz === 3;
    if (edge) {
      for (let y = 8; y <= 17; y += 1) {
        const door = dx === inward * 3 && dz === 0 && y <= 10;
        const window = (y === 12 || y === 16) && (dx === 0 || dz === 0);
        if (!door) put(blocks, cx, cz, centerX + dx, y, dz, window ? BlockKind.Glass : BlockKind.Stone);
      }
      if ((dx + dz) % 2 === 0) put(blocks, cx, cz, centerX + dx, 19, dz, BlockKind.GrayBrick);
    }
  }
  put(blocks, cx, cz, centerX, 20, 0, color);
  put(blocks, cx, cz, centerX, 21, 0, color);
  put(blocks, cx, cz, centerX, 22, 0, color);
  for (let y = 8; y <= 17; y += 1) put(blocks, cx, cz, centerX + inward * 4, y, 0, BlockKind.Ladder, true, inward > 0 ? 'east' : 'west');
  for (let z = -1; z <= 1; z += 1) for (let y = 8; y <= 10; y += 1) put(blocks, cx, cz, gateX, y, z, BlockKind.DoorBlack, true, team === 'red' ? 'west' : 'east');
  const sign = put(blocks, cx, cz, gateX, 12, 0, BlockKind.Sign, true, team === 'red' ? 'west' : 'east');
  if (sign) sign.text = team === 'red' ? 'FORT ROUGE' : 'FORT BLEU';
  for (const [dx, dy, dz] of PIRATE_CHEST_OFFSETS) put(blocks, cx, cz, centerX + dx, 7 + dy, dz, BlockKind.Chest, true, 'south');
  for (const z of [-6, 6]) for (const x of [centerX - 6, centerX + 6]) {
    put(blocks, cx, cz, x, 8, z, BlockKind.Wood);
    put(blocks, cx, cz, x, 9, z, BlockKind.Wood);
  }
}

export function generatePirateFortressChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
    if (Math.abs(x) > 48 || Math.abs(z) > 48) continue;
    put(blocks, cx, cz, x, 7, z, Math.abs(x) <= 3 ? BlockKind.ConcreteGray : BlockKind.Grass);
  }
  fortress(blocks, cx, cz, -16, 'red');
  fortress(blocks, cx, cz, 16, 'blue');
  return { blocks, water: [] };
}
