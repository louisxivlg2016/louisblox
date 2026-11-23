import type { BlockKind } from './voxel';
import type { SelectedKind } from './items';
import type { GameplayMode } from './worldMode';
import { useGameStore } from './store';

export type InventoryState = {
  gameplayMode: GameplayMode;
  itemCounts: Record<string, number>;
  apples?: number;
  hotbarSlots?: Array<SelectedKind | null>;
};

export const inventoryKey = (kind: SelectedKind) => typeof kind === 'number' ? `block_${kind}` : kind;

export function inventoryCount(kind: SelectedKind, state: InventoryState) {
  return kind === 'apple' && typeof state.apples === 'number' ? state.apples : state.itemCounts[inventoryKey(kind)] ?? 0;
}

export function sellableInventoryCount(kind: SelectedKind, state: InventoryState) {
  const count = inventoryCount(kind, state);
  if (count > 0 || state.gameplayMode === 'survival') return count;
  return state.hotbarSlots?.includes(kind) ? 1 : 0;
}

export function hasInventory(kind: SelectedKind, state: InventoryState) {
  return state.gameplayMode !== 'survival' || kind === 'hand' || inventoryCount(kind, state) > 0;
}

export function changeInventory(kind: SelectedKind, amount: number) {
  const key = inventoryKey(kind);
  useGameStore.setState((state) => {
    const count = Math.max(0, (kind === 'apple' ? state.apples : state.itemCounts[key] ?? 0) + amount);
    const itemCounts = kind === 'apple' ? state.itemCounts : { ...state.itemCounts, [key]: count };
    const apples = kind === 'apple' ? count : state.apples;
    if (amount > 0 && kind !== 'hand' && !state.hotbarSlots.includes(kind)) {
      const empty = state.hotbarSlots.findIndex((slot) => slot === null);
      if (empty >= 0) {
        const hotbarSlots = [...state.hotbarSlots];
        hotbarSlots[empty] = kind;
        return { itemCounts, apples, hotbarSlots, selected: state.selected === 'hand' ? kind : state.selected, selectedSlot: state.selected === 'hand' ? empty : state.selectedSlot };
      }
    }
    if (count > 0 || kind === 'hand') return kind === 'apple' ? { apples } : { itemCounts };
    return {
      itemCounts,
      apples,
      hotbarSlots: state.hotbarSlots.map((slot) => slot === kind ? null : slot),
      selected: state.selected === kind ? 'hand' as const : state.selected,
      selectedSlot: state.selected === kind ? 0 : state.selectedSlot,
    };
  });
}
