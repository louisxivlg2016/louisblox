import { create } from 'zustand';
import { useGameStore } from './store';

export type RouteDestination = { x: number; z: number; worldId: string };

export const useNavigationStore = create<{
  destination: RouteDestination | null;
  setDestination: (x: number, z: number) => void;
  clearDestination: () => void;
}>((set) => ({
  destination: null,
  setDestination: (x, z) => set({ destination: { x, z, worldId: useGameStore.getState().worldId } }),
  clearDestination: () => set({ destination: null }),
}));
