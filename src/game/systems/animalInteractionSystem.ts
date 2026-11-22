import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { findAnimalTarget } from '../combat';
import { animalFoodNotice, canFeedAnimal, feedAnimal, isTamedAnimal } from '../taming';
import { reportAnimalTame } from '../animalSync';
import { useGameStore } from '../store';
import { getItemMeta } from '../items';
import { Player, PlayerPosition } from '../traits';
import { useCompanionMenuStore } from '../companionMenu';
import { releasePointerForOverlay } from '../input';

const origin = new Vector3();
const direction = new Vector3();

export function animalInteractionSystem(world: World, camera: Camera, interact: number, touchTaps = 0) {
  if (interact <= 0 && touchTaps <= 0) return false;
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const selected = useGameStore.getState().selected;
  if (!player) return false;
  if (typeof selected === 'string' && ['sword', 'bow', 'gun'].includes(getItemMeta(selected).category)) return false;
  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);
  const target = findAnimalTarget(world, origin, direction, 5.5);
  if (!target || target.health <= 0) return false;
  if (isTamedAnimal(target.entity) && !canFeedAnimal(target.kind, selected)) {
    useCompanionMenuStore.getState().openFor(target.entity);
    useGameStore.getState().setMode('pause');
    releasePointerForOverlay();
    return true;
  }
  if (touchTaps <= 0 && (selected === 'hand' || typeof selected === 'number' || selected === 'saddle')) return false;
  if (touchTaps > 0 && !canFeedAnimal(target.kind, selected)) {
    useGameStore.getState().setNotice(animalFoodNotice(target.kind));
    return true;
  }
  const result = feedAnimal(world, target.entity, selected);
  if (result === false) return false;
  if (result === 'fed') reportAnimalTame(target.entity);
  return true;
}
