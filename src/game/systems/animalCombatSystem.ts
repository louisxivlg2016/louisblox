import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { damageAnimal, findAnimalTarget } from '../combat';
import { findBattleTarget } from '../battleCombat';
import { requestBattleHit } from '../battle';
import { isMouseDown, stopMining } from '../input';
import { getItemMeta, isSword } from '../items';
import { hasInventory } from '../inventory';
import { useGameStore } from '../store';
import { Player, PlayerPosition } from '../traits';

const direction = new Vector3();
const origin = new Vector3();
const cooldowns = new WeakMap<World, number>();

export function animalCombatSystem(world: World, camera: Camera, dt: number, touchTaps = 0) {
  const cooldown = Math.max(0, (cooldowns.get(world) ?? 0) - dt);
  cooldowns.set(world, cooldown);
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const store = useGameStore.getState();
  const selected = store.selected;
  if (!hasInventory(selected, store)) return false;
  if (!player || (touchTaps === 0 && typeof selected === 'string' && selected !== 'hand' && !isSword(selected))) return false;
  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);
  const enemy = findBattleTarget(world, origin, direction, 4.5);
  if (enemy) {
    if ((touchTaps > 0 || isMouseDown(0)) && cooldown <= 0) {
      requestBattleHit(enemy.playerId, 'melee');
      cooldowns.set(world, typeof selected === 'string' ? getItemMeta(selected).cooldown ?? 0.35 : 0.35);
    }
    return true;
  }
  const target = findAnimalTarget(world, origin, direction);
  if (!target) return false;
  if (touchTaps > 0) {
    if (damageAnimal(world, target.entity, target.health, player)) stopMining();
    cooldowns.set(world, 0.35);
  } else if (isMouseDown(0) && cooldown <= 0) {
    if (damageAnimal(world, target.entity, 1, player)) stopMining();
    cooldowns.set(world, typeof selected === 'string' ? getItemMeta(selected).cooldown ?? 0.35 : 0.35);
  }
  return true;
}
