import type { World } from 'koota';
import { Euler, Vector3 } from 'three';
import { addVoxel, getBlockIndex, removeVoxel } from './chunks';
import { healPlayer } from './effects';
import { useEatingStore } from './eating';
import { changeInventory } from './inventory';
import { getItemMeta, isSelectedKind, selectionInfo } from './items';
import type { GalleryItemId, ItemKind } from './items';
import { MAX_BUILD_Y, MIN_WORLD_Y } from './levels';
import { MEAT_NAMES } from './meats';
import type { AnimalKind } from './animals';
import { useGameStore } from './store';
import { Player, PlayerHealth, PlayerPosition, PlayerState } from './traits';
import { BlockKind, raycastVoxel, voxelKey } from './voxel';
import type { VoxelHit } from './voxel';
import { playSound } from './audio';

export function eatItem(world: World, kind: ItemKind | GalleryItemId) {
  const meta = getItemMeta(kind);
  const store = useGameStore.getState();
  if (meta.category !== 'food') return false;
  const count = kind === 'apple' ? store.apples : store.itemCounts[kind] ?? 1;
  if (count <= 0) {
    store.setNotice(kind === 'apple' ? 'Cueille des pommes avec E sur un arbre de prairie.' : `Plus de ${meta.name.toLowerCase()}.`);
    return false;
  }
  const health = world.queryFirst(Player)?.get(PlayerHealth);
  if (!health) return false;
  const healing = Math.min(health.max - health.value, meta.healing ?? 1);
  if (healing > 0) healPlayer(world, healing);
  if (store.gameplayMode === 'survival') {
    if (kind === 'apple') store.discardApple();
    else store.setItemCount(kind, count - 1);
  }
  store.setNotice(healing > 0 ? `${meta.name} : +${healing} vie${healing > 1 ? 's' : ''}` : kind === 'apple' ? 'Pomme mangée.' : `${meta.name} mangé.`);
  playSound('eat', 0.45);
  useEatingStore.getState().startEating(kind);
  return true;
}

export function eatMeat(world: World, kind: AnimalKind) {
  const store = useGameStore.getState();
  const health = world.queryFirst(Player)?.get(PlayerHealth);
  if (!health || store.meat[kind] <= 0) return false;
  const healing = Math.min(health.max - health.value, 2);
  if (healing > 0) healPlayer(world, healing);
  store.discardMeat(kind);
  store.setNotice(healing > 0 ? `Viande mangée : +${healing} vie${healing > 1 ? 's' : ''}` : 'Viande mangée.');
  playSound('eat', 0.45);
  useEatingStore.getState().startEating('cooked_meat');
  return true;
}

export function pickUpFood(world: World, hit: VoxelHit) {
  if (hit.block.kind !== BlockKind.Food) return false;
  const { food, meat } = hit.block;
  removeVoxel(world, hit);
  if (getBlockIndex(world).has(voxelKey(hit.x, hit.y, hit.z))) return false;
  const store = useGameStore.getState();
  if (meat) store.collectMeat(meat);
  else if (food === 'apple') store.collectApple();
  else if (food !== undefined && isSelectedKind(food)) changeInventory(food, 1);
  const name = meat ? MEAT_NAMES[meat] : food !== undefined && isSelectedKind(food) ? selectionInfo(food).name : 'Nourriture';
  store.setNotice(`${name} récupéré.`);
  return true;
}

function foodSurface(world: World, hit: VoxelHit | null) {
  if (!hit || hit.normal.y !== 1) return null;
  const y = hit.y + 1;
  if (y < MIN_WORLD_Y || y > MAX_BUILD_Y || getBlockIndex(world).has(voxelKey(hit.x, y, hit.z))) return null;
  return { x: hit.x, y, z: hit.z };
}

export function useFood(world: World, selected: ItemKind | GalleryItemId, origin: Vector3, direction: Vector3, interact: number) {
  if (interact <= 0) return false;
  const hit = raycastVoxel(getBlockIndex(world), origin, direction, 6);
  if (hit?.block.kind === BlockKind.Food) return pickUpFood(world, hit);
  if (getItemMeta(selected).category !== 'food') return false;
  const surface = foodSurface(world, hit);
  if (surface) {
    const placed = addVoxel(world, surface.x, surface.y, surface.z, BlockKind.Food, undefined, undefined, 0, selected);
    if (placed) {
      const store = useGameStore.getState();
      if (store.gameplayMode === 'survival') {
        if (selected === 'apple') store.discardApple();
        else changeInventory(selected, -1);
      }
      store.setNotice(`${getItemMeta(selected).name} posé. Vise-le avec E pour le reprendre.`);
    }
    return true;
  }
  if (hit) {
    useGameStore.getState().setNotice('Vise le dessus libre d’un bloc pour poser la nourriture.');
    return true;
  }
  eatItem(world, selected);
  return true;
}

export function placeMeat(world: World, kind: AnimalKind) {
  const store = useGameStore.getState();
  if (store.meat[kind] <= 0) {
    store.setNotice('Tu n’as pas cette viande dans ton sac.');
    return false;
  }
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return false;
  const state = world.queryFirst(Player)?.get(PlayerState);
  const origin = player.clone();
  origin.y += 1.62;
  const direction = new Vector3(0, 0, -1).applyEuler(new Euler(state?.pitch ?? 0, state?.yaw ?? 0, 0, 'YXZ'));
  const surface = foodSurface(world, raycastVoxel(getBlockIndex(world), origin, direction, 6));
  if (!surface) {
    store.setNotice('Vise le dessus libre d’un bloc pour poser cette viande.');
    return false;
  }
  const placed = addVoxel(world, surface.x, surface.y, surface.z, BlockKind.Food, undefined, undefined, 0, undefined, kind);
  if (!placed) return false;
  store.discardMeat(kind);
  store.setNotice(`${MEAT_NAMES[kind]} posée. Vise-la avec E pour la reprendre.`);
  return true;
}
