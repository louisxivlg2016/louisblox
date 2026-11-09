import type { World } from 'koota';
import { Vector3 } from 'three';
import { biomeAt, heightAt, safeSpawnAt, SEA_LEVEL } from './levels';
import { isInAnyRuinFootprint } from './ruins';
import { Trader, TraderMesh, TraderPosition } from './traits';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

const HOUSE_OFFSETS = [[-5, -4], [5, -4], [-5, 5], [5, 5]] as const;
const CITY_HOUSE_OFFSETS = [[-12, -12], [12, -12], [-12, 12], [12, 12], [-12, -4], [12, -4], [-12, 4], [12, 4]] as const;
const CITY_RESIDENT_OFFSETS = [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const;

function hash(x: number, z: number, seed: number) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

const villageSites = new Map<string, { x: number; z: number } | null>();
const villageBlockCache = new Map<string, Voxel[]>();

function findVillageSite(cx: number, cz: number, seed: number) {
  const first = cx >= 0 && cx <= 2 && cz >= -1 && cz <= 0;
  const cellX = first ? 0 : Math.floor(cx / 12);
  const cellZ = first ? -1 : Math.floor(cz / 12);
  if (!first && hash(cellX, cellZ, seed + 1700) < 0.5) return null;
  const x = first ? 28 : cellX * 192 + 96;
  const z = first ? -6 : cellZ * 192 + 96;
  if (biomeAt(x, z, seed) !== 'prairie') return null;
  const site = safeSpawnAt(x, z, seed, 'prairie');
  if (!site.onLand || Math.floor(site.x / 192) !== cellX || Math.floor(site.z / 192) !== cellZ || isInAnyRuinFootprint(site.x, site.z, seed)) return null;
  return { x: site.x, z: site.z };
}

export function villageAt(cx: number, cz: number, seed: number) {
  const key = `${cx},${cz},${seed}`;
  if (villageSites.has(key)) return villageSites.get(key)!;
  const site = findVillageSite(cx, cz, seed);
  if (villageSites.size > 256) villageSites.delete(villageSites.keys().next().value!);
  villageSites.set(key, site);
  return site;
}

const tradeCitySites = new Map<number, { x: number; z: number }>();

export function tradeCityAt(seed: number) {
  const cached = tradeCitySites.get(seed);
  if (cached) return cached;
  for (let radius = 5; radius <= 32; radius += 1) {
    let best: { x: number; z: number; score: number } | null = null;
    for (let cellX = -radius; cellX <= radius; cellX += 1) {
      for (let cellZ = -radius; cellZ <= radius; cellZ += 1) {
        if (Math.max(Math.abs(cellX), Math.abs(cellZ)) !== radius) continue;
        const x = cellX * 192 + 96;
        const z = cellZ * 192 + 96;
        const site = villageAt(Math.floor(x / 16), Math.floor(z / 16), seed);
        if (!site) continue;
        const distance = Math.hypot(site.x, site.z);
        if (distance < 700) continue;
        const score = Math.abs(distance - 960);
        if (!best || score < best.score) best = { ...site, score };
      }
    }
    if (best) {
      const site = { x: best.x, z: best.z };
      tradeCitySites.set(seed, site);
      return site;
    }
  }
  const fallback = safeSpawnAt(960, 0, seed, 'prairie');
  const site = { x: fallback.x, z: fallback.z };
  tradeCitySites.set(seed, site);
  return site;
}

function isTradeCity(site: { x: number; z: number }, seed: number) {
  const city = tradeCityAt(seed);
  return site.x === city.x && site.z === city.z;
}

function villageSiteForChunk(cx: number, cz: number, seed: number) {
  const natural = villageAt(cx, cz, seed);
  if (natural) return natural;
  const city = tradeCityAt(seed);
  return city.x >= cx * 16 && city.x < (cx + 1) * 16 && city.z >= cz * 16 && city.z < (cz + 1) * 16 ? city : null;
}

export function generateVillageBlocks(cx: number, cz: number, seed: number): Voxel[] {
  const cacheKey = `${cx},${cz},${seed}`;
  const cached = villageBlockCache.get(cacheKey);
  if (cached) return cached;
  const site = villageSiteForChunk(cx, cz, seed);
  if (!site) return [];
  const city = isTradeCity(site, seed);
  const houses = city ? [...HOUSE_OFFSETS, ...CITY_HOUSE_OFFSETS] : HOUSE_OFFSETS;
  const blocks: Voxel[] = [];
  const put = (x: number, y: number, z: number, kind: BlockKind) => {
    if (x < cx * 16 || x >= (cx + 1) * 16 || z < cz * 16 || z >= (cz + 1) * 16) return;
    blocks.push({ x, y, z, kind });
  };
  for (const [offsetX, offsetZ] of houses) {
    const centerX = site.x + offsetX;
    const centerZ = site.z + offsetZ;
    if (heightAt(centerX, centerZ, seed) < SEA_LEVEL) continue;
    const base = Math.max(...[-2, 0, 2].flatMap((dx) => [-2, 0, 2].map((dz) => heightAt(centerX + dx, centerZ + dz, seed))));
    const floorY = base + 1;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let y = heightAt(centerX + dx, centerZ + dz, seed) + 1; y <= floorY; y++) put(centerX + dx, y, centerZ + dz, BlockKind.OakPlanks);
        for (let y = floorY + 1; y <= floorY + 3; y++) {
          if (dx === -2 || dx === 2 || dz === -2 || dz === 2) {
            const doorway = dz === 2 && dx === 0 && y <= floorY + 2;
            if (!doorway) put(centerX + dx, y, centerZ + dz, dx === -2 || dx === 2 ? BlockKind.Wood : BlockKind.OakPlanks);
          }
        }
        if (dz === 0 && (dx === -2 || dx === 2) || dz === -2 && dx === 0) put(centerX + dx, floorY + 2, centerZ + dz, BlockKind.Glass);
      }
    }
    for (let layer = 0; layer <= 2; layer++) {
      for (let dx = -2 + layer; dx <= 2 - layer; dx++) {
        for (let dz = -3; dz <= 3; dz++) put(centerX + dx, floorY + 4 + layer, centerZ + dz, BlockKind.PinePlanks);
      }
    }
    put(centerX - 1, floorY + 1, centerZ - 1, BlockKind.Bed);
    put(centerX + 1, floorY + 1, centerZ - 1, BlockKind.Chest);
  }
  const pathRadius = city ? 15 : 8;
  for (let offset = -pathRadius; offset <= pathRadius; offset++) {
    for (const side of [-1, 0, 1]) {
      const x = site.x + offset;
      const z = site.z + side;
      if (heightAt(x, z, seed) > SEA_LEVEL) put(x, heightAt(x, z, seed), z, BlockKind.OakPlanks);
      const otherX = site.x + side;
      const otherZ = site.z + offset;
      if (heightAt(otherX, otherZ, seed) > SEA_LEVEL) put(otherX, heightAt(otherX, otherZ, seed), otherZ, BlockKind.OakPlanks);
    }
  }
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const y = heightAt(site.x + dx, site.z + dz, seed) + 1;
      put(site.x + dx, y, site.z + dz, dx === 0 && dz === 0 ? BlockKind.Water : BlockKind.Stone);
    }
  }
  const lampOffset = city ? 14 : 7;
  put(site.x - lampOffset, heightAt(site.x - lampOffset, site.z, seed) + 1, site.z, BlockKind.StreetLamp);
  put(site.x + lampOffset, heightAt(site.x + lampOffset, site.z, seed) + 1, site.z, BlockKind.StreetLamp);
  if (villageBlockCache.size > 64) villageBlockCache.delete(villageBlockCache.keys().next().value!);
  villageBlockCache.set(cacheKey, blocks);
  return blocks;
}

