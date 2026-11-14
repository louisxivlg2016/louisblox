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
  const water: Array<{ x: number; z: number }> = [];
  const minX = cx * 16;
  const minZ = cz * 16;
  const put = (x: number, y: number, z: number, kind: BlockKind, facing?: Voxel['facing'], open?: boolean) => {
    if (x < minX || x >= minX + 16 || z < minZ || z >= minZ + 16) return;
    if (Math.abs(x) > CITY_LIMIT || Math.abs(z) > CITY_LIMIT) return;
    blocks.set(voxelKey(x, y, z), { x, y, z, kind, ...(facing ? { facing } : {}), ...(open !== undefined ? { open } : {}) });
  };
  const addWater = (x: number, z: number) => {
    if (x >= minX && x < minX + 16 && z >= minZ && z < minZ + 16 && Math.abs(x) <= CITY_LIMIT && Math.abs(z) <= CITY_LIMIT) water.push({ x, z });
  };

  for (let x = minX; x < minX + 16; x++) {
    for (let z = minZ; z < minZ + 16; z++) {
      if (Math.abs(x) > CITY_LIMIT || Math.abs(z) > CITY_LIMIT) continue;
      const road = ((x % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE < 8 || ((z % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE < 8;
      const sea = modern && z >= 208;
      const beach = modern && z >= 144;
      const surface = road ? hash(x, z, seed + 43) > 0.82 ? BlockKind.Stone : BlockKind.GrayBrick : modern ? BlockKind.ConcreteLightGray : BlockKind.BeigeBrick;
      for (let y = 0; y <= GROUND; y++) {
        const kind = y === 0 ? BlockKind.Bedrock : sea && y === GROUND ? BlockKind.CalmWater : (sea || beach) && y >= GROUND - 1 ? BlockKind.Sand : y === GROUND ? surface : BlockKind.Stone;
        put(x, y, z, kind);
      }
      if (sea) addWater(x, z);
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
        for (const block of churchBlocks(centerX, centerZ, GROUND + 1)) put(block.x, block.y, block.z, block.kind, block.facing, block.open);
        continue;
      }
      if (modern && centerZ >= 144) {
        if (centerZ === 172) {
          const halfX = 7;
          const halfZ = 5;
          for (let x = centerX - halfX; x <= centerX + halfX; x++) {
            for (let z = centerZ - halfZ; z <= centerZ + halfZ; z++) {
              put(x, GROUND + 1, z, BlockKind.OakPlanks);
              put(x, GROUND + 6, z, BlockKind.ConcreteLightGray);
              const edgeX = Math.abs(x - centerX) === halfX;
              const edgeZ = Math.abs(z - centerZ) === halfZ;
              if (!edgeX && !edgeZ) continue;
              for (let y = GROUND + 2; y <= GROUND + 5; y++) {
                const doorway = z === centerZ - halfZ && x === centerX && y <= GROUND + 3;
                if (doorway) continue;
                const frame = edgeX && edgeZ || y === GROUND + 5;
                const window = (edgeX ? z : x) % 3 !== 0;
                put(x, y, z, frame ? BlockKind.ConcreteWhite : window ? BlockKind.Glass : BlockKind.ConcreteWhite);
              }
            }
          }
          put(centerX, GROUND + 2, centerZ - halfZ, BlockKind.DoorWhite, 'south', false);
          for (let x = centerX - 4; x <= centerX + 4; x++) {
            for (let z = centerZ + 9; z <= centerZ + 14; z++) {
              put(x, GROUND, z, BlockKind.CalmWater);
              addWater(x, z);
            }
          }
          for (let x = centerX - 5; x <= centerX + 5; x++) {
            for (const z of [centerZ + 8, centerZ + 15]) put(x, GROUND, z, BlockKind.ConcreteWhite);
          }
          for (let z = centerZ + 9; z <= centerZ + 14; z++) {
            for (const x of [centerX - 5, centerX + 5]) put(x, GROUND, z, BlockKind.ConcreteWhite);
          }
          for (const side of [-1, 1]) {
            const palmX = centerX + side * 10;
            const palmZ = centerZ + 5;
            for (let y = GROUND + 1; y <= GROUND + 5; y++) put(palmX, y, palmZ, BlockKind.Wood);
            for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) <= 2) put(palmX + dx, GROUND + 6, palmZ + dz, BlockKind.Leaves);
          }
        }
        continue;
      }
      const variation = hash(bx, bz, seed);
      if (variation < 0.07) continue;
      const half = modern && variation < 0.35 ? 9 : 11;
      const floors = modern ? variation < 0.35 ? 8 + Math.floor(variation * 4) : 12 + Math.floor(variation * 8) : 3 + Math.floor(variation * 3);
      const height = GROUND + floors * 4;
      const wall = modern ? BlockKind.Glass : variation < 0.5 ? BlockKind.BeigeBrick : BlockKind.WhiteBrick;
      const accent = BlockKind.Glass;
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
            const timber = !modern && (localY % 4 === 3 || edgeX && edgeZ || ((edgeX ? z : x) - centerX + half) % 5 === 0);
            const frame = modern && (localY % 4 === 0 || ((edgeX ? z : x) - centerX + half) % 6 === 0);
            put(x, y, z, modern ? frame ? BlockKind.ConcreteGray : accent : foundation ? BlockKind.GrayBrick : timber ? BlockKind.Wood : window ? accent : wall);
          }
        }
      }
      put(centerX, GROUND + 1, centerZ - half, modern ? BlockKind.DoorWhite : BlockKind.DoorBrown, 'south', false);
      put(centerX, GROUND + 3, centerZ - half, wall);
      for (const side of [-1, 1]) for (let y = GROUND + 1; y <= GROUND + 3; y++) put(centerX + side, y, centerZ - half, wall);
      if (modern) {
        for (let x = centerX - half; x <= centerX + half; x++) {
          for (let z = centerZ - half; z <= centerZ + half; z++) put(x, height, z, accent);
        }
        const tiers = variation < 0.35 ? 1 : 3;
        for (let tier = 0; tier < tiers; tier++) {
          const radius = Math.max(2, 7 - tier * 2);
          const base = height + tier * 4;
          for (let x = centerX - radius; x <= centerX + radius; x++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
              put(x, base, z, accent);
              if (Math.abs(x - centerX) !== radius && Math.abs(z - centerZ) !== radius) continue;
              for (let y = base + 1; y <= base + 3; y++) put(x, y, z, accent);
            }
          }
        }
        for (let y = height + tiers * 4; y <= height + tiers * 4 + 5; y++) put(centerX, y, centerZ, BlockKind.IronOre);
        put(centerX, height + tiers * 4 + 6, centerZ, BlockKind.Candle);
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
  return { blocks: [...blocks.values()], water };
}
