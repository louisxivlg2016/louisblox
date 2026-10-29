import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import type { AnimalKind } from './animals';
import { Animal, AnimalHealth, AnimalHit, AnimalMotion, AnimalPosition, ChunkData, HorseRider, MeatDrop, MeatDropMesh, MeatDropMotion, MeatDropPosition, Player, PlayerHealth } from './traits';
import { useGameStore } from './store';
import { ITEM_META } from './items';

export function damagePlayer(world: World, amount: number) {
  const player = world.queryFirst(Player);
  const health = player?.get(PlayerHealth);
  if (!player || !health) return;
  const armor = useGameStore.getState().equippedArmor;
  const protection = armor ? ITEM_META[`armor_${armor}`].protection ?? 0 : 0;
  const absorbed = health.absorbed + amount * (1 - protection);
  const damage = Math.floor(absorbed);
  player.set(PlayerHealth, { value: Math.max(0, health.value - damage), absorbed: absorbed - damage });
}

export type AnimalTarget = { entity: Entity; kind: AnimalKind; health: number; distance: number };
const offset = new Vector3();

export function findAnimalTarget(world: World, origin: Vector3, direction: Vector3, maxDistance = 4.5): AnimalTarget | null {
  let target: AnimalTarget | null = null;
  let closest = maxDistance;
  for (const entity of world.query(Animal, AnimalPosition, AnimalHealth)) {
    if (entity.get(HorseRider)?.mounted) continue;
    const kind = entity.get(Animal)!.kind;
    const position = entity.get(AnimalPosition)!;
    const bird = kind === 'chicken' || kind === 'duck';
    offset.set(position.x, position.y + (bird ? 0.4 : 0.85), position.z).sub(origin);
    const distance = offset.dot(direction);
    if (distance < 0 || distance >= closest) continue;
    const radius = kind === 'horse' || kind === 'camel' ? 1 : bird ? 0.55 : 0.85;
    if (offset.lengthSq() - distance * distance > radius * radius) continue;
    closest = distance;
    target = { entity, kind, health: entity.get(AnimalHealth)!.value, distance };
  }
  return target;
}

export function damageAnimal(world: World, target: Entity, amount: number, attacker?: Vector3) {
  const health = target.get(AnimalHealth);
  const animal = target.get(Animal);
  const position = target.get(AnimalPosition);
  if (!health || !animal || !position || target.get(HorseRider)?.mounted) return false;
  const remaining = health.value - amount;
  if (remaining > 0) {
    target.set(AnimalHealth, { value: remaining });
    target.set(AnimalHit, { time: 0.24, panic: 2.4, flashed: false });
    if (attacker) target.set(AnimalMotion, { yaw: Math.atan2(position.x - attacker.x, position.z - attacker.z) });
    return false;
  }

  const dropY = position.y + 0.35;
  world.spawn(
    MeatDrop({ kind: animal.kind }),
    MeatDropPosition(new Vector3(position.x, dropY, position.z)),
    MeatDropMotion({ age: 0, baseY: dropY }),
    MeatDropMesh(),
  );
  for (const chunkEntity of world.query(ChunkData)) {
    const data = chunkEntity.get(ChunkData)!;
    data.animals = data.animals.filter((entity) => entity !== target);
  }
  target.destroy();
  return true;
}
