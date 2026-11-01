import { create } from 'zustand';
import type { SelectedKind } from './items';

type EatingState = {
  kind: Exclude<SelectedKind, number>;
  startedAt: number;
} | null;

let timer: ReturnType<typeof setTimeout> | undefined;

export const useEatingStore = create<{
  eating: EatingState;
  startEating: (kind: Exclude<SelectedKind, number>) => void;
}>((set) => ({
  eating: null,
  startEating: (kind) => {
    if (timer !== undefined) clearTimeout(timer);
    set({ eating: { kind, startedAt: performance.now() } });
    timer = setTimeout(() => set({ eating: null }), 850);
  },
}));
