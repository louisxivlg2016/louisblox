import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { biomeAt, heightAt, safeSpawnAt, SEA_LEVEL } from './levels';
import type { Biome, WaterTile } from './levels';
import { Animal, AnimalHealth, AnimalHit, AnimalId, AnimalMesh, AnimalMotion, AnimalPosition, CamelLeash, Trader, TraderMesh, TraderPosition } from './traits';
import { useGameStore } from './store';
import { isInAnyRuinFootprint } from './ruins';

function safeRoamSpawn(x: number, z: number, seed: number) {
  for (let radius = 0; radius <= 16; radius += 1) {
    let best: { x: number; y: number; z: number } | null = null;
    let bestDistance = Infinity;
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const px = Math.round(x) + dx;
        const pz = Math.round(z) + dz;
        const height = heightAt(px, pz, seed);
        if (height <= SEA_LEVEL || isInAnyRuinFootprint(px, pz, seed)) continue;
        const distance = dx * dx + dz * dz;
        if (distance >= bestDistance) continue;
        best = { x: px, y: height + 1.01, z: pz };
        bestDistance = distance;
      }
    }
    if (best) return { ...best, onLand: true };
  }
  return safeSpawnAt(x, z, seed);
}

export type AnimalKind =
  | 'camel' | 'cow' | 'horse' | 'pig' | 'sheep' | 'chicken' | 'duck'
  | 'bear' | 'deer' | 'wolf' | 'snowWolf' | 'snowBear' | 'snowDeer' | 'zombie';

const species: Record<Biome, AnimalKind[]> = {
  prairie: ['cow', 'horse', 'pig', 'sheep', 'chicken'],
  desert: ['camel'],
  forest: ['bear', 'deer', 'wolf'],
  jungle: ['pig', 'chicken', 'deer'],
  winter: ['snowWolf', 'snowBear', 'snowDeer'],
  autumn: ['cow', 'sheep', 'deer'],
};

const health: Record<AnimalKind, number> = {
  camel: 4,
  cow: 4,
  horse: 4,
  pig: 3,
  sheep: 3,
  chicken: 3,
  duck: 3,
  bear: 6,
  deer: 3,
  wolf: 5,
  snowWolf: 5,
  snowBear: 6,
  snowDeer: 3,
  zombie: 5,
};

function hash(x: number, z: number, seed: number) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function spawnAnimal(world: World, kind: AnimalKind, x: number, y: number, z: number, seed: number) {
  const id = `${kind}:${x}:${z}`;
  const existing = world.query(Animal, AnimalId).find((entity) => entity.get(AnimalId) === id);
  if (existing) return existing;
  const site = kind === 'duck' ? { x, y, z } : safeRoamSpawn(x, z, seed);
  const yaw = hash(x, z, seed + 41) * Math.PI * 2;
  return world.spawn(
    Animal({ kind }),
    AnimalId(id),
    AnimalHealth({ value: health[kind] }),
    AnimalHit(),
    AnimalPosition(new Vector3(site.x, kind === 'duck' ? y : site.y - 0.51, site.z)),
    AnimalMotion({
      yaw,
      displayYaw: yaw,
      turnIn: 6 + hash(x, z, seed + 42) * 7,
      phase: hash(x, z, seed + 43) * Math.PI * 2,
      speed: 0.65 + hash(x, z, seed + 44) * 0.35,
    }),
    AnimalMesh(),
  );
}

export function spawnTrader(world: World, x: number, z: number, seed: number) {
  const site = safeRoamSpawn(x, z, seed);
  const trader = world.spawn(
    Trader({ homeX: site.x, homeZ: site.z, targetX: site.x, targetZ: site.z }),
    TraderPosition(new Vector3(site.x, site.y, site.z)),
    TraderMesh(),
  );
  const heading = site.x * 0.17 + site.z * 0.31;
  const camels = [0, 1].map((order) => {
    const gap = 1.65 + order * 1.2;
    const camel = spawnAnimal(world, 'camel', site.x - Math.sin(heading) * gap, site.y, site.z - Math.cos(heading) * gap, seed + order);
    camel.set(AnimalMotion, { yaw: heading, displayYaw: heading });
    camel.add(CamelLeash({ trader, order }));
    return camel;
  });
  return [trader, ...camels];
}

function spawnTradersAlongGrid(world: World, cx: number, cz: number, seed: number) {
  const entities: Entity[] = [];
  for (let cellX = Math.floor(cx * 16 / 100); cellX <= Math.floor((cx * 16 + 15) / 100); cellX += 1) {
    for (let cellZ = Math.floor(cz * 16 / 100); cellZ <= Math.floor((cz * 16 + 15) / 100); cellZ += 1) {
      const x = cellX * 100 + 50;
      const z = cellZ * 100 + 50;
      if (x < cx * 16 || x >= (cx + 1) * 16 || z < cz * 16 || z >= (cz + 1) * 16) continue;
      entities.push(...spawnTrader(world, x, z, seed + cellX * 37 + cellZ * 61));
    }
  }
  return entities;
}

export function spawnChunkAnimals(world: World, cx: number, cz: number, water: WaterTile[], seed: number) {
  const entities: Entity[] = [...spawnTradersAlongGrid(world, cx, cz, seed)];

  const openWater = water.filter((tile) => !isInAnyRuinFootprint(tile.x, tile.z, seed));
  if (openWater.length > 0 && hash(cx, cz, seed + 800) > 0.95) {
    const tile = openWater[Math.floor(hash(cx, cz, seed + 801) * openWater.length)];
    entities.push(spawnAnimal(world, 'duck', tile.x, SEA_LEVEL + 0.35, tile.z, seed));
  }

  if (cx === 0 && cz === 0) {
    entities.push(spawnAnimal(world, 'cow', -3, heightAt(-3, -4, seed) + 0.5, -4, seed));
    entities.push(spawnAnimal(world, 'sheep', 4, heightAt(4, -5, seed) + 0.5, -5, seed));
    entities.push(spawnAnimal(world, 'horse', 5, heightAt(5, 3, seed) + 0.5, 3, seed));
    entities.push(...spawnTrader(world, 7, 4, seed));
  }

  if (useGameStore.getState().gameplayMode === 'survival' && hash(cx, cz, seed + 820) > 0.3) {
    const count = hash(cx, cz, seed + 821) > 0.7 ? 3 : 2;
    for (let index = 0; index < count; index += 1) {
      const x = cx * 16 + 2 + Math.floor(hash(cx + index, cz, seed + 822) * 12);
      const z = cz * 16 + 2 + Math.floor(hash(cx, cz + index, seed + 823) * 12);
      const height = heightAt(x, z, seed);
      if (height <= SEA_LEVEL + 1 || height > 24) continue;
      entities.push(spawnAnimal(world, 'zombie', x, height + 0.5, z, seed + index));
    }
  }

  if (hash(cx, cz, seed + 802) < 0.75) return entities;
  const centerX = cx * 16 + 8;
  const centerZ = cz * 16 + 8;
  const biome = biomeAt(centerX, centerZ, seed);
  const candidates = species[biome];
  const x = cx * 16 + 2 + Math.floor(hash(cx, cz, seed + 804) * 12);
  const z = cz * 16 + 2 + Math.floor(hash(cx, cz + 1, seed + 805) * 12);
  const height = heightAt(x, z, seed);
  if (height <= SEA_LEVEL + 1 || height > 24) return entities;
  const kind = candidates[Math.floor(hash(x, z, seed + 806) * candidates.length)];
  entities.push(spawnAnimal(world, kind, x, height + 0.5, z, seed));

  return entities;
}
