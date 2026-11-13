import type { Entity, World } from 'koota';
import type { AnimalKind } from '../animals';
import { animalSoundEffect, playAnimalSound, stopAnimalSound } from '../audio';
import { Animal, AnimalPosition, Player, PlayerPosition } from '../traits';

const nextSounds = new WeakMap<World, Map<Entity, number>>();
export const ANIMAL_SOUND_INTERVAL = 60000;
type EmitAnimalSound = (kind: AnimalKind, distance: number, entity: Entity) => void;

function soundTimes(world: World) {
  let times = nextSounds.get(world);
  if (!times) {
    times = new Map();
    nextSounds.set(world, times);
  }
  return times;
}

function scheduleSound(times: Map<Entity, number>, entity: Entity, now: number, initial = false) {
  const hash = Math.imul(entity, 2654435761) >>> 0;
  let next = now + (initial ? hash % ANIMAL_SOUND_INTERVAL : ANIMAL_SOUND_INTERVAL + hash % 15000);
  while ([...times].some(([other, time]) => other !== entity && Math.abs(time - next) < 2500)) next += 2500;
  times.set(entity, next);
}

export function alertAnimalSound(world: World, entity: Entity, emit: EmitAnimalSound = playAnimalSound, now = performance.now()) {
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const kind = entity.get(Animal)?.kind;
  if (!player || !kind || !animalSoundEffect(kind)) return;
  const times = soundTimes(world);
  const distance = entity.get(AnimalPosition)!.distanceTo(player);
  if (distance <= 24) emit(kind, distance, entity);
  else stopAnimalSound(entity);
  scheduleSound(times, entity, now);
}

export function animalSoundSystem(world: World, dt: number, emit: EmitAnimalSound = playAnimalSound, now = performance.now()) {
  if (dt <= 0) return;
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return;
  const times = soundTimes(world);
  for (const entity of world.query(Animal, AnimalPosition)) {
    if (!entity.isAlive()) {
      stopAnimalSound(entity);
      times.delete(entity);
      continue;
    }
    const kind = entity.get(Animal)!.kind;
    if (!animalSoundEffect(kind)) continue;
    if (!times.has(entity)) scheduleSound(times, entity, now, true);
    const next = times.get(entity)!;
    if (now < next) continue;
    const distance = entity.get(AnimalPosition)!.distanceTo(player);
    if (distance <= 24) emit(kind, distance, entity);
    else stopAnimalSound(entity);
    scheduleSound(times, entity, now);
  }
  for (const entity of times.keys()) {
    if (!entity.isAlive()) {
      stopAnimalSound(entity);
      times.delete(entity);
    }
  }
}
