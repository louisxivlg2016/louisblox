import type { Vector3 } from 'three';
import { EXTRA_BLOCKS, EXTRA_BLOCK_META, EXTRA_BLOCK_ORDER, isDoor, isTrapdoor } from './extraBlocks';

export const BlockKind = {
  Grass: 0,
  Dirt: 1,
  Stone: 2,
  Sand: 3,
  Wood: 4,
  Leaves: 5,
  Snow: 6,
  Cactus: 7,
  PineLeaves: 8,
  Apple: 9,
  AutumnLeaves: 10,
  AutumnGrass: 11,
  ForestGrass: 12,
  CoalOre: 13,
  IronOre: 14,
  GoldOre: 15,
  DiamondOre: 16,
  Bedrock: 17,
  Ice: 18,
  Tnt: 19,
  Candle: 20,
  ...EXTRA_BLOCKS,
  Water: 47,
} as const;

export type BlockKind = (typeof BlockKind)[keyof typeof BlockKind];

export type Voxel = {
  x: number;
  y: number;
  z: number;
  kind: BlockKind;
  open?: boolean;
  growth?: number;
  items?: import('./items').SelectedKind[];
  text?: string;
  facing?: 'north' | 'south' | 'east' | 'west';
};

export type VoxelHit = {
  block: Voxel;
  x: number;
  y: number;
  z: number;
  normal: { x: number; y: number; z: number };
  distance: number;
};

export const HOTBAR_BLOCKS = [
  BlockKind.Grass,
  BlockKind.Dirt,
  BlockKind.Stone,
  BlockKind.Sand,
  BlockKind.Wood,
  BlockKind.Leaves,
  BlockKind.Snow,
  BlockKind.Cactus,
  BlockKind.CoalOre,
  BlockKind.IronOre,
  BlockKind.GoldOre,
  BlockKind.DiamondOre,
  BlockKind.Tnt,
  BlockKind.Candle,
  ...EXTRA_BLOCK_ORDER,
  BlockKind.Water,
] as const;

const baseBlockInfo = {
  [BlockKind.Grass]: { name: 'Herbe', color: '#69a947' },
  [BlockKind.Dirt]: { name: 'Terre', color: '#8b5e3c' },
  [BlockKind.Stone]: { name: 'Pierre', color: '#858585' },
  [BlockKind.Sand]: { name: 'Sable', color: '#dfcf8a' },
  [BlockKind.Wood]: { name: 'Bois', color: '#8b633c' },
  [BlockKind.Leaves]: { name: 'Feuilles', color: '#3f823c' },
  [BlockKind.PineLeaves]: { name: 'Aiguilles de sapin', color: '#2d5b40' },
  [BlockKind.Snow]: { name: 'Neige', color: '#edf5f7' },
  [BlockKind.Cactus]: { name: 'Cactus', color: '#397443' },
  [BlockKind.Apple]: { name: 'Pomme', color: '#c83b32' },
  [BlockKind.AutumnLeaves]: { name: 'Feuilles d’automne', color: '#d8752f' },
  [BlockKind.AutumnGrass]: { name: 'Herbe dorée', color: '#c8a44e' },
  [BlockKind.ForestGrass]: { name: 'Herbe forestière', color: '#386c36' },
  [BlockKind.CoalOre]: { name: 'Charbon', color: '#424242' },
  [BlockKind.IronOre]: { name: 'Fer', color: '#b88b6a' },
  [BlockKind.GoldOre]: { name: 'Or', color: '#e3bd32' },
  [BlockKind.DiamondOre]: { name: 'Diamant', color: '#45c8cf' },
  [BlockKind.Bedrock]: { name: 'Bedrock', color: '#2d2d2d' },
  [BlockKind.Ice]: { name: 'Glace', color: '#a8d5e2' },
  [BlockKind.Tnt]: { name: 'Bombe TNT', color: '#c93d32' },
  [BlockKind.Candle]: { name: 'Bougie', color: '#f2d68a' },
  [BlockKind.Water]: { name: 'Eau', color: '#3b9bd5' },
};

const baseBlockHardness = {
  [BlockKind.Grass]: 0.55,
  [BlockKind.Dirt]: 0.6,
  [BlockKind.Stone]: 2.5,
  [BlockKind.Sand]: 0.5,
  [BlockKind.Wood]: 1.8,
  [BlockKind.Leaves]: 0.35,
  [BlockKind.PineLeaves]: 0.4,
  [BlockKind.Snow]: 0.25,
  [BlockKind.Cactus]: 0.65,
  [BlockKind.Apple]: 0.2,
  [BlockKind.AutumnLeaves]: 0.35,
  [BlockKind.AutumnGrass]: 0.6,
  [BlockKind.ForestGrass]: 0.65,
  [BlockKind.CoalOre]: 4,
  [BlockKind.IronOre]: 6,
  [BlockKind.GoldOre]: 7,
  [BlockKind.DiamondOre]: 10,
  [BlockKind.Bedrock]: 30,
  [BlockKind.Ice]: 1.5,
  [BlockKind.Tnt]: 0.8,
  [BlockKind.Candle]: 0.4,
  [BlockKind.Water]: 0.1,
};

export const BLOCK_INFO = {
  ...baseBlockInfo,
  ...Object.fromEntries(Object.entries(EXTRA_BLOCK_META).map(([kind, meta]) => [kind, { name: meta.name, color: meta.color }])),
} as Record<BlockKind, { name: string; color: string }>;

export const BLOCK_HARDNESS = {
  ...baseBlockHardness,
  ...Object.fromEntries(Object.entries(EXTRA_BLOCK_META).map(([kind, meta]) => [kind, meta.hardness])),
} as Record<BlockKind, number>;

export const voxelKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function raycastVoxel(
  blocks: Map<string, Voxel>,
  origin: Vector3,
  direction: Vector3,
  maxDistance = 6,
): VoxelHit | null {
  let x = Math.floor(origin.x + 0.5);
  let y = Math.floor(origin.y + 0.5);
  let z = Math.floor(origin.z + 0.5);

  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);
  const deltaX = stepX === 0 ? Infinity : Math.abs(1 / direction.x);
  const deltaY = stepY === 0 ? Infinity : Math.abs(1 / direction.y);
  const deltaZ = stepZ === 0 ? Infinity : Math.abs(1 / direction.z);
  let maxX = stepX === 0 ? Infinity : (x + stepX * 0.5 - origin.x) / direction.x;
  let maxY = stepY === 0 ? Infinity : (y + stepY * 0.5 - origin.y) / direction.y;
  let maxZ = stepZ === 0 ? Infinity : (z + stepZ * 0.5 - origin.z) / direction.z;
  let distance = 0;
  let normal = { x: 0, y: 0, z: 0 };

  for (let steps = 0; steps < 128 && distance <= maxDistance; steps += 1) {
    const block = blocks.get(voxelKey(x, y, z));
    if (block !== undefined && block.kind !== BlockKind.Water && (!block.open || isDoor(block.kind) || isTrapdoor(block.kind))) {
      return { block, x, y, z, normal, distance };
    }

    if (maxX <= maxY && maxX <= maxZ) {
      x += stepX;
      distance = maxX;
      maxX += deltaX;
      normal = { x: -stepX, y: 0, z: 0 };
    } else if (maxY <= maxZ) {
      y += stepY;
      distance = maxY;
      maxY += deltaY;
      normal = { x: 0, y: -stepY, z: 0 };
    } else {
      z += stepZ;
      distance = maxZ;
      maxZ += deltaZ;
      normal = { x: 0, y: 0, z: -stepZ };
    }
  }

  return null;
}
