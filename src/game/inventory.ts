import type { BlockKind } from './voxel';
import type { SelectedKind } from './items';
import { useGameStore } from './store';

export type InventoryState = {
  gameplayMode: 'survival' | 'creative';
  itemCounts: Record<string, number>;
};

export const inventoryKey = (kind: SelectedKind) => typeof kind === 'number' ? `block_${kind}` : kind;

export function inventoryCount(kind: SelectedKind, state: InventoryState) {
  return state.itemCounts[inventoryKey(kind)] ?? 0;
}

export function hasInventory(kind: SelectedKind, state: InventoryState) {
  return state.gameplayMode === 'creative' || kind === 'hand' || inventoryCount(kind, state) > 0;
}

export function changeInventory(kind: SelectedKind, amount: number) {
  const key = inventoryKey(kind);
  useGameStore.setState((state) => ({
    itemCounts: {
      ...state.itemCounts,
      [key]: Math.max(0, (state.itemCounts[key] ?? 0) + amount),
    },
  }));
}
