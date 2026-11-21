import type { World } from 'koota';
import { getBlockIndex, getWorldSeed, streamChunks } from './chunks';
import { groundAt } from './vehicles';
import { isCollidable } from './systems/collisionSystem';
import { biomeAt, heightAt, safeSpawnAt } from './levels';
import { tradeCityAt, villageAt } from './villages';
import { nearestFarmstead, nearestHamlet } from './countryside';
import { saveWorld } from './save';
import { translate } from './language';
import type { Biome } from './levels';
import { nearestRuinOfType } from './ruins';
import type { RuinType } from './ruins';
import { Player, PlayerBody, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity, Sleep } from './traits';
import { dismount } from './vehicles';
import { useGameStore } from './store';
import type { Home } from './homes';

function safeDestination(world: World, x: number, y: number, z: number) {
  const blocks = getBlockIndex(world);
  for (let radius = 0; radius <= 8; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const nextX = Math.round(x + dx);
        const nextZ = Math.round(z + dz);
        const ground = groundAt(world, nextX, nextZ);
        const feet = Math.ceil(ground + 0.5);
        if (!isCollidable(blocks.get(`${nextX},${feet},${nextZ}`)) && !isCollidable(blocks.get(`${nextX},${feet + 1},${nextZ}`))) return { x: nextX, y: ground + 0.02, z: nextZ };
      }
    }
  }
  const nextX = Math.round(x);
  const nextZ = Math.round(z);
  return { x: nextX, y: groundAt(world, nextX, nextZ) + 0.02, z: nextZ };
}

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

  for (let index = 0; index < 9; index += 1) streamChunks(world, destination.x, destination.z);
  const safe = safeDestination(world, destination.x, destination.y, destination.z);
  streamChunks(world, safe.x, safe.z);
  position.set(safe.x, safe.y, safe.z);
  entity.get(PlayerBody)?.value?.setTranslation(safe, true);
  entity.get(PlayerVelocity)?.set(0, 0, 0);
  entity.set(PlayerState, { flying: false, grounded: false });
  return safe;
}

export function teleportToRuin(world: World, type: RuinType) {
  const entity = world.queryFirst(Player);
  const position = entity?.get(PlayerPosition);
  if (!entity || !position) return null;
  const site = nearestRuinOfType(position.x, position.z, getWorldSeed(world), type);
  const destination = { x: site.x, y: site.baseY + 1.01, z: site.z };
  for (let index = 0; index < 9; index += 1) streamChunks(world, destination.x, destination.z);
  const safe = safeDestination(world, destination.x, destination.y, destination.z);
  streamChunks(world, safe.x, safe.z);
  position.set(safe.x, safe.y, safe.z);
  entity.get(PlayerBody)?.value?.setTranslation(safe, true);
  entity.get(PlayerVelocity)?.set(0, 0, 0);
  entity.set(PlayerState, { flying: false, grounded: false });
  return safe;
}

function nearestNaturalVillage(x: number, z: number, seed: number) {
  const centerX = Math.floor(x / 192);
  const centerZ = Math.floor(z / 192);
  const visited = new Set<string>();
  for (let radius = 0; radius <= 12; radius += 1) {
    let nearest: { x: number; z: number } | null = null;
    let bestDistance = Infinity;
    const consider = (site: { x: number; z: number } | null) => {
      if (!site || visited.has(`${site.x},${site.z}`)) return;
      visited.add(`${site.x},${site.z}`);
      const distance = Math.hypot(site.x - x, site.z - z);
      if (distance < bestDistance) {
        nearest = site;
        bestDistance = distance;
      }
    };
    if (radius === 0) consider(villageAt(0, 0, seed));
    for (let dx = -radius; dx <= radius; dx += 1) for (let dz = -radius; dz <= radius; dz += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
      const candidateX = (centerX + dx) * 192 + 96;
      const candidateZ = (centerZ + dz) * 192 + 96;
      consider(villageAt(Math.floor(candidateX / 16), Math.floor(candidateZ / 16), seed));
    }
    if (nearest) return nearest;
  }
  return null;
}

export function teleportToVillage(world: World) {
  const entity = world.queryFirst(Player);
  const position = entity?.get(PlayerPosition);
  if (!entity || !position) return null;
  const game = useGameStore.getState();
  const seed = getWorldSeed(world);
  const ancient = game.gameplayMode === 'city-ancient';
  const site = ancient ? nearestHamlet(position.x, position.z, seed) : game.worldTemplate === 'nature' ? nearestNaturalVillage(position.x, position.z, seed) : null;
  if (!site) {
    game.setNotice(translate('Aucun petit village trouvé dans ce monde.', 'No small village found in this world.'));
    return null;
  }
  const z = site.z + 7;
  const y = ancient ? 5.51 : heightAt(site.x, z, seed) + 0.51;
  const destination = teleportToHome(world, { x: site.x, y, z, yaw: 0, pitch: 0 });
  if (destination) {
    saveWorld(world);
    game.setNotice(translate('Téléportation au petit village réussie !', 'Teleported to the small village!'));
  }
  return destination;
}

export function teleportToFarm(world: World) {
  const entity = world.queryFirst(Player);
  const position = entity?.get(PlayerPosition);
  if (!entity || !position) return null;
  const game = useGameStore.getState();
  const seed = getWorldSeed(world);
  const ancient = game.gameplayMode === 'city-ancient';
  const farmstead = ancient ? nearestFarmstead(position.x, position.z, seed) : null;
  const site = ancient ? farmstead : game.worldTemplate === 'nature' ? tradeCityAt(seed) : null;
  if (!site) {
    game.setNotice(translate('Aucune ferme trouvée dans ce monde.', 'No farm found in this world.'));
    return null;
  }
  const x = ancient ? site.x - 43 : site.x - 22;
  const z = ancient ? site.z + 40 : site.z + 14;
  const y = ancient ? 5.51 : heightAt(x, z, seed) + 0.51;
  const destination = teleportToHome(world, { x, y, z, yaw: 0, pitch: 0 });
  if (destination) {
    saveWorld(world);
    game.setNotice(translate('Téléportation à la ferme réussie !', 'Teleported to the farm!'));
  }
  return destination;
}

export function teleportToHome(world: World, destination: Pick<Home, 'x' | 'y' | 'z' | 'yaw' | 'pitch'>) {
  const entity = world.queryFirst(Player);
  const position = entity?.get(PlayerPosition);
  if (!entity || !position) return null;
  if (entity.get(PlayerMount)?.vehicle) dismount(world);
  const sleeping = world.queryFirst(Sleep);
  if (sleeping) sleeping.destroy();
  useGameStore.getState().setSleepProgress(null);
  for (let index = 0; index < 9; index += 1) streamChunks(world, destination.x, destination.z);
  const safe = safeDestination(world, destination.x, destination.y, destination.z);
  streamChunks(world, safe.x, safe.z);
  position.set(safe.x, safe.y, safe.z);
  entity.get(PlayerBody)?.value?.setTranslation(safe, true);
  entity.get(PlayerVelocity)?.set(0, 0, 0);
  entity.set(PlayerState, { flying: false, grounded: false, yaw: destination.yaw, pitch: destination.pitch });
  useGameStore.getState().setFlying(false);
  return { x: safe.x, y: safe.y, z: safe.z };
}
