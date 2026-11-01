import type { BlockKind } from './voxel';
import type { SelectedKind } from './items';
import type { GameplayMode } from './worldMode';
import { useGameStore } from './store';

export type InventoryState = {
  gameplayMode: GameplayMode;
  itemCounts: Record<string, number>;
};

export const inventoryKey = (kind: SelectedKind) => typeof kind === 'number' ? `block_${kind}` : kind;

export function inventoryCount(kind: SelectedKind, state: InventoryState) {
  return state.itemCounts[inventoryKey(kind)] ?? 0;
}

export function hasInventory(kind: SelectedKind, state: InventoryState) {
  return state.gameplayMode !== 'survival' || kind === 'hand' || inventoryCount(kind, state) > 0;
}

export function changeInventory(kind: SelectedKind, amount: number) {
  const key = inventoryKey(kind);
  useGameStore.setState((state) => {
    const count = Math.max(0, (state.itemCounts[key] ?? 0) + amount);
    const itemCounts = { ...state.itemCounts, [key]: count };
    if (state.gameplayMode !== 'survival' || count > 0 || kind === 'hand') return { itemCounts };
    return {
      itemCounts,
      hotbarSlots: state.hotbarSlots.map((slot) => slot === kind ? null : slot),
      selected: state.selected === kind ? 'hand' as const : state.selected,
    };
  });
}
