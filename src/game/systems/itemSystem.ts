import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { findAnimalTarget } from '../combat';
import { addVoxel, getBlockIndex } from '../chunks';
import { consumeActions, isDown, isMouseButtonDown } from '../input';
import { getItemMeta, storedAnimalIdFromSelection } from '../items';
import { releaseStoredAnimal } from '../taming';
import { isGalleryItem } from '../galleryCatalog';
import { hasWaterOpening } from '../extraBlocks';
import { useGalleryItem, useShears } from '../galleryActions';
import { useFood } from '../foods';
import { changeInventory, hasInventory } from '../inventory';
import { MAX_BUILD_Y, MIN_WORLD_Y, SEA_LEVEL } from '../levels';
import { useGameStore } from '../store';
import { HorseRider, Player, PlayerPosition, Vehicle, VehicleMotion, VehiclePosition } from '../traits';
import { groundAt, spawnVehicle } from '../vehicles';
import { BlockKind, isWaterBlock, raycastVoxel, voxelKey } from '../voxel';
import { fireProjectile } from './projectileSystem';
import { clearAllPaint, isPaintballGun, paintballColor } from '../paintball';
import { drawPaintStroke, endPaintStroke } from '../paintStrokes';
import { drainConnectedWater } from './waterSystem';
import { tryFireBombLauncher, updateBombLauncher } from '../weaponAmmo';
import { useFireExtinguisher } from '../extinguisher';
import { translate } from '../language';

export { eatItem, eatMeat } from '../foods';

const cooldowns = new WeakMap<World, number>();
const origin = new Vector3();
const direction = new Vector3();

function changeHeldBucket(from: 'bucket' | 'water_bucket', to: 'bucket' | 'water_bucket') {
  const store = useGameStore.getState();
  const slot = store.hotbarSlots.indexOf(from);
  const replaceHeld = store.gameplayMode !== 'survival' || (store.itemCounts[from] ?? 0) === 1;
  if (store.gameplayMode === 'survival') {
    changeInventory(from, -1);
    changeInventory(to, 1);
  }
  if (!replaceHeld) return;
  if (slot >= 0) store.setHotbarSlot(slot, to);
  else store.selectBlock(to);
}

function useBucket(world: World, filled: boolean, origin: Vector3, direction: Vector3, alwaysEmpty = false, drain = true) {
  const store = useGameStore.getState();
  const blocks = getBlockIndex(world);
  const hit = raycastVoxel(blocks, origin, direction, 6, true);
  if (alwaysEmpty && drain && hit && (isWaterBlock(hit.block.kind) || hit.block.waterlogged === true)) {
    const drained = drainConnectedWater(world, hit);
    store.setNotice(drained > 0 ? translate(`Eau retirée (${drained} blocs). Le seau reste toujours vide.`, `Water removed (${drained} blocks). The bucket remains empty.`) : translate('Tu ne peux pas récupérer cette eau ici.', 'You cannot collect this water here.'));
    return true;
  }
  if (filled) {
    if (hit) {
      const fillingOpening = hasWaterOpening(hit.block) && !hit.block.waterlogged;
      const x = hit.x + (fillingOpening ? 0 : hit.normal.x);
      const y = hit.y + (fillingOpening ? 0 : hit.normal.y);
      const z = hit.z + (fillingOpening ? 0 : hit.normal.z);
      if (y >= MIN_WORLD_Y && y <= MAX_BUILD_Y && (fillingOpening || !blocks.has(voxelKey(x, y, z))) && addVoxel(world, x, y, z, BlockKind.CalmWater)) {
        if (!alwaysEmpty) changeHeldBucket('water_bucket', 'bucket');
        store.setNotice(alwaysEmpty ? translate('Eau posée. Le seau reste toujours vide.', 'Water placed. The bucket remains empty.') : translate('Tout le contenu du seau est vidé : 1 bloc d’eau calme, sans inondation.', 'The bucket is emptied: 1 calm water block, without flooding.'));
        return true;
      }
    }
    store.setNotice(alwaysEmpty ? translate('Vise un bloc avec le seau toujours vide pour poser de l’eau.', 'Aim at a block with the always-empty bucket to place water.') : translate('Vise un bloc avec le seau plein pour y poser l’eau.', 'Aim at a block with the full bucket to place water.'));
    return true;
  }
  if (hit && (isWaterBlock(hit.block.kind) || hit.block.waterlogged === true)) {
    const drained = drainConnectedWater(world, hit);
    if (drained > 0) {
      changeHeldBucket('bucket', 'water_bucket');
      store.setNotice(translate(`Toute l’eau connectée a été retirée d’un coup : ${drained} blocs. Le seau est plein.`, `All connected water was removed at once: ${drained} blocks. The bucket is full.`));
      return true;
    }
    store.setNotice(translate('Tu ne peux pas récupérer cette eau ici.', 'You cannot collect this water here.'));
    return true;
  }
  store.setNotice(translate('Vise un bloc d’eau avec le seau vide pour retirer toute l’eau connectée.', 'Aim at a water block with the empty bucket to remove all connected water.'));
  return true;
}

