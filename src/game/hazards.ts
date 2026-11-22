import type { Entity, World } from 'koota';
import type { Vector3 } from 'three';
import { damageAnimal } from './combat';
import { Animal, AnimalHealth, AnimalHit, AnimalPosition, Fire, FirePosition, HorseRider, Player, PlayerMount, Trader, TraderPosition } from './traits';
import { BlockKind } from './voxel';
import { isTamedAnimal } from './taming';
import { dismount } from './vehicles';
import { applyTraderDeath, reportTraderDeath } from './deathSync';

export type FireSource = Vector3 & { kind?: BlockKind };

export function getFireSources(world: World): FireSource[] {
  return world.query(FirePosition).map((entity) => Object.assign(entity.get(FirePosition)!.clone(), { kind: entity.get(Fire)?.kind }));
}

export function nearestFire(fires: readonly FireSource[], position: Vector3, radius = 6, ignoreCampfire = false) {
  let nearest: Vector3 | null = null;
  let closest = radius * radius;
  for (const fire of fires) {
    if (ignoreCampfire && fire.kind === BlockKind.Campfire) continue;
    if (Math.abs(fire.y - position.y) > 4) continue;
    const distance = (fire.x - position.x) ** 2 + (fire.z - position.z) ** 2;
    if (distance >= closest) continue;
    nearest = fire;
    closest = distance;
  }
  return nearest;
}

function touchingFire(fires: readonly Vector3[], position: Vector3, bodyHeight: number) {
  return fires.some((fire) => {
    const relativeHeight = fire.y - position.y;
    return relativeHeight >= -1.25 && relativeHeight <= bodyHeight + 0.5
      && (fire.x - position.x) ** 2 + (fire.z - position.z) ** 2 <= 0.9 ** 2;
  });
}

export function damageAnimalFromHazard(world: World, target: Entity, amount: number) {
  if (target.get(HorseRider)?.mounted || target.get(HorseRider)?.passenger) {
    if (world.queryFirst(Player)?.get(PlayerMount)?.vehicle === target) dismount(world);
    target.set(HorseRider, { mounted: false, passenger: false, speed: 0 });
  }
  return damageAnimal(world, target, amount);
}

export function damageTrader(world: World, target: Entity, amount: number) {
  const trader = target.get(Trader);
  if (!trader) return false;
  const health = Math.max(0, trader.health - amount);
  target.set(Trader, { health, panic: 3 });
  if (health > 0) return false;
  reportTraderDeath(target);
  applyTraderDeath(world, `${trader.homeX}:${trader.homeZ}`);
  return true;
}

export function fireHazardSystem(world: World, dt: number) {
  const fires = getFireSources(world);
  if (fires.length === 0) return;
  for (const entity of world.query(Animal, AnimalHealth, AnimalHit, AnimalPosition)) {
    const hit = entity.get(AnimalHit)!;
    const position = entity.get(AnimalPosition)!;
    const hazards = isTamedAnimal(entity) ? fires.filter((fire) => fire.kind !== BlockKind.Campfire) : fires;
    const fireIn = Math.max(0, hit.fireIn - dt);
    entity.set(AnimalHit, { fireIn });
    if (fireIn > 0 || !touchingFire(hazards, position, 0.5)) continue;
    entity.set(AnimalHit, { fireIn: 1 });
    damageAnimalFromHazard(world, entity, 1);
  }
  for (const entity of world.query(Trader, TraderPosition)) {
    const trader = entity.get(Trader)!;
    const position = entity.get(TraderPosition)!;
    const fireIn = Math.max(0, trader.fireIn - dt);
    entity.set(Trader, { fireIn });
    if (fireIn > 0 || !touchingFire(fires, position, 0.9)) continue;
    entity.set(Trader, { fireIn: 1 });
    damageTrader(world, entity, 1);
  }
}

export function damageCreaturesInRadius(world: World, position: Vector3, radius: number, amount = 10) {
  const radiusSquared = radius * radius;
  const victims = { animals: 0, traders: 0 };
  for (const entity of [...world.query(Animal, AnimalHealth, AnimalPosition)]) {
    if (entity.get(AnimalPosition)!.distanceToSquared(position) > radiusSquared) continue;
    if (damageAnimalFromHazard(world, entity, amount)) victims.animals += 1;
  }
  for (const entity of [...world.query(Trader, TraderPosition)]) {
    if (entity.get(TraderPosition)!.distanceToSquared(position) > radiusSquared) continue;
    if (damageTrader(world, entity, amount)) victims.traders += 1;
  }
  return victims;
}
