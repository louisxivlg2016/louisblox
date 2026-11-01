import { BlockKind, voxelKey } from './voxel';
import { churchBlocks } from './churches';
import type { Voxel } from './voxel';
import type { GeneratedChunk } from './levels';
import { CITY_LIMIT } from './worldMode';

const GROUND = 5;
const BLOCK_SIZE = 48;

function hash(x: number, z: number, seed: number) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function generateCityChunk(cx: number, cz: number, seed: number, modern: boolean): GeneratedChunk {
  const blocks = new Map<string, Voxel>();
  const minX = cx * 16;
  const minZ = cz * 16;
  const put = (x: number, y: number, z: number, kind: BlockKind) => {
    if (Math.abs(x) > CITY_LIMIT || Math.abs(z) > CITY_LIMIT) return;
    blocks.set(voxelKey(x, y, z), { x, y, z, kind });
  };

  for (let x = minX; x < minX + 16; x++) {
    for (let z = minZ; z < minZ + 16; z++) {
      if (Math.abs(x) > CITY_LIMIT || Math.abs(z) > CITY_LIMIT) continue;
      for (let y = 0; y < GROUND; y++) put(x, y, z, y === 0 ? BlockKind.Bedrock : BlockKind.Stone);
      const street = ((x % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE < 8 || ((z % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE < 8;
      put(x, GROUND, z, street ? BlockKind.GrayBrick : modern ? BlockKind.ConcreteLightGray : BlockKind.BeigeBrick);
    }
  }

  const firstX = Math.floor(minX / BLOCK_SIZE) - 1;
  const firstZ = Math.floor(minZ / BLOCK_SIZE) - 1;
  for (let bx = firstX; bx <= firstX + 2; bx++) {
    for (let bz = firstZ; bz <= firstZ + 2; bz++) {
      const centerX = bx * BLOCK_SIZE + 28;
      const centerZ = bz * BLOCK_SIZE + 28;
      const church = !modern && (bx === 0 && bz === -1 || (Math.abs(bx) % 9 === 0 && Math.abs(bz) % 9 === 0 && (bx !== 0 || bz !== 0)));
      if (church) {
        for (const block of churchBlocks(centerX, centerZ, GROUND + 1)) put(block.x, block.y, block.z, block.kind);
        continue;
      }
      const variation = hash(bx, bz, seed);
      if (variation < 0.07) continue;
      const half = modern && variation < 0.35 ? 9 : 11;
      const floors = modern ? variation < 0.35 ? 2 : 4 + Math.floor(variation * 5) : 3 + Math.floor(variation * 3);
      const height = GROUND + floors * 4;
      const wall = modern ? BlockKind.ConcreteWhite : variation < 0.5 ? BlockKind.BeigeBrick : BlockKind.WhiteBrick;
      const accent = modern ? [BlockKind.GlassCyan, BlockKind.GlassBlue, BlockKind.GlassMagenta][Math.floor(variation * 3)] : BlockKind.Glass;
      for (let x = centerX - half; x <= centerX + half; x++) {
        for (let z = centerZ - half; z <= centerZ + half; z++) {
          const edgeX = Math.abs(x - centerX) === half;
          const edgeZ = Math.abs(z - centerZ) === half;
          if (!edgeX && !edgeZ) continue;
          for (let y = GROUND + 1; y < height; y++) {
            const localY = y - GROUND - 1;
            const doorway = z === centerZ - half && Math.abs(x - centerX) <= 1 && y <= GROUND + 3;
            if (doorway) continue;
            const window = localY % 4 >= 1 && localY % 4 <= 2 && ((edgeX ? z : x) - centerX + half) % (modern ? 2 : 3) === 1;
            const foundation = localY === 0;
            put(x, y, z, foundation ? modern ? BlockKind.ConcreteGray : BlockKind.GrayBrick : window ? accent : wall);
          }
        }
      }
      put(centerX, GROUND + 1, centerZ - half, modern ? BlockKind.DoorWhite : BlockKind.DoorBrown);
      if (modern) {
        for (let x = centerX - half; x <= centerX + half; x++) {
          for (let z = centerZ - half; z <= centerZ + half; z++) put(x, height, z, BlockKind.ConcreteLightGray);
        }
        if (variation >= 0.35) {
          for (let y = height + 1; y <= height + 4; y++) {
            for (let x = centerX - 5; x <= centerX + 5; x++) {
              for (let z = centerZ - 5; z <= centerZ + 5; z++) {
                if (Math.abs(x - centerX) === 5 || Math.abs(z - centerZ) === 5) put(x, y, z, accent);
              }
            }
          }
        }
      } else {
        for (let tier = 0; tier < 4; tier++) {
          const radius = half - tier;
          for (let x = centerX - radius; x <= centerX + radius; x++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
              if (Math.abs(x - centerX) === radius || Math.abs(z - centerZ) === radius || tier === 3) put(x, height + tier, z, BlockKind.PinePlanks);
            }
          }
        }
        for (const offset of [-6, 6]) {
          for (let y = height + 3; y <= height + 5; y++) put(centerX + offset, y, centerZ + 4, BlockKind.GrayBrick);
        }
      }
    }
  }
  return { blocks: [...blocks.values()], water: [] };
}
