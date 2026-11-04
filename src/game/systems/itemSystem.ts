import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { findAnimalTarget } from '../combat';
import { addVoxel, getBlockIndex, removeVoxel } from '../chunks';
import { consumeActions, isDown, isMouseButtonDown } from '../input';
import { getItemMeta } from '../items';
import { isGalleryItem } from '../galleryCatalog';
import { useGalleryItem } from '../galleryActions';
import { useFood } from '../foods';
import { hasInventory } from '../inventory';
import { MAX_BUILD_Y, MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { useGameStore } from '../store';
import { HorseRider, Player, PlayerPosition, Vehicle, VehicleMotion, VehiclePosition } from '../traits';
import { groundAt, spawnVehicle } from '../vehicles';
import { BlockKind, isWaterBlock, raycastVoxel, voxelKey } from '../voxel';
import { fireProjectile } from './projectileSystem';
import { isPaintballGun, paintballColor } from '../paintball';

export { eatItem, eatMeat } from '../foods';

const cooldowns = new WeakMap<World, number>();
const origin = new Vector3();
const direction = new Vector3();

function changeHeldBucket(from: 'bucket' | 'water_bucket', to: 'bucket' | 'water_bucket') {
  const store = useGameStore.getState();
  const slot = store.hotbarSlots.indexOf(from);
  const replaceHeld = store.gameplayMode !== 'survival' || (store.itemCounts[from] ?? 0) === 1;
  if (store.gameplayMode === 'survival') {
    store.setItemCount(from, (store.itemCounts[from] ?? 0) - 1);
    store.setItemCount(to, (store.itemCounts[to] ?? 0) + 1);
  }
  if (!replaceHeld) return;
  if (slot >= 0) store.setHotbarSlot(slot, to);
  else store.selectBlock(to);
}

function useBucket(world: World, filled: boolean, origin: Vector3, direction: Vector3) {
  const store = useGameStore.getState();
  const blocks = getBlockIndex(world);
  const hit = raycastVoxel(blocks, origin, direction, 6, !filled);
  if (filled) {
    if (hit) {
      const x = hit.x + hit.normal.x;
      const y = hit.y + hit.normal.y;
      const z = hit.z + hit.normal.z;
      if (y >= MIN_WORLD_Y && y <= MAX_BUILD_Y && !blocks.has(voxelKey(x, y, z)) && addVoxel(world, x, y, z, BlockKind.Water)) {
        changeHeldBucket('water_bucket', 'bucket');
        store.setNotice('Eau posée. Le sceau est vide.');
        return true;
      }
    }
    store.setNotice('Vise un bloc avec le sceau plein pour y poser l’eau.');
    return true;
  }
  if (hit && isWaterBlock(hit.block.kind)) {
    removeVoxel(world, hit);
    if (!blocks.has(voxelKey(hit.x, hit.y, hit.z))) {
      changeHeldBucket('bucket', 'water_bucket');
      store.setNotice('Sceau rempli d’eau. Utilise-le ailleurs pour la poser.');
      return true;
    }
    store.setNotice('Tu ne peux pas récupérer cette eau ici.');
    return true;
  }
  store.setNotice('Vise un bloc d’eau avec le sceau vide.');
  return true;
}

export function itemSystem(world: World, camera: Camera, dt: number, pendingActions?: { place: number; harvest: number }) {
  const cooldown = Math.max(0, (cooldowns.get(world) ?? 0) - dt);
  cooldowns.set(world, cooldown);
  const store = useGameStore.getState();
  const selected = store.selected;
  if (!hasInventory(selected, store)) {
    store.setNotice('Récolte et fabrique cet objet avant de l’utiliser.');
    return true;
  }
  if (typeof selected === 'number') return false;
  const meta = getItemMeta(selected);
  const actions = pendingActions ?? consumeActions();
  const interact = actions.place + actions.harvest;
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return false;
  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);

  if (useFood(world, selected, origin, direction, interact)) return true;
  if ((selected === 'bucket' || selected === 'water_bucket') && interact > 0) return useBucket(world, selected === 'water_bucket', origin, direction);

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
  if ((meta.category === 'bow' || meta.category === 'gun') && (interact > 0 || isMouseButtonDown(0) || (meta.category === 'gun' && isDown('KeyE'))) && cooldown <= 0) {
    fireProjectile(world, origin, direction, meta.category === 'bow' ? 'arrow' : meta.shape === 'rpg' || selected === 'pistol_bomb' ? 'bomb' : 'bullet', meta.damage, paintballColor(selected));
    cooldowns.set(world, isPaintballGun(selected) ? 0.08 : meta.cooldown ?? 0.5);
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
    const nearby = world.query(Vehicle, VehiclePosition, VehicleMotion).some((entity) => entity.get(VehiclePosition)!.distanceTo(player) < 6);
    if (nearby) return false;
    const blocks = getBlockIndex(world);
    const kind = selected === 'plane' ? 'plane' : selected === 'train' ? 'train' : selected === 'boat' || meta.shape === 'boat' || meta.shape === 'hovercraft' ? 'boat' : 'car';
    if (kind === 'boat') {
      for (let distance = 1; distance <= 6; distance += 0.5) {
        const x = Math.round(origin.x + direction.x * distance);
        const z = Math.round(origin.z + direction.z * distance);
        if (!isWaterBlock(blocks.get(voxelKey(x, SEA_LEVEL, z))?.kind)) continue;
        if (groundAt(world, x, z, SEA_LEVEL) >= SEA_LEVEL) continue;
        spawnVehicle(world, 'boat', x, SEA_LEVEL + 0.55, z, meta.color);
        useGameStore.getState().setNotice('Bateau prêt ! E : choisis le siège avant pour conduire ou l’arrière pour être passager.');
        return true;
      }
      useGameStore.getState().setNotice('Vise une rivière ou un lac pour poser le bateau sur l’eau.');
      return true;
    }
    const hit = raycastVoxel(blocks, origin, direction, 6);
    const x = hit ? hit.x + hit.normal.x * 1.5 : player.x + direction.x * 3;
    const z = hit ? hit.z + hit.normal.z * 1.5 : player.z + direction.z * 3;
    const ground = groundAt(world, x, z, player.y + 4);
    if (ground <= SEA_LEVEL) {
      useGameStore.getState().setNotice('La voiture doit être posée sur la terre ferme.');
      return true;
    }
    spawnVehicle(world, kind, x, ground, z, meta.color);
    useGameStore.getState().setNotice(`${kind === 'plane' ? 'Avion' : kind === 'train' ? 'Train' : 'Voiture'} prêt ! Approche-toi et appuie sur E pour choisir ta place.`);
    return true;
  }
  if (isGalleryItem(selected) && meta.category === 'resource' && interact > 0) return useGalleryItem(world, selected, origin, direction);
  return false;
}
