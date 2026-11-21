import { heightAt, SEA_LEVEL } from './levels';
import { writeVillageChurch } from './constructionTemplates';
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
  const blocks = new Map<string, Voxel>();
  writeVillageChurch(builder(blocks), centerX, floorAt(centerX, centerZ, seed) - 1, centerZ);
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
  put(centerX - 3, floorY + 2, centerZ, BlockKind.OakPlanks);
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
  put(centerX - 3, floorY + 2, centerZ + 1, BlockKind.Sign, { facing: 'east', text: 'Village restaurant' });
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
