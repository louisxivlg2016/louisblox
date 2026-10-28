import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';

export const CHUNK_SIZE = 16;
export const VIEW_DISTANCE = 1;
export const SEA_LEVEL = 5;
export const MIN_WORLD_Y = -64;
export const MAX_BUILD_Y = 80;

export type Biome = 'prairie' | 'forest' | 'winter' | 'desert' | 'autumn';
export type WaterTile = { x: number; z: number };
export type GeneratedChunk = { blocks: Voxel[]; water: WaterTile[] };
export type LevelData = { spawn: { x: number; y: number; z: number } };

export const BIOME_NAMES: Record<Biome, string> = {
  prairie: 'Prairie',
  forest: 'Forêt de sapins',
  winter: 'Montagnes enneigées',
  desert: 'Désert',
  autumn: 'Automne',
};

function hash(x: number, z: number, seed: number) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
}

function noise(x: number, z: number, seed: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smoothstep(x - x0);
  const tz = smoothstep(z - z0);
  const a = hash(x0, z0, seed);
  const b = hash(x0 + 1, z0, seed);
  const c = hash(x0, z0 + 1, seed);
  const d = hash(x0 + 1, z0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}

function baseBiome(cx: number, cz: number, seed: number): Biome {
  if (cx === 0 && cz === 0) return 'prairie';
  const value = hash(cx, cz, seed + 301);
  if (value < 0.5) return 'prairie';
  if (value < 0.75) return 'forest';
  if (value < 0.85) return 'autumn';
  if (value < 0.94) return 'winter';
  if (cx * cx + cz * cz < 25) return 'forest';
  return 'desert';
}

export function biomeAt(x: number, z: number, seed: number): Biome {
  if (x * x + z * z < 48 * 48) return 'prairie';
  const cx = Math.floor(x / 1024);
  const cz = Math.floor(z / 1024);
  const biome = baseBiome(cx, cz, seed);
  if (biome !== 'desert') {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if ((dx !== 0 || dz !== 0) && baseBiome(cx + dx, cz + dz, seed) === 'desert') return 'forest';
      }
    }
  }
  return biome;
}

export function heightAt(x: number, z: number, seed: number) {
  const winterWeight = biomeAt(x, z, seed) === 'winter' ? 1 : 0;
  const terrainX = winterWeight ? Math.floor(x / 2) * 2 : x;
  const terrainZ = winterWeight ? Math.floor(z / 2) * 2 : z;
  const broad = noise(terrainX / 34, terrainZ / 34, seed) * 0.66;
  const detail = noise(terrainX / 11, terrainZ / 11, seed + 19) * 0.34;
  const ridge = 1 - Math.abs(noise(terrainX / 260, terrainZ / 260, seed + 71) * 2 - 1);
  const broadBase = Math.pow(ridge, 2) * 22;
  const sharpPeak = Math.pow(ridge, 6) * 14;
  const crags = noise(terrainX / 18, terrainZ / 18, seed + 73) * 1.2 * Math.min(1, sharpPeak / 10);
  const mountain = (broadBase + sharpPeak + crags) * winterWeight;
  let height = Math.floor(2 + (broad + detail) * 8 + mountain);

  const riverDistance = Math.abs(noise(x / 82, z / 82, seed + 501) - 0.5);
  if (riverDistance < 0.045) {
    const carve = 1 - riverDistance / 0.045;
    height = Math.max(1, Math.floor(height - carve * 4));
  }

  return Math.max(1, height);
}

function stoneAt(x: number, y: number, z: number, seed: number): BlockKind {
  if (y === MIN_WORLD_Y) return BlockKind.Bedrock;
  const value = hash(x + y * 31, z - y * 17, seed + 907);
  if (y <= -24 && value > 0.992) return BlockKind.DiamondOre;
  if (y <= 0 && value > 0.985) return BlockKind.GoldOre;
  if (y <= 32 && value > 0.97) return BlockKind.IronOre;
  if (value > 0.955) return BlockKind.CoalOre;
  return BlockKind.Stone;
}

