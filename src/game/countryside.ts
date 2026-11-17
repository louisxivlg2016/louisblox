import type { Entity, World } from 'koota';
import { spawnAnimal } from './animals';
import { AnimalPosition } from './traits';
import { BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';
import type { GeneratedChunk } from './levels';

const GROUND = 5;
const SPACING = 384;
const NAMES = ['Saint-Rémy', 'Clairval', 'Belleplaine', 'Rivière-au-Blé', 'Montjoie', 'Val-des-Chênes', 'Fleurive', 'Champdoré'];
const HOUSE_OFFSETS = [[-18, -18], [0, -18], [18, -18], [-18, 0], [18, 0], [-18, 18], [0, 18], [18, 18], [-32, -12], [-32, 12]] as const;

type VillageSite = { x: number; z: number; name: string; houses: number; radius: number };

function hash(x: number, z: number, seed: number) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function highwayBlock(offset: number, along: number) {
  const lane = Math.abs(offset);
  if (lane === 4) return BlockKind.Dirt;
  if (lane === 0) return ((along % 8) + 8) % 8 < 4 ? BlockKind.ConcreteWhite : BlockKind.ConcreteBlack;
  return lane === 2 ? BlockKind.ConcreteBlack : BlockKind.ConcreteGray;
}

function siteAt(cellX: number, cellZ: number, seed: number): VillageSite {
  const x = cellX * SPACING + 1000;
  const z = cellZ * SPACING + 32;
  const distance = Math.hypot(x, z);
  const houses = distance < 1400 ? 10 : distance < 2400 ? 6 : 4;
  return { x, z, houses, radius: houses === 10 ? 62 : 48, name: `${NAMES[Math.floor(hash(cellX, cellZ, seed + 70) * NAMES.length)]}${distance < 1400 ? ' · Grand village' : distance < 2400 ? ' · Village' : ' · Hameau'}` };
}

function sitesNear(cx: number, cz: number, seed: number) {
  const sites: VillageSite[] = [];
  for (let cellX = Math.floor(cx * 16 / SPACING) - 2; cellX <= Math.floor((cx * 16 + 15) / SPACING) + 2; cellX += 1) {
    for (let cellZ = Math.floor(cz * 16 / SPACING) - 2; cellZ <= Math.floor((cz * 16 + 15) / SPACING) + 2; cellZ += 1) {
      const site = siteAt(cellX, cellZ, seed);
      if (site.x + site.radius >= cx * 16 && site.x - site.radius < (cx + 1) * 16 && site.z + site.radius >= cz * 16 && site.z - site.radius < (cz + 1) * 16) sites.push(site);
    }
  }
  return sites;
}

export function generateCountrysideChunk(cx: number, cz: number, seed: number): GeneratedChunk {
  const blocks = new Map<string, Voxel>();
  const water: Array<{ x: number; z: number }> = [];
  const sites = sitesNear(cx, cz, seed);
  const put = (x: number, y: number, z: number, kind: BlockKind, options: Pick<Voxel, 'facing' | 'growth' | 'text'> = {}) => {
    if (x < cx * 16 || x >= (cx + 1) * 16 || z < cz * 16 || z >= (cz + 1) * 16) return;
    blocks.set(voxelKey(x, y, z), { x, y, z, kind, ...options });
    if (kind === BlockKind.CalmWater || kind === BlockKind.Water) water.push({ x, z });
  };
  for (let x = cx * 16; x < (cx + 1) * 16; x += 1) {
    for (let z = cz * 16; z < (cz + 1) * 16; z += 1) {
      const forest = hash(Math.floor(x / 64), Math.floor(z / 64), seed + 11) > 0.55;
      for (let y = 0; y <= GROUND; y += 1) put(x, y, z, y === 0 ? BlockKind.Bedrock : y === GROUND ? forest ? BlockKind.ForestGrass : BlockKind.Grass : y >= GROUND - 1 ? BlockKind.Dirt : BlockKind.Stone);
      const nearVillage = sites.some((site) => Math.hypot(site.x - x, site.z - z) < site.radius + 12);
      if (forest && !nearVillage && Math.abs(z) > 3 && hash(x, z, seed + 21) > 0.88) {
        for (let y = GROUND + 1; y <= GROUND + 4; y += 1) put(x, y, z, BlockKind.Wood);
        for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) for (let dy = 0; dy <= 1; dy += 1) {
          if (Math.abs(dx) + Math.abs(dz) + dy <= 3) put(x + dx, GROUND + 5 + dy, z + dz, BlockKind.Leaves);
        }
        put(x, GROUND + 7, z, BlockKind.Leaves);
      }
    }
  }
  for (let x = cx * 16; x < (cx + 1) * 16; x += 1) {
    for (let z = -4; z <= 4; z += 1) put(x, GROUND, z, highwayBlock(z, x));
  }
  for (let z = cz * 16; z < (cz + 1) * 16; z += 1) {
    for (let x = -4; x <= 4; x += 1) put(x, GROUND, z, highwayBlock(x, z));
  }
  for (const corridor of [-1536, -1152, -768, -384, 384, 768, 1152, 1536]) {
    for (let z = cz * 16; z < (cz + 1) * 16; z += 1) for (let x = corridor - 4; x <= corridor + 4; x += 1) put(x, GROUND, z, highwayBlock(x - corridor, z));
    for (let x = cx * 16; x < (cx + 1) * 16; x += 1) for (let z = corridor - 4; z <= corridor + 4; z += 1) put(x, GROUND, z, highwayBlock(z - corridor, x));
  }
  for (const marker of [-1536, -1152, -768, -384, 384, 768, 1152, 1536]) {
    if (marker < cx * 16 || marker >= (cx + 1) * 16) continue;
    blocks.set(voxelKey(marker, GROUND + 1, 3), { x: marker, y: GROUND + 1, z: 3, kind: BlockKind.Wood });
    blocks.set(voxelKey(marker, GROUND + 2, 3), { x: marker, y: GROUND + 2, z: 3, kind: BlockKind.Sign, text: 'Civilisation · Route des villages' });
  }
  for (const site of sites) {
    const pathKind = site.houses === 10 ? BlockKind.ConcreteGray : BlockKind.Dirt;
    for (let x = site.x - 2; x <= site.x + 2; x += 1) {
      for (let z = Math.min(0, site.z); z <= Math.max(0, site.z); z += 1) put(x, GROUND, z, pathKind);
    }
    for (let offset = -28; offset <= 28; offset += 1) {
      for (let side = -1; side <= 1; side += 1) {
        put(site.x + offset, GROUND, site.z + side, pathKind);
        put(site.x + side, GROUND, site.z + offset, pathKind);
      }
    }
    for (const [offsetX, offsetZ] of HOUSE_OFFSETS.slice(0, site.houses)) {
      const centerX = site.x + offsetX;
      const centerZ = site.z + offsetZ;
      for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
        put(centerX + dx, GROUND + 1, centerZ + dz, BlockKind.OakPlanks);
        for (let y = GROUND + 2; y <= GROUND + 4; y += 1) {
          const edge = dx === -2 || dx === 2 || dz === -2 || dz === 2;
          const doorway = dz === 2 && dx === 0 && y <= GROUND + 3;
          if (edge && !doorway) put(centerX + dx, y, centerZ + dz, BlockKind.BeigeBrick);
        }
        for (let layer = 0; layer < 3; layer += 1) if (Math.abs(dx) <= 2 - layer) put(centerX + dx, GROUND + 5 + layer, centerZ + dz, BlockKind.PinePlanks);
      }
      put(centerX, GROUND + 2, centerZ + 2, BlockKind.DoorBrown, { facing: 'north' });
      for (const side of [-1, 1]) {
        put(centerX + side * 2, GROUND + 3, centerZ, BlockKind.Glass);
        put(centerX + side, GROUND + 3, centerZ - 2, BlockKind.Glass);
      }
      put(centerX - 1, GROUND + 2, centerZ - 1, BlockKind.Bed, { facing: 'south' });
      put(centerX + 1, GROUND + 2, centerZ, BlockKind.Chest);
    }
    put(site.x - 30, GROUND + 1, 3, BlockKind.Wood);
    put(site.x - 30, GROUND + 2, 3, BlockKind.Wood);
    put(site.x - 30, GROUND + 3, 3, BlockKind.Sign, { facing: 'north', text: site.name });
    put(site.x + 4, GROUND + 1, site.z + 4, BlockKind.Wood);
    put(site.x + 4, GROUND + 2, site.z + 4, BlockKind.Sign, { facing: 'north', text: `Civilisation · ${site.name}` });
    for (const offset of [-18, 0, 18]) {
      put(site.x + offset, GROUND + 1, site.z + 4, BlockKind.StreetLamp);
      put(site.x + offset, GROUND + 1, site.z - 4, BlockKind.StreetLamp);
    }

    const barnX = site.x - 43;
    const barnZ = site.z + 23;
    for (let dx = -4; dx <= 4; dx += 1) for (let dz = -3; dz <= 3; dz += 1) {
      put(barnX + dx, GROUND + 1, barnZ + dz, BlockKind.OakPlanks);
      for (let y = GROUND + 2; y <= GROUND + 5; y += 1) {
        const edge = dx === -4 || dx === 4 || dz === -3 || dz === 3;
        const doorway = dz === 3 && Math.abs(dx) <= 1 && y <= GROUND + 4;
        if (edge && !doorway) put(barnX + dx, y, barnZ + dz, BlockKind.ConcreteRed);
      }
      for (let layer = 0; layer < 3; layer += 1) if (Math.abs(dx) <= 4 - layer) put(barnX + dx, GROUND + 6 + layer, barnZ + dz, BlockKind.PinePlanks);
    }
    for (const dx of [-1, 0, 1]) put(barnX + dx, GROUND + 2, barnZ + 3, BlockKind.DoorBrown, { facing: 'north' });
    for (const side of [-1, 1]) put(barnX + side * 4, GROUND + 4, barnZ, BlockKind.Glass);

    const fields = [
      { x: site.x + 41, z: site.z - 18 },
      ...(site.houses === 10 ? [{ x: site.x - 8, z: site.z + 45 }, { x: site.x + 41, z: site.z + 45 }] : []),
    ];
    for (const field of fields) {
      const fieldX = field.x;
      const fieldZ = field.z;
      for (let dx = -10; dx <= 10; dx += 1) for (let dz = -8; dz <= 8; dz += 1) {
      const border = Math.abs(dx) === 10 || Math.abs(dz) === 8;
      if (border) {
        if ((dx + dz) % 2 === 0) put(fieldX + dx, GROUND + 1, fieldZ + dz, BlockKind.OakPlanks);
        continue;
      }
      if (dx % 5 === 0) put(fieldX + dx, GROUND, fieldZ + dz, BlockKind.CalmWater);
      else {
        put(fieldX + dx, GROUND, fieldZ + dz, BlockKind.Dirt);
        if (dz % 2 === 0) put(fieldX + dx, GROUND + 1, fieldZ + dz, BlockKind.Wheat, { growth: 3 });
      }
    }
    }
    for (const offset of [-5, 5]) put(fields[0].x + offset, GROUND + 1, fields[0].z + 9, BlockKind.StreetLamp);
  }
  return { blocks: [...blocks.values()], water };
}

