import type { World } from 'koota';
import { getWorldSeed, streamChunks } from './chunks';
import { biomeAt, safeSpawnAt } from './levels';
import type { Biome } from './levels';
import { nearestRuinOfType } from './ruins';
import type { RuinType } from './ruins';
import { Player, PlayerBody, PlayerPosition, PlayerState, PlayerVelocity } from './traits';

export function teleportToBiome(world: World, biome: Biome) {
  const entity = world.queryFirst(Player);
  const position = entity?.get(PlayerPosition);
  if (!entity || !position) return null;

  const seed = getWorldSeed(world);
  const centerX = Math.floor(position.x / 1024);
  const centerZ = Math.floor(position.z / 1024);
  let best: ReturnType<typeof safeSpawnAt> | null = null;
  let fallback: ReturnType<typeof safeSpawnAt> | null = null;
  let bestDistance = Infinity;
  for (let radius = 0; radius <= 8 && !best; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const x = (centerX + dx) * 1024 + 512;
        const z = (centerZ + dz) * 1024 + 512;
        if (biomeAt(x, z, seed) !== biome) continue;
        const candidate = safeSpawnAt(x, z, seed, biome);
        if (!fallback) fallback = candidate;
        if (!candidate.onLand) continue;
        const distance = Math.hypot(candidate.x - position.x, candidate.z - position.z);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }
    }
  }
  const destination = best ?? fallback;
  if (!destination) return null;

  streamChunks(world, destination.x, destination.z);
  position.set(destination.x, destination.y, destination.z);
  entity.get(PlayerBody)?.value?.setTranslation(destination, true);
  entity.get(PlayerVelocity)?.set(0, 0, 0);
  entity.set(PlayerState, { flying: false, grounded: false });
  return destination;
}

export function teleportToRuin(world: World, type: RuinType) {
  const entity = world.queryFirst(Player);
  const position = entity?.get(PlayerPosition);
  if (!entity || !position) return null;
  const site = nearestRuinOfType(position.x, position.z, getWorldSeed(world), type);
  const destination = { x: site.x, y: site.baseY + 1.01, z: site.z };
  streamChunks(world, destination.x, destination.z);
  position.set(destination.x, destination.y, destination.z);
  entity.get(PlayerBody)?.value?.setTranslation(destination, true);
  entity.get(PlayerVelocity)?.set(0, 0, 0);
  entity.set(PlayerState, { flying: false, grounded: false });
  return destination;
}
