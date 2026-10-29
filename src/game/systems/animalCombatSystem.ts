import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { damageAnimal, findAnimalTarget } from '../combat';
import { isMouseDown, stopMining } from '../input';
import { isSword, ITEM_META } from '../items';
import { useGameStore } from '../store';
import { Player, PlayerPosition } from '../traits';

const direction = new Vector3();
const origin = new Vector3();
const cooldowns = new WeakMap<World, number>();

export function animalCombatSystem(world: World, camera: Camera, dt: number, touchTaps = 0) {
  const cooldown = Math.max(0, (cooldowns.get(world) ?? 0) - dt);
  cooldowns.set(world, cooldown);
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const selected = useGameStore.getState().selected;
  if (!player || (touchTaps === 0 && typeof selected === 'string' && !isSword(selected))) return false;
  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);
  const target = findAnimalTarget(world, origin, direction);
  if (!target) return false;
  if (touchTaps > 0) {
    if (damageAnimal(world, target.entity, target.health, player)) stopMining();
    cooldowns.set(world, 0.35);
  } else if (isMouseDown(0) && cooldown <= 0) {
    if (damageAnimal(world, target.entity, 1, player)) stopMining();
    cooldowns.set(world, typeof selected === 'string' ? ITEM_META[selected].cooldown ?? 0.35 : 0.35);
  }
  return true;
}