export function spawnCountrysideAnimals(world: World, cx: number, cz: number, seed: number) {
  const entities: Entity[] = [];
  const sites = sitesNear(cx, cz, seed);
  for (const site of sites) {
    const animals = [['sheep', 55, -4], ['sheep', 58, 2], ['cow', 54, 8], ['cow', 59, 12], ['horse', 51, 17], ['horse', 56, 22]] as const;
    for (const [kind, offsetX, offsetZ] of animals) {
      const x = site.x + offsetX;
      const z = site.z + offsetZ;
      if (x < cx * 16 || x >= (cx + 1) * 16 || z < cz * 16 || z >= (cz + 1) * 16) continue;
      const animal = spawnAnimal(world, kind, x, GROUND + 0.5, z, seed);
      if (animal) {
        animal.get(AnimalPosition)!.set(x, GROUND + 0.5, z);
        entities.push(animal);
      }
    }
  }
  if (sites.length === 0 && hash(cx, cz, seed + 90) > 0.62) {
    const x = cx * 16 + 8;
    const z = cz * 16 + 8;
    const kind = hash(cx, cz, seed + 91) > 0.66 ? 'horse' : hash(cx, cz, seed + 92) > 0.5 ? 'cow' : 'sheep';
    const animal = spawnAnimal(world, kind, x, GROUND + 0.5, z, seed);
    if (animal) {
      animal.get(AnimalPosition)!.set(x, GROUND + 0.5, z);
      entities.push(animal);
    }
  }
  return entities;
}
