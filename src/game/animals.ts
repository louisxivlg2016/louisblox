import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { biomeAt, heightAt, SEA_LEVEL } from './levels';
import type { Biome, WaterTile } from './levels';
import { Animal, AnimalHealth, AnimalHit, AnimalMesh, AnimalMotion, AnimalPosition } from './traits';

export type AnimalKind =
  | 'camel' | 'cow' | 'horse' | 'pig' | 'sheep' | 'chicken' | 'duck'
  | 'bear' | 'deer' | 'wolf' | 'snowWolf' | 'snowBear';

const species: Record<Biome, AnimalKind[]> = {
  prairie: ['cow', 'horse', 'pig', 'sheep', 'chicken'],
  desert: ['camel'],
  forest: ['bear', 'deer', 'wolf'],
  winter: ['snowWolf', 'snowBear', 'deer'],
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
};

function hash(x: number, z: number, seed: number) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function spawnAnimal(world: World, kind: AnimalKind, x: number, y: number, z: number, seed: number) {
  const yaw = hash(x, z, seed + 41) * Math.PI * 2;
  return world.spawn(
    Animal({ kind }),
    AnimalHealth({ value: health[kind] }),
    AnimalHit(),
    AnimalPosition(new Vector3(x, y, z)),
    AnimalMotion({
      yaw,
      displayYaw: yaw,
      turnIn: 6 + hash(x, z, seed + 42) * 7,
      phase: hash(x, z, seed + 43) * Math.PI * 2,
      speed: 0.35 + hash(x, z, seed + 44) * 0.45,
    }),
    AnimalMesh(),
  );
}

export function spawnChunkAnimals(world: World, cx: number, cz: number, water: WaterTile[], seed: number) {
  const entities: Entity[] = [];

  if (water.length > 0 && hash(cx, cz, seed + 800) > 0.3) {
    const tile = water[Math.floor(hash(cx, cz, seed + 801) * water.length)];
    entities.push(spawnAnimal(world, 'duck', tile.x, SEA_LEVEL + 0.35, tile.z, seed));
  }

  if (cx === 0 && cz === 0) {
    entities.push(spawnAnimal(world, 'cow', -3, heightAt(-3, -4, seed) + 0.5, -4, seed));
    entities.push(spawnAnimal(world, 'sheep', 4, heightAt(4, -5, seed) + 0.5, -5, seed));
    entities.push(spawnAnimal(world, 'horse', 5, heightAt(5, 3, seed) + 0.5, 3, seed));
  }

  if (hash(cx, cz, seed + 802) < 0.58) return entities;
  const centerX = cx * 16 + 8;
  const centerZ = cz * 16 + 8;
  const biome = biomeAt(centerX, centerZ, seed);
  const candidates = species[biome];
  const count = hash(cx, cz, seed + 803) > 0.86 ? 2 : 1;

  for (let index = 0; index < count; index += 1) {
    const x = cx * 16 + 2 + Math.floor(hash(cx + index, cz, seed + 804) * 12);
    const z = cz * 16 + 2 + Math.floor(hash(cx, cz + index, seed + 805) * 12);
    const height = heightAt(x, z, seed);
    if (height <= SEA_LEVEL + 1 || height > 24) continue;
    const kind = candidates[Math.floor(hash(x, z, seed + 806) * candidates.length)];
    entities.push(spawnAnimal(world, kind, x, height + 0.5, z, seed));
  }

  return entities;
}
