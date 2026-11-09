import type { World } from 'koota';
import { Vector3 } from 'three';
import { biomeAt, heightAt, safeSpawnAt, SEA_LEVEL } from './levels';
import { isInAnyRuinFootprint } from './ruins';
import { Trader, TraderMesh, TraderPosition } from './traits';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';

const HOUSE_OFFSETS = [[-5, -4], [5, -4], [-5, 5], [5, 5]] as const;

function hash(x: number, z: number, seed: number) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function villageAt(cx: number, cz: number, seed: number) {
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

export function generateVillageBlocks(cx: number, cz: number, seed: number): Voxel[] {
  const site = villageAt(cx, cz, seed);
  if (!site) return [];
  const blocks: Voxel[] = [];
  const put = (x: number, y: number, z: number, kind: BlockKind) => {
    if (x < cx * 16 || x >= (cx + 1) * 16 || z < cz * 16 || z >= (cz + 1) * 16) return;
    blocks.push({ x, y, z, kind });
  };
  for (const [offsetX, offsetZ] of HOUSE_OFFSETS) {
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
  for (let offset = -8; offset <= 8; offset++) {
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
  put(site.x - 7, heightAt(site.x - 7, site.z, seed) + 1, site.z, BlockKind.StreetLamp);
  put(site.x + 7, heightAt(site.x + 7, site.z, seed) + 1, site.z, BlockKind.StreetLamp);
  return blocks;
}

export function spawnVillageResidents(world: World, cx: number, cz: number, seed: number) {
  const site = villageAt(cx, cz, seed);
  if (!site) return [];
  const residents = [];
  for (const [offsetX, offsetZ] of HOUSE_OFFSETS) {
    const x = site.x + offsetX;
    const z = site.z + offsetZ + 3;
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
