import type { World } from 'koota';
import type { AnimalKind } from './animals';
import { getBlockIndex, replaceVoxel } from './chunks';
import { requestPlay } from './input';
import { selectionInfo } from './items';
import type { SelectedKind } from './items';
import { useGameStore } from './store';
import { voxelKey } from './voxel';
import type { VoxelHit } from './voxel';

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
  useGameStore.getState().setNotice('Choisis une viande à cuire.');
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
  if (store.chestItems.length >= 24) {
    store.setNotice('Ce coffre est plein.');
    return;
  }
  const item = store.selected;
  updateChest(world, [...store.chestItems, item]);
  store.setNotice(`${selectionInfo(item).name} déposé dans le coffre.`);
}

export function withdrawChest(world: World, index: number) {
  const store = useGameStore.getState();
  if (store.container?.type !== 'chest') return;
  const item = store.chestItems[index];
  if (item === undefined) return;
  const items = store.chestItems.filter((_, itemIndex) => itemIndex !== index);
  const slot = Math.max(0, store.hotbarSlots.indexOf(store.selected));
  store.setHotbarSlot(slot, item);
  updateChest(world, items);
  store.setNotice(`${selectionInfo(item).name} ajouté à la case ${slot === 9 ? '0' : slot + 1}.`);
}

export function cookMeat(kind: AnimalKind) {
  const store = useGameStore.getState();
  if (store.meat[kind] <= 0) {
    store.setNotice('Il n’y a pas cette viande dans le sac.');
    return;
  }
  store.discardMeat(kind);
  store.setItemCount('cooked_meat', store.itemCounts.cooked_meat + 1);
  store.setNotice('Viande cuite ajoutée au sac. Elle rend 4 vies.');
}
