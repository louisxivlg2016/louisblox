import { create } from 'zustand';
import type { Entity } from 'koota';

export const useCompanionMenuStore = create<{
  entity: Entity | null;
  open: boolean;
  openFor: (entity: Entity) => void;
  close: () => void;
}>((set) => ({
  entity: null,
  open: false,
  openFor: (entity) => set({ entity, open: true }),
  close: () => set({ entity: null, open: false }),
}));
