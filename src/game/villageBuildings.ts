import { heightAt, SEA_LEVEL } from './levels';
import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';
import type { SelectedKind } from './items';

type Site = { x: number; z: number };
type HouseOffset = readonly [number, number];
export type VillageBed = { x: number; y: number; z: number };

function floorAt(x: number, z: number, seed: number) {
  return Math.max(...[-2, 0, 2].flatMap((dx) => [-2, 0, 2].map((dz) => heightAt(x + dx, z + dz, seed)))) + 1;
}

export function villageHomeBeds(site: Site, seed: number, houses: readonly HouseOffset[]): VillageBed[] {
  return houses.flatMap(([offsetX, offsetZ]) => {
    const centerX = site.x + offsetX;
    const centerZ = site.z + offsetZ;
    const y = floorAt(centerX, centerZ, seed) + 1;
    return [{ x: centerX - 1, y, z: centerZ - 1 }, { x: centerX + 1, y, z: centerZ - 1 }];
  });
}

function builder(blocks: Map<string, Voxel>) {
  return (x: number, y: number, z: number, kind: BlockKind, options: { facing?: Voxel['facing']; growth?: number; food?: SelectedKind; text?: string } = {}) => {
    blocks.set(voxelKey(x, y, z), { x, y, z, kind, ...options });
  };
}

export function smallChurchBlocks(site: Site, seed: number): Voxel[] {
  const centerX = site.x;
  const centerZ = site.z - 21;
  const floorY = floorAt(centerX, centerZ, seed);
  const blocks = new Map<string, Voxel>();
  const put = builder(blocks);
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      put(centerX + dx, floorY, centerZ + dz, BlockKind.OakPlanks);
      for (let y = floorY + 1; y <= floorY + 3; y++) {
        if (dx !== -3 && dx !== 3 && dz !== -4 && dz !== 4) continue;
        const doorway = dz === 4 && dx === 0 && y <= floorY + 2;
        if (!doorway) put(centerX + dx, y, centerZ + dz, y === floorY + 3 ? BlockKind.WhiteBrick : BlockKind.BeigeBrick);
      }
    }
  }
  put(centerX, floorY + 1, centerZ + 4, BlockKind.DoorBrown, { facing: 'north' });
  for (const dz of [-2, 1]) {
    put(centerX - 3, floorY + 2, centerZ + dz, BlockKind.GlassBlue);
    put(centerX + 3, floorY + 2, centerZ + dz, BlockKind.GlassYellow);
  }
  put(centerX, floorY + 2, centerZ - 4, BlockKind.GlassRed);
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) put(centerX + x, floorY + 1, centerZ + z, BlockKind.PinePlanks);
  }
  put(centerX, floorY + 1, centerZ - 3, BlockKind.WhiteBrick);
  put(centerX, floorY + 2, centerZ - 3, BlockKind.Candle);
  for (let layer = 0; layer <= 3; layer++) {
    for (let dx = -4 + layer; dx <= 4 - layer; dx++) {
      for (let dz = -5; dz <= 5; dz++) put(centerX + dx, floorY + 4 + layer, centerZ + dz, BlockKind.PinePlanks);
    }
  }
  for (let y = floorY + 7; y <= floorY + 9; y++) put(centerX, y, centerZ + 3, BlockKind.WhiteBrick);
  put(centerX, floorY + 7, centerZ + 2, BlockKind.GoldOre);
  put(centerX, floorY + 10, centerZ + 3, BlockKind.PinePlanks);
  put(centerX, floorY + 11, centerZ + 3, BlockKind.Wood);
  put(centerX - 1, floorY + 10, centerZ + 3, BlockKind.Wood);
  put(centerX + 1, floorY + 10, centerZ + 3, BlockKind.Wood);
  for (const side of [-1, 1]) {
    for (let y = floorY + 1; y <= floorY + 7; y++) put(centerX + side * 3, y, centerZ + 3, BlockKind.WhiteBrick);
    put(centerX + side * 3, floorY + 8, centerZ + 3, BlockKind.PinePlanks);
    put(centerX + side * 3, floorY + 9, centerZ + 3, BlockKind.Wood);
  }
  return [...blocks.values()];
}

export function restaurantBlocks(site: Site, seed: number): Voxel[] {
  const centerX = site.x + 20;
  const centerZ = site.z;
  const floorY = floorAt(centerX, centerZ, seed);
  const blocks = new Map<string, Voxel>();
  const put = builder(blocks);
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      put(centerX + dx, floorY, centerZ + dz, BlockKind.OakPlanks);
      for (let y = floorY + 1; y <= floorY + 3; y++) {
        if (dx !== -3 && dx !== 3 && dz !== -3 && dz !== 3) continue;
        const doorway = dx === -3 && dz === 0 && y <= floorY + 2;
        if (!doorway) put(centerX + dx, y, centerZ + dz, y === floorY + 3 ? BlockKind.WhiteBrick : BlockKind.OakPlanks);
      }
    }
  }
  put(centerX - 3, floorY + 1, centerZ, BlockKind.DoorBrown, { facing: 'east' });
  for (const dz of [-2, 2]) {
    put(centerX - 3, floorY + 2, centerZ + dz, BlockKind.GlassYellow);
    put(centerX + 3, floorY + 2, centerZ + dz, BlockKind.Glass);
  }
  for (let layer = 0; layer <= 2; layer++) {
    for (let dx = -4 + layer; dx <= 4 - layer; dx++) {
      for (let dz = -4; dz <= 4; dz++) put(centerX + dx, floorY + 4 + layer, centerZ + dz, BlockKind.PinePlanks);
    }
  }
  put(centerX, floorY + 1, centerZ, BlockKind.OakPlanks);
  put(centerX, floorY + 2, centerZ, BlockKind.Food, { food: 'bread' });
  put(centerX, floorY + 2, centerZ + 1, BlockKind.Food, { food: 'corn' });
  put(centerX + 1, floorY + 2, centerZ, BlockKind.Food, { food: 'cheese_slice' });
  put(centerX - 1, floorY + 1, centerZ, BlockKind.OakPlanks);
  put(centerX + 1, floorY + 1, centerZ, BlockKind.OakPlanks);
  put(centerX - 3, floorY + 2, centerZ + 1, BlockKind.Sign, { facing: 'east', text: 'Restaurant du village' });
  return [...blocks.values()];
}

export function restaurantAt(site: Site, seed: number) {
  const centerX = site.x + 20;
  return { x: centerX - 2, y: floorAt(centerX, site.z, seed) + 0.52, z: site.z };
}

export function fieldBlocks(site: Site, seed: number): Voxel[] {
  const blocks = new Map<string, Voxel>();
  const put = builder(blocks);
  const crops = [BlockKind.Wheat, BlockKind.Corn, BlockKind.Carrot] as const;
  for (let plot = 0; plot < crops.length; plot++) {
    const centerX = site.x - 22;
    const centerZ = site.z - 9 + plot * 9;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const x = centerX + dx;
        const z = centerZ + dz;
        const y = heightAt(x, z, seed);
        if (y < SEA_LEVEL) continue;
        if (dx === 0) put(x, y, z, BlockKind.Water);
        else {
          put(x, y, z, BlockKind.Dirt);
          if (dz % 2 !== 0) put(x, y + 1, z, crops[plot], { growth: 3 });
        }
      }
    }
  }
  return [...blocks.values()];
}
