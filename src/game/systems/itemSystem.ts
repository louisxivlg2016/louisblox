import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { findAnimalTarget } from '../combat';
import { getBlockIndex } from '../chunks';
import { consumeActions, isMouseDown } from '../input';
import { getItemMeta } from '../items';
import type { GalleryItemId, ItemKind } from '../items';
import { SEA_LEVEL } from '../levels';
import { useGameStore } from '../store';
import { HorseRider, Player, PlayerHealth, PlayerPosition } from '../traits';
import { groundAt, spawnVehicle } from '../vehicles';
import { raycastVoxel } from '../voxel';
import { fireProjectile } from './projectileSystem';

const cooldowns = new WeakMap<World, number>();
const origin = new Vector3();
const direction = new Vector3();

export function eatItem(world: World, kind: ItemKind | GalleryItemId) {
  const meta = getItemMeta(kind);
  const store = useGameStore.getState();
  if (meta.category !== 'food') return false;
  const count = kind === 'apple' ? store.apples : store.itemCounts[kind] ?? 1;
  if (count <= 0) {
    store.setNotice(kind === 'apple' ? 'Cueille des pommes avec E sur un arbre de prairie.' : `Plus de ${meta.name.toLowerCase()}.`);
    return false;
  }
  const player = world.queryFirst(Player);
  const health = player?.get(PlayerHealth);
  if (!player || !health) return false;
  if (health.value >= health.max) {
    store.setNotice('Toutes tes vies sont déjà récupérées.');
    return false;
  }
  const value = Math.min(health.max, health.value + (meta.healing ?? 1));
  player.set(PlayerHealth, { value });
  store.setLives(value);
  if (kind === 'apple') store.discardApple();
  else store.setItemCount(kind, count - 1);
  store.setNotice(`${meta.name} : +${value - health.value} vie${value - health.value > 1 ? 's' : ''}`);
  return true;
}

export function eatMeat(world: World, kind: import('../animals').AnimalKind) {
  const store = useGameStore.getState();
  const health = world.queryFirst(Player)?.get(PlayerHealth);
  if (!health || store.meat[kind] <= 0) return false;
  if (health.value >= health.max) {
    store.setNotice('Toutes tes vies sont déjà récupérées.');
    return false;
  }
  const value = Math.min(health.max, health.value + 2);
  world.queryFirst(Player)!.set(PlayerHealth, { value });
  store.discardMeat(kind);
  store.setLives(value);
  store.setNotice(`Viande mangée : +${value - health.value} vies`);
  return true;
}

export function itemSystem(world: World, camera: Camera, dt: number, pendingActions?: { place: number; harvest: number }) {
  const cooldown = Math.max(0, (cooldowns.get(world) ?? 0) - dt);
  cooldowns.set(world, cooldown);
  const selected = useGameStore.getState().selected;
  if (typeof selected === 'number') return false;
  const meta = getItemMeta(selected);
  const actions = pendingActions ?? consumeActions();
  const interact = actions.place + actions.harvest;
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return false;
  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);

  if (meta.shape === 'book' && interact > 0) {
    useGameStore.getState().setBookOpen(true);
    useGameStore.getState().setMode('pause');
    if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
    return true;
  }
  if (meta.category === 'armor' && interact > 0) {
    const store = useGameStore.getState();
    const armor = store.equippedArmor === meta.armor ? null : meta.armor ?? null;
    store.equipArmor(armor);
    store.setNotice(armor ? `${meta.name} équipée.` : 'Armure retirée dans le sac.');
    return true;
  }
  if (meta.category === 'food' && interact > 0) {
    eatItem(world, selected);
    return true;
  }
  if ((meta.category === 'bow' || meta.category === 'gun') && (interact > 0 || isMouseDown(0)) && cooldown <= 0) {
    fireProjectile(world, origin, direction, meta.category === 'bow' ? 'arrow' : meta.shape === 'rpg' || selected === 'pistol_bomb' ? 'bomb' : 'bullet');
    cooldowns.set(world, meta.cooldown ?? 0.5);
    return true;
  }
  if (meta.category === 'saddle' && interact > 0) {
    const target = findAnimalTarget(world, origin, direction, 5.5);
    if (target?.kind === 'horse') {
      const rider = target.entity.get(HorseRider);
      if (rider) target.entity.set(HorseRider, { saddled: true });
      else target.entity.add(HorseRider({ saddled: true }));
      useGameStore.getState().setNotice('Selle installée ! Appuie sur E près du cheval pour le monter.');
    } else {
      useGameStore.getState().setNotice('Vise un cheval pour installer la selle.');
    }
    return true;
  }
  if (meta.category === 'vehicle' && interact > 0) {
    const hit = raycastVoxel(getBlockIndex(world), origin, direction, 6);
    const x = hit ? hit.x + hit.normal.x * 1.5 : player.x + direction.x * 3;
    const z = hit ? hit.z + hit.normal.z * 1.5 : player.z + direction.z * 3;
    const ground = groundAt(world, x, z, player.y + 4);
    if (ground <= SEA_LEVEL) {
      useGameStore.getState().setNotice('La voiture doit être posée sur la terre ferme.');
      return true;
    }
    const kind = selected === 'plane' ? 'plane' : selected === 'train' ? 'train' : 'car';
    spawnVehicle(world, kind, x, ground, z, meta.color);
    useGameStore.getState().setNotice(`${kind === 'plane' ? 'Avion' : kind === 'train' ? 'Train' : 'Voiture'} prêt ! Approche-toi et appuie sur E pour choisir ta place.`);
    return true;
  }
  return false;
}