export function itemSystem(world: World, camera: Camera, dt: number, pendingActions?: { place: number; harvest: number; tap: number; interact?: number }) {
  updateBombLauncher();
  const cooldown = Math.max(0, (cooldowns.get(world) ?? 0) - dt);
  cooldowns.set(world, cooldown);
  const store = useGameStore.getState();
  const selected = store.selected;
  if (!hasInventory(selected, store)) {
    store.setNotice(translate('Récolte et fabrique cet objet avant de l’utiliser.', 'Gather and craft this item before using it.'));
    return true;
  }
  if (typeof selected === 'number') return false;
  const meta = getItemMeta(selected);
  const actions = pendingActions ?? consumeActions();
  const interact = actions.place + actions.harvest + actions.tap + (actions.interact ?? 0);
  const storedAnimalId = storedAnimalIdFromSelection(selected);
  if (storedAnimalId) {
    if (interact > 0) void releaseStoredAnimal(world, storedAnimalId);
    return true;
  }
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return false;
  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);

  if (useFood(world, selected as Parameters<typeof useFood>[1], origin, direction, interact)) return true;
  if (meta.shape === 'shears' && interact > 0) return useShears(world, origin, direction);
  if (selected === 'paint_cleaning_bucket' && interact > 0) {
    const removed = clearAllPaint(world);
    store.setNotice(removed > 0 ? translate(`Tous les dessins ont été effacés (${removed} traits).`, `All drawings were erased (${removed} strokes).`) : translate('Il n’y a aucun dessin à effacer.', 'There are no drawings to erase.'));
    return true;
  }
  if (selected === 'empty_bucket' && interact > 0) return useBucket(world, false, origin, direction, true, true);
  if ((selected === 'bucket' || selected === 'water_bucket') && interact > 0) return useBucket(world, selected === 'water_bucket', origin, direction);
  if (selected === 'extinguisher' && (interact > 0 || isMouseButtonDown(0) || isDown('KeyE')) && cooldown <= 0) {
    useFireExtinguisher(world, origin, direction);
    cooldowns.set(world, 0.3);
    return true;
  }

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
    store.setNotice(armor ? translate(`${meta.name} équipée.`, `${meta.name} equipped.`) : translate('Armure retirée dans le sac.', 'Armor removed and stored in backpack.'));
    return true;
  }
  if (isPaintballGun(selected)) {
    if (interact > 0 || isMouseButtonDown(0) || isDown('KeyE')) drawPaintStroke(world, origin, direction, paintballColor(selected)!);
    else endPaintStroke(world);
    return true;
  }
  endPaintStroke(world);
  const singleShot = meta.shape === 'rpg' || selected === 'pistol_bomb';
  const firing = singleShot ? interact > 0 || actions.tap > 0 : interact > 0 || isMouseButtonDown(0) || (meta.category === 'gun' && isDown('KeyE'));
  if ((meta.category === 'bow' || meta.category === 'gun') && firing && cooldown <= 0) {
    if (selected === 'pistol_bomb' && !tryFireBombLauncher()) return true;
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
      useGameStore.getState().setNotice(translate('Selle installée ! Appuie sur E près du cheval pour le monter.', 'Saddle installed! Press E near the horse to mount it.'));
    } else {
      useGameStore.getState().setNotice(translate('Vise un cheval pour installer la selle.', 'Aim at a horse to install the saddle.'));
    }
    return true;
  }
  if (selected === 'wool' && interact > 0) {
    const blocks = getBlockIndex(world);
    const hit = raycastVoxel(blocks, origin, direction, 6);
    if (!hit) return true;
    const placed = addVoxel(world, hit.x + hit.normal.x, hit.y + hit.normal.y, hit.z + hit.normal.z, BlockKind.ConcreteWhite);
    if (placed) changeInventory('wool', -1);
    return true;
  }
  if (meta.category === 'vehicle' && interact > 0) {
    const nearby = world.query(Vehicle, VehiclePosition, VehicleMotion).some((entity) => entity.get(VehiclePosition)!.distanceTo(player) < 2);
    if (nearby) return false;
    const blocks = getBlockIndex(world);
    const kind = selected === 'plane' ? 'plane' : selected === 'train' ? 'train' : selected === 'metro' ? 'metro' : selected === 'boat' || meta.shape === 'boat' || meta.shape === 'hovercraft' ? 'boat' : selected === 'jeep' ? 'jeep' : selected === 'police_car' ? 'police' : selected === 'firetruck' ? 'firetruck' : selected === 'carriage' ? 'carriage' : selected === 'cannon' ? 'cannon' : 'car';
    if (kind === 'boat') {
      for (let distance = 1; distance <= 6; distance += 0.5) {
        const x = Math.round(origin.x + direction.x * distance);
        const z = Math.round(origin.z + direction.z * distance);
        if (!isWaterBlock(blocks.get(voxelKey(x, SEA_LEVEL, z))?.kind)) continue;
        if (groundAt(world, x, z, SEA_LEVEL) >= SEA_LEVEL) continue;
        spawnVehicle(world, 'boat', x, SEA_LEVEL + 0.55, z, meta.color);
        useGameStore.getState().setNotice(translate('Bateau prêt ! E : choisis le siège avant pour conduire ou l’arrière pour être passager.', 'Boat ready! E: choose the front seat to drive or the back seat to be a passenger.'));
        return true;
      }
      useGameStore.getState().setNotice(translate('Vise une rivière ou un lac pour poser le bateau sur l’eau.', 'Aim at a river or lake to place the boat on water.'));
      return true;
    }
    const hit = raycastVoxel(blocks, origin, direction, 6);
    const x = hit ? hit.x + hit.normal.x * 1.5 : player.x + direction.x * 3;
    const z = hit ? hit.z + hit.normal.z * 1.5 : player.z + direction.z * 3;
    const y = hit ? hit.y + hit.normal.y * 1.5 : player.y + direction.y * 3;
    spawnVehicle(world, kind, x, y, z, meta.color, 0, undefined, true);
    useGameStore.getState().setNotice(translate(`${kind === 'plane' ? 'Avion' : kind === 'train' ? 'Train' : kind === 'metro' ? 'Métro' : 'Voiture'} prêt ! Approche-toi et appuie sur E pour choisir ta place.`, `${kind === 'plane' ? 'Airplane' : kind === 'train' ? 'Train' : kind === 'metro' ? 'Metro' : 'Vehicle'} ready! Come closer and press E to choose your seat.`));
    return true;
  }
  if (isGalleryItem(selected) && meta.category === 'resource' && interact > 0) return useGalleryItem(world, selected, origin, direction);
  return false;
}
