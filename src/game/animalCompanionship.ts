import type { Entity, World } from 'koota';
import { getBlockIndex } from './chunks';
import { companionAnimalName } from './taming';
import { useGameStore } from './store';
import { Animal, AnimalCompanionship, AnimalLove, AnimalMotion, AnimalPosition, Player, PlayerPosition } from './traits';
import { groundAt } from './vehicles';
import { BlockKind } from './voxel';
import { MIN_WORLD_Y } from './levels';
import { translate } from './language';

let phraseIndex = 0;

export function animalSay(kind: Parameters<typeof companionAnimalName>[0], french: string, english: string) {
  useGameStore.getState().setNotice(`${companionAnimalName(kind)} : ${translate(french, english)}`);
}

export function petAnimal(world: World, entity: Entity) {
  const animal = entity.get(AnimalMotion);
  const position = entity.get(AnimalPosition);
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const kind = entity.get(Animal)?.kind;
  if (!animal || !position || !player || !kind) return false;
  const companionship = entity.get(AnimalCompanionship) ?? { attention: 0, adviceAt: 0, shelterX: null, shelterZ: null };
  companionship.attention = 5;
  if (entity.has(AnimalCompanionship)) entity.set(AnimalCompanionship, companionship);
  else entity.add(AnimalCompanionship(companionship));
  entity.set(AnimalMotion, { yaw: Math.atan2(player.x - position.x, player.z - position.z), turnIn: Math.max(animal.turnIn, 1), hunting: false, speed: 0 });
  if (entity.has(AnimalLove)) entity.set(AnimalLove, { time: 2 });
  else entity.add(AnimalLove({ time: 2 }));
  const phrases = [
    ['Merci, c’est gentil !', 'Thank you, that is kind!'],
    ['J’aime beaucoup tes caresses.', 'I really like your pets.'],
    ['Tu es un bon ami.', 'You are a good friend.'],
    ['Encore un peu, s’il te plaît !', 'A little more, please!'],
    ['Je me sens bien avec toi.', 'I feel good with you.'],
  ];
  const phrase = phrases[phraseIndex++ % phrases.length];
  animalSay(kind, phrase[0], phrase[1]);
  return true;
}

export function findTreeShelter(world: World, origin: { x: number; y: number; z: number }, radius = 24) {
  let best: { x: number; y: number; z: number; distance: number } | null = null;
  for (const block of getBlockIndex(world).values()) {
    if (block.kind !== BlockKind.Wood || Math.abs(block.x - origin.x) > radius || Math.abs(block.z - origin.z) > radius) continue;
    const distance = Math.hypot(block.x - origin.x, block.z - origin.z);
    if (distance > radius || distance >= (best?.distance ?? Infinity)) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = block.x + dx;
      const z = block.z + dz;
      const y = groundAt(world, x, z, origin.y + 6);
      if (y <= MIN_WORLD_Y + 0.5 || Math.abs(y - origin.y) > 6) continue;
      best = { x, y, z, distance };
      break;
    }
  }
  return best;
}