export function spawnVillageResidents(world: World, cx: number, cz: number, seed: number) {
  const site = villageSiteForChunk(cx, cz, seed);
  if (!site) return [];
  const city = isTradeCity(site, seed);
  const houses = city ? [...HOUSE_OFFSETS, ...CITY_HOUSE_OFFSETS] : HOUSE_OFFSETS;
  const positions = houses.map(([offsetX, offsetZ]) => ({ x: site.x + offsetX, z: site.z + offsetZ + 3 }));
  if (city) positions.push(...CITY_RESIDENT_OFFSETS.map(([offsetX, offsetZ]) => ({ x: site.x + offsetX, z: site.z + offsetZ })));
  const residents = [];
  for (const { x, z } of positions) {
    if (heightAt(x, z, seed) < SEA_LEVEL) continue;
    if (x < cx * 16 || x >= (cx + 1) * 16 || z < cz * 16 || z >= (cz + 1) * 16) continue;
    residents.push(world.spawn(
      Trader({ homeX: x, homeZ: z, targetX: x, targetZ: z, villager: true, phase: (x * 0.7 + z * 0.3) % (Math.PI * 2) }),
      TraderPosition(new Vector3(x, heightAt(x, z, seed) + 0.5, z)),
      TraderMesh(),
    ));
  }
  return residents;
}
