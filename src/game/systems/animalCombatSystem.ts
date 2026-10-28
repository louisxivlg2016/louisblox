import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import type { AnimalKind } from '../animals';
import { isMouseDown, stopMining } from '../input';
import {
  Animal,
  AnimalHealth,
  AnimalHit,
  AnimalMotion,
  AnimalPosition,
  ChunkData,
  MeatDrop,
  MeatDropMesh,
  MeatDropMotion,
  MeatDropPosition,
  Player,
  PlayerPosition,
} from '../traits';

const direction = new Vector3();
const origin = new Vector3();
const toAnimal = new Vector3();
const cooldowns = new WeakMap<World, number>();

export function animalCombatSystem(world: World, camera: Camera, dt: number) {
  const cooldown = Math.max(0, (cooldowns.get(world) ?? 0) - dt);
  cooldowns.set(world, cooldown);
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return false;

  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);
  let target: { entity: Entity; kind: AnimalKind; health: number } | null = null;
  let closest = 4.5;
  const entities = world.query(Animal, AnimalPosition, AnimalHealth);

  for (const entity of entities) {
    const kind = entity.get(Animal)!.kind;
    const position = entity.get(AnimalPosition)!;
    const bird = kind === 'chicken' || kind === 'duck';
    toAnimal.set(position.x, position.y + (bird ? 0.45 : 0.9), position.z).sub(origin);
    const distance = toAnimal.dot(direction);
    if (distance < 0 || distance >= closest) continue;
    const radius = bird ? 0.55 : 0.85;
    if (toAnimal.lengthSq() - distance * distance > radius * radius) continue;
    closest = distance;
    target = { entity, kind, health: entity.get(AnimalHealth)!.value };
  }

  if (!target) return false;
  if (isMouseDown(0) && cooldown <= 0) {
    const remaining = target.health - 1;
    const position = target.entity.get(AnimalPosition)!;
    if (remaining <= 0) {
      const dropY = position.y + 0.35;
      world.spawn(
        MeatDrop({ kind: target.kind }),
        MeatDropPosition(new Vector3(position.x, dropY, position.z)),
        MeatDropMotion({ age: 0, baseY: dropY }),
        MeatDropMesh(),
      );
      for (const chunkEntity of world.query(ChunkData)) {
        const data = chunkEntity.get(ChunkData)!;
        data.animals = data.animals.filter((animal) => animal !== target!.entity);
      }
      target.entity.destroy();
      stopMining();
    } else {
      target.entity.set(AnimalHealth, { value: remaining });
      target.entity.set(AnimalHit, { time: 0.24, panic: 2.4, flashed: false });
      target.entity.set(AnimalMotion, {
        yaw: Math.atan2(position.x - player.x, position.z - player.z),
      });
    }
    cooldowns.set(world, 0.35);
  }
  return true;
}
