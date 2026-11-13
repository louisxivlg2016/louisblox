import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { findAnimalTarget } from '../combat';
import { canFeedAnimal, feedAnimal } from '../taming';
import { reportAnimalTame } from '../animalSync';
import { useGameStore } from '../store';
import { Player, PlayerPosition } from '../traits';

const origin = new Vector3();
const direction = new Vector3();

export function animalInteractionSystem(world: World, camera: Camera, interact: number, touchTaps = 0) {
  if (interact <= 0 && touchTaps <= 0) return false;
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const selected = useGameStore.getState().selected;
  if (!player || selected === 'hand' || typeof selected === 'number' || selected === 'saddle') return false;
  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);
  const target = findAnimalTarget(world, origin, direction, 5.5);
  if (!target || target.health <= 0 || touchTaps > 0 && !canFeedAnimal(target.kind, selected)) return false;
  const result = feedAnimal(world, target.entity, selected);
  if (result === false) return false;
  if (result === 'fed') reportAnimalTame(target.entity);
  return true;
}
