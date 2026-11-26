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
  for (let x = centerX - 10; x <= centerX + 10; x += 1) for (let z = -10; z <= 10; z += 1) {
    put(blocks, cx, cz, x, 7, z, BlockKind.OakPlanks);
    const edge = x === centerX - 10 || x === centerX + 10 || z === -10 || z === 10;
    if (edge) for (let y = 8; y <= 14; y += 1) {
      const gate = x === gateX && Math.abs(z) <= 1 && y <= 10;
      if (!gate) put(blocks, cx, cz, x, y, z, BlockKind.GrayBrick);
    }
  }
  for (const x of [centerX - 10, centerX + 10]) for (const z of [-10, 10]) {
    for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
      put(blocks, cx, cz, x + dx, 15, z + dz, BlockKind.Stone);
      if (dx === -2 || dx === 2 || dz === -2 || dz === 2) for (let y = 8; y <= 17; y += 1) put(blocks, cx, cz, x + dx, y, z + dz, BlockKind.GrayBrick);
    }
    put(blocks, cx, cz, x, 18, z, color);
    put(blocks, cx, cz, x, 19, z, color);
  }
  for (let z = -1; z <= 1; z += 1) for (let y = 8; y <= 10; y += 1) put(blocks, cx, cz, gateX, y, z, BlockKind.DoorBlack, true, team === 'red' ? 'west' : 'east');
  const sign = put(blocks, cx, cz, gateX, 12, 0, BlockKind.Sign, true, team === 'red' ? 'west' : 'east');
  if (sign) sign.text = team === 'red' ? 'FORT ROUGE' : 'FORT BLEU';
  for (let z = -7; z <= 7; z += 1) {
    put(blocks, cx, cz, centerX - 4, 8, z, BlockKind.Stone);
    put(blocks, cx, cz, centerX + 4, 8, z, BlockKind.Stone);
  }
  for (let z = -6; z <= 6; z += 1) {
    put(blocks, cx, cz, centerX - 3, 8, z, BlockKind.Ladder, true, 'east');
    put(blocks, cx, cz, centerX + 3, 8, z, BlockKind.Ladder, true, 'west');
  }
  for (const [dx, dy, dz] of PIRATE_CHEST_OFFSETS) put(blocks, cx, cz, centerX + dx, 7 + dy, dz, BlockKind.Chest, true, 'south');
  for (const z of [-6, 0, 6]) {
    put(blocks, cx, cz, centerX - 4, 10, z, BlockKind.ConcreteBlack);
    put(blocks, cx, cz, centerX + 4, 10, z, BlockKind.ConcreteBlack);
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
