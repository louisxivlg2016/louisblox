import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex, removeVoxel } from './chunks';
import { getItemMeta } from './items';
import type { SelectedKind } from './items';
import { Animal, AnimalLove, AnimalPosition, DroppedItem, DroppedItemPosition, MeatDrop, MeatDropPosition } from './traits';
import { applyTameState, canFeedAnimal, isTamedAnimal } from './taming';
import type { AnimalKind } from './animals';
import { reportAnimalTame } from './animalSync';
import type { Voxel } from './voxel';

export type FoundFood = { selected: SelectedKind; position: Vector3; dropped?: Entity; block?: Voxel };
const searches = new WeakMap<World, Map<Entity, number>>();
const targets = new WeakMap<World, Map<Entity, FoundFood | null>>();

function edible(kind: AnimalKind, selected: SelectedKind) {
  return typeof selected === 'string' && getItemMeta(selected).category === 'food' && canFeedAnimal(kind, selected);
}

function meatSelection(kind: AnimalKind): SelectedKind {
  return kind === 'chicken' || kind === 'duck' ? 'raw_chicken' : 'raw_meat';
}

function nearestFood(world: World, entity: Entity, kind: AnimalKind): FoundFood | null {
  const position = entity.get(AnimalPosition)!;
  let nearest: FoundFood | null = null;
  let closest = 8;
  for (const dropped of world.query(DroppedItem, DroppedItemPosition)) {
    const selected = dropped.get(DroppedItem)!.kind;
    if (!edible(kind, selected)) continue;
    const foodPosition = dropped.get(DroppedItemPosition)!;
    const distance = position.distanceTo(foodPosition);
    if (distance >= closest) continue;
    closest = distance;
    nearest = { selected, position: foodPosition, dropped };
  }
  for (const dropped of world.query(MeatDrop, MeatDropPosition)) {
    const selected = meatSelection(dropped.get(MeatDrop)!.kind);
    if (!edible(kind, selected)) continue;
    const foodPosition = dropped.get(MeatDropPosition)!;
    const distance = position.distanceTo(foodPosition);
    if (distance >= closest) continue;
    closest = distance;
    nearest = { selected, position: foodPosition, dropped };
  }
  for (const block of getBlockIndex(world).values()) {
    const selected = block.food ?? (block.meat ? meatSelection(block.meat) : undefined);
    if (!selected || !edible(kind, selected)) continue;
    const foodPosition = new Vector3(block.x, block.y + 0.5, block.z);
    const distance = position.distanceTo(foodPosition);
    if (distance >= closest) continue;
    closest = distance;
    nearest = { selected, position: foodPosition, block };
  }
  return nearest;
}

export function foundFoodFor(world: World, entity: Entity) {
  const kind = entity.get(Animal)?.kind;
  if (!kind || kind === 'zombie') return null;
  const now = Date.now();
  const previous = searches.get(world)?.get(entity) ?? 0;
  if (now - previous < 1000) return targets.get(world)?.get(entity) ?? null;
  let times = searches.get(world);
  if (!times) {
    times = new Map();
    searches.set(world, times);
  }
  times.set(entity, now);
  const target = nearestFood(world, entity, kind);
  let cached = targets.get(world);
  if (!cached) {
    cached = new Map();
    targets.set(world, cached);
  }
  cached.set(entity, target);
  return target;
}

export function eatFoundFood(world: World, entity: Entity, food: FoundFood) {
  if (food.dropped) food.dropped.destroy();
  if (food.block) removeVoxel(world, { block: food.block, x: food.block.x, y: food.block.y, z: food.block.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, true);
  if (isTamedAnimal(entity)) {
    applyTameState(world, entity, { tamed: true, lastFedAt: Date.now(), happiness: 100 });
    reportAnimalTame(entity);
  }
  if (entity.has(AnimalLove)) entity.set(AnimalLove, { time: 3 });
  else entity.add(AnimalLove({ time: 3 }));
  targets.get(world)?.delete(entity);
}
