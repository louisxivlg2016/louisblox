import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

export const PLANET_SPAWN = { x: 0, y: 14.51, z: 1.5 };
export const PLANET_ONE_BLOCK = { x: 0, y: 14, z: 0 };
export const PLANET_BIOMES = [
  { id: 'ice' as const, name: 'Planète de glace', x: 28, y: 10, z: 0, radius: 5 },
  { id: 'lava' as const, name: 'Planète de lave', x: -28, y: 12, z: 0, radius: 5 },
  { id: 'jungle' as const, name: 'Planète de jungle', x: 0, y: 11, z: 28, radius: 5 },
  { id: 'candy' as const, name: 'Planète de bonbons', x: 0, y: 13, z: -28, radius: 5 },
];

function put(blocks: Voxel[], cx: number, cz: number, x: number, y: number, z: number, kind: BlockKind, protectedBlock = false) {
  if (Math.floor(x / CHUNK_SIZE) !== cx || Math.floor(z / CHUNK_SIZE) !== cz) return;
  blocks.push({ x, y, z, kind, ...(protectedBlock ? { protected: true } : {}) });
}

function planet(blocks: Voxel[], cx: number, cz: number, center: { x: number; y: number; z: number; radius: number }, surface: BlockKind, subsurface: BlockKind) {
  for (let dx = -center.radius; dx <= center.radius; dx += 1) for (let dz = -center.radius; dz <= center.radius; dz += 1) for (let dy = -center.radius; dy <= center.radius; dy += 1) {
    const distance = dx * dx + dz * dz + dy * dy;
    if (distance > center.radius * center.radius) continue;
    const shell = distance >= (center.radius - 1) * (center.radius - 1);
    put(blocks, cx, cz, center.x + dx, center.y + dy, center.z + dz, shell ? surface : subsurface, !shell);
  }
}

export function generatePlanetChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  planet(blocks, cx, cz, { x: 0, y: 7, z: 0, radius: 6 }, BlockKind.Grass, BlockKind.Stone);
  put(blocks, cx, cz, PLANET_ONE_BLOCK.x, PLANET_ONE_BLOCK.y, PLANET_ONE_BLOCK.z, BlockKind.Stone);
  for (const biome of PLANET_BIOMES) {
    const surface = biome.id === 'ice' ? BlockKind.Snow : biome.id === 'lava' ? BlockKind.ConcreteOrange : biome.id === 'jungle' ? BlockKind.JungleGrass : BlockKind.ConcretePink;
    const subsurface = biome.id === 'ice' ? BlockKind.Ice : biome.id === 'lava' ? BlockKind.ConcreteRed : biome.id === 'jungle' ? BlockKind.Dirt : BlockKind.ConcreteMagenta;
    planet(blocks, cx, cz, biome, surface, subsurface);
    if (biome.id === 'ice') {
      put(blocks, cx, cz, biome.x + 2, biome.y + 1, biome.z, BlockKind.DiamondOre);
      put(blocks, cx, cz, biome.x - 2, biome.y + 1, biome.z + 1, BlockKind.Ice);
    } else if (biome.id === 'lava') {
      put(blocks, cx, cz, biome.x, biome.y + 1, biome.z, BlockKind.GoldOre);
      put(blocks, cx, cz, biome.x + 2, biome.y + 1, biome.z - 1, BlockKind.Candle);
    } else if (biome.id === 'jungle') {
      for (let y = biome.y + 1; y <= biome.y + 5; y += 1) put(blocks, cx, cz, biome.x, y, biome.z, BlockKind.Wood, true);
      for (let x = biome.x - 2; x <= biome.x + 2; x += 1) for (let z = biome.z - 2; z <= biome.z + 2; z += 1) put(blocks, cx, cz, x, biome.y + 6, z, BlockKind.JungleLeaves, true);
      put(blocks, cx, cz, biome.x + 2, biome.y + 1, biome.z + 1, BlockKind.IronOre);
    } else {
      for (let y = biome.y + 1; y <= biome.y + 4; y += 1) put(blocks, cx, cz, biome.x, y, biome.z, y % 2 === 0 ? BlockKind.ConcreteWhite : BlockKind.ConcreteRed, true);
      put(blocks, cx, cz, biome.x + 2, biome.y + 1, biome.z, BlockKind.DiamondOre);
    }
  }
  return { blocks, water: [] };
}
