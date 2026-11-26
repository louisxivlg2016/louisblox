import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { findAnimalTarget } from '../combat';
import { animalFoodNotice, canFeedAnimal, feedAnimal, isOwnTamedAnimal, isTamedAnimal, wakeTamedAnimal } from '../taming';
import { reportAnimalTame } from '../animalSync';
import { useGameStore } from '../store';
import { getItemMeta } from '../items';
import { Animal, AnimalHealth, AnimalPosition, AnimalRest, Player, PlayerPosition } from '../traits';
import { isNight } from '../dayNight';
import { useCompanionMenuStore } from '../companionMenu';
import { releasePointerForOverlay } from '../input';
import { translate } from '../language';
import { petAnimal } from '../animalCompanionship';

const origin = new Vector3();
const direction = new Vector3();

export function animalInteractionSystem(world: World, camera: Camera, interact: number, touchTaps = 0, pets = 0) {
  if (interact <= 0 && touchTaps <= 0 && pets <= 0) return false;
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const selected = useGameStore.getState().selected;
  if (!player) return false;
  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);
  let target = findAnimalTarget(world, origin, direction, 5.5);
  if (!target && pets > 0) {
    let closest = 3;
    for (const entity of world.query(Animal, AnimalPosition, AnimalHealth)) {
      const health = entity.get(AnimalHealth)!.value;
      const distance = entity.get(AnimalPosition)!.distanceTo(player);
      if (health <= 0 || distance >= closest) continue;
      closest = distance;
      target = { entity, kind: entity.get(Animal)!.kind, health, distance };
    }
  }
  if (!target || target.health <= 0) return false;
  if (pets > 0) return petAnimal(world, target.entity);
  const rest = target.entity.get(AnimalRest);
  if (rest?.sleeping) {
    if (!isOwnTamedAnimal(target.entity)) {
      useGameStore.getState().setNotice(translate('Cet animal appartient déjà à un autre joueur.', 'This animal already belongs to another player.', 'Este animal ya pertenece a otro jugador.'));
      return true;
    }
    if (isNight(world)) {
      useGameStore.getState().setNotice(translate('Cet animal dort. Reviens le réveiller le matin.', 'This animal is sleeping. Come back to wake it in the morning.'));
      return true;
    }
    wakeTamedAnimal(world, target.entity);
    useGameStore.getState().setNotice(translate('Ton animal est réveillé !', 'Your animal is awake!'));
    return true;
  }
  if (typeof selected === 'string' && ['sword', 'bow', 'gun'].includes(getItemMeta(selected).category)) return false;
  if (isTamedAnimal(target.entity) && !canFeedAnimal(target.kind, selected)) {
    if (!isOwnTamedAnimal(target.entity)) {
      useGameStore.getState().setNotice(translate('Cet animal appartient déjà à un autre joueur.', 'This animal already belongs to another player.', 'Este animal ya pertenece a otro jugador.'));
      return true;
    }
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
