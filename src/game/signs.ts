import { create } from 'zustand';
import type { World } from 'koota';
import { setVoxelText } from './chunks';
import { useGameStore } from './store';

export const MAX_SIGN_LENGTH = 120;

type SignPosition = { x: number; y: number; z: number };
type SignEditor = SignPosition & { text: string };

export function cleanSignText(text: string) {
  return text.replace(/\r/g, '').slice(0, MAX_SIGN_LENGTH);
}

export const useSignStore = create<{
  editing: SignEditor | null;
  openSign: (position: SignPosition, text: string) => void;
  closeSign: () => void;
}>((set) => ({
  editing: null,
  openSign: (position, text) => {
    set({ editing: { ...position, text } });
    useGameStore.getState().setMode('pause');
  },
  closeSign: () => set({ editing: null }),
}));

export function saveSign(world: World, position: SignPosition, text: string) {
  const value = cleanSignText(text);
  setVoxelText(world, position, value);
  useSignStore.getState().closeSign();
  useGameStore.getState().setNotice('Panneau enregistré.');
}
