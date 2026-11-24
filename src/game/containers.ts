import type { World } from 'koota';
import type { AnimalKind } from './animals';
import { getBlockIndex, replaceVoxel } from './chunks';
import { requestPlay } from './input';
import { selectionInfo } from './items';
import type { SelectedKind } from './items';
import { useGameStore } from './store';
import { changeInventory } from './inventory';
import { voxelKey } from './voxel';
import type { VoxelHit } from './voxel';
import { translate } from './language';

function hitAt(block: import('./voxel').Voxel): VoxelHit {
  return { block, x: block.x, y: block.y, z: block.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 };
}

export function openChest(world: World, hit: VoxelHit) {
  const block = getBlockIndex(world).get(voxelKey(hit.x, hit.y, hit.z));
  if (!block) return;
  useGameStore.getState().openContainer('chest', block, block.items ?? []);
  if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
}

export function openFurnace(hit: VoxelHit) {
  useGameStore.getState().openContainer('furnace', hit.block);
  useGameStore.getState().setNotice(translate('Choisis une viande à cuire.', 'Choose meat to cook.'));
  if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
}

export function closeContainer() {
  useGameStore.getState().closeContainer();
  void requestPlay();
}

function updateChest(world: World, items: SelectedKind[]) {
  const store = useGameStore.getState();
  const container = store.container;
  if (!container || container.type !== 'chest') return;
  const block = getBlockIndex(world).get(voxelKey(container.x, container.y, container.z));
  if (!block) return;
  replaceVoxel(world, hitAt(block), block.kind, undefined, undefined, items);
  store.openContainer('chest', block, items);
}

export function depositChest(world: World) {
  const store = useGameStore.getState();
  if (store.container?.type !== 'chest') return;
  const item = store.selected;
  if (!store.chestItems.includes(item) && new Set(store.chestItems).size >= 24) {
    store.setNotice(translate('Ce coffre est plein.', 'This chest is full.'));
    return;
  }
  updateChest(world, [...store.chestItems, item]);
  store.setNotice(translate(`${selectionInfo(item).name} déposé dans le coffre.`, `${selectionInfo(item).name} deposited in chest.`));
}

export function withdrawChest(world: World, index: number) {
  const store = useGameStore.getState();
  if (store.container?.type !== 'chest') return;
  const item = store.chestItems[index];
  if (item === undefined) return;
  const items = store.chestItems.filter((_, itemIndex) => itemIndex !== index);
  const existingSlot = store.hotbarSlots.indexOf(item);
  const slot = existingSlot >= 0 ? existingSlot : store.hotbarSlots.findIndex((kind) => kind === null);
  changeInventory(item, 1);
  updateChest(world, items);
  store.setNotice(slot >= 0 ? translate(`${selectionInfo(item).name} ajouté à la case ${slot === 9 ? '0' : slot + 1}.`, `${selectionInfo(item).name} added to slot ${slot === 9 ? '0' : slot + 1}.`) : translate(`${selectionInfo(item).name} ajouté au sac.`, `${selectionInfo(item).name} added to backpack.`));
}

export function cookMeat(kind: AnimalKind) {
  const store = useGameStore.getState();
  if (store.meat[kind] <= 0) {
    store.setNotice(translate('Il n’y a pas cette viande dans le sac.', 'This meat is not in the backpack.'));
    return;
  }
  store.discardMeat(kind);
  changeInventory('cooked_meat', 1);
  store.setNotice(translate('Viande cuite ajoutée au sac. Elle rend 4 vies.', 'Cooked meat added to backpack. It restores 4 lives.'));
}