export function generateChunk(cx: number, cz: number, seed = 73421): GeneratedChunk {
  const blocks = new Map<string, Voxel>();
  const water: WaterTile[] = [];
  const minX = cx * CHUNK_SIZE;
  const minZ = cz * CHUNK_SIZE;
  const maxX = minX + CHUNK_SIZE;
  const maxZ = minZ + CHUNK_SIZE;

  const put = (x: number, y: number, z: number, kind: BlockKind, overwrite = true) => {
    if (x < minX || x >= maxX || z < minZ || z >= maxZ || y < MIN_WORLD_Y || y > MAX_BUILD_Y) return;
    const treePart = kind === BlockKind.Wood || kind === BlockKind.Leaves || kind === BlockKind.PineLeaves || kind === BlockKind.AutumnLeaves || kind === BlockKind.Apple;
    if (treePart && biomeAt(x, z, seed) === 'winter' && heightAt(x, z, seed) > 14) return;
    const key = voxelKey(x, y, z);
    if (overwrite || !blocks.has(key)) blocks.set(key, { x, y, z, kind });
  };

  for (let x = minX; x < maxX; x += 1) {
    for (let z = minZ; z < maxZ; z += 1) {
      const height = heightAt(x, z, seed);
      const biome = biomeAt(x, z, seed);
      const beach = height < SEA_LEVEL;

      for (let y = MIN_WORLD_Y; y <= height; y += 1) {
        let kind: BlockKind = stoneAt(x, y, z, seed);
        if (y === height) {
          if (beach || biome === 'desert') kind = BlockKind.Sand;
          else if (biome === 'winter') kind = BlockKind.Snow;
          else if (biome === 'autumn') kind = BlockKind.AutumnGrass;
          else if (biome === 'forest') kind = BlockKind.ForestGrass;
          else kind = BlockKind.Grass;
        } else if (y >= height - 3) {
          if (biome === 'winter' && height > 14) kind = BlockKind.Stone;
          else kind = biome === 'desert' || beach ? BlockKind.Sand : BlockKind.Dirt;
        }
        put(x, y, z, kind);
      }

      if (height < SEA_LEVEL) {
        water.push({ x, z });
        if (biome === 'winter') put(x, SEA_LEVEL, z, BlockKind.Ice);
      }
    }
  }

  for (let x = minX - 3; x < maxX + 3; x += 1) {
    for (let z = minZ - 3; z < maxZ + 3; z += 1) {
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
      const height = heightAt(x, z, seed);
      if (height <= SEA_LEVEL + 1) continue;
      const biome = biomeAt(x, z, seed);
      const chance = hash(x, z, seed + 91);
      if (biome === 'winter' && height > 14) continue;

      if (biome === 'desert') {
        if (chance > 0.993) {
          const cactusHeight = 2 + Math.floor(hash(x, z, seed + 17) * 2);
          for (let y = 1; y <= cactusHeight; y += 1) put(x, height + y, z, BlockKind.Cactus, false);
        }
        continue;
      }

      const isPine = biome === 'forest' || biome === 'winter';
      const threshold = biome === 'prairie' ? 0.991 : biome === 'autumn' ? 0.975 : 0.925;
      if (chance < threshold) continue;

      if (!isPine) {
        const trunkHeight = 5 + Math.floor(hash(x, z, seed + 37) * 2);
        for (let y = 1; y <= trunkHeight; y += 1) put(x, height + y, z, BlockKind.Wood);
        const crownY = height + trunkHeight;
        const leafKind = biome === 'autumn' ? BlockKind.AutumnLeaves : BlockKind.Leaves;
        for (let ox = -2; ox <= 2; ox += 1) {
          for (let oz = -2; oz <= 2; oz += 1) {
            for (let oy = -1; oy <= 1; oy += 1) {
              if (Math.abs(ox) + Math.abs(oz) + Math.abs(oy) > 4) continue;
              put(x + ox, crownY + oy, z + oz, leafKind, false);
              if (biome === 'prairie' && hash(x + ox, z + oz, seed + crownY + oy) > 0.88) {
                put(x + ox, crownY + oy, z + oz, BlockKind.Apple);
              }
            }
          }
        }
        put(x, crownY + 2, z, leafKind, false);
        continue;
      }

      const trunkHeight = 8 + Math.floor(hash(x, z, seed + 37) * 4);
      for (let y = 1; y <= trunkHeight; y += 1) put(x, height + y, z, BlockKind.Wood);
      for (let dy = 5; dy <= trunkHeight + 1; dy += 1) {
        const remaining = trunkHeight + 1 - dy;
        let radius = Math.min(3, Math.floor((remaining + 1) / 2));
        if (dy % 2 === 0) radius = Math.max(0, radius - 1);

        for (let ox = -radius; ox <= radius; ox += 1) {
          for (let oz = -radius; oz <= radius; oz += 1) {
            const distance = Math.abs(ox) + Math.abs(oz);
            if (distance === 0 || distance > radius + (radius > 1 ? 1 : 0)) continue;
            if (radius > 1 && distance < radius && hash(x + ox, z + oz, seed + dy) < 0.65) continue;
            put(x + ox, height + dy, z + oz, BlockKind.PineLeaves, false);
            if (biome === 'winter' && dy % 2 === 1 && hash(x + ox, z + oz, seed + dy + 19) > 0.45) {
              put(x + ox, height + dy + 1, z + oz, BlockKind.Snow, false);
            }
          }
        }
      }
      put(x, height + trunkHeight + 1, z, BlockKind.PineLeaves, false);
      if (biome === 'winter') put(x, height + trunkHeight + 2, z, BlockKind.Snow, false);
    }
  }

  return { blocks: [...blocks.values()], water };
}
