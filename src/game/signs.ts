import { create } from 'zustand';
import type { World } from 'koota';
import { setVoxelText } from './chunks';
import { useGameStore } from './store';
import { translate } from './language';
import { cleanSignTextSize, DEFAULT_SIGN_TEXT_SIZE } from './voxel';

export const MAX_SIGN_LENGTH = 120;

type SignPosition = { x: number; y: number; z: number };
type SignEditor = SignPosition & { text: string; textSize: number; kind: number };

export function cleanSignText(text: string) {
  return text.replace(/\r/g, '').slice(0, MAX_SIGN_LENGTH);
}

export const useSignStore = create<{
  editing: SignEditor | null;
  openSign: (position: SignPosition, text: string, kind: number, textSize?: number) => void;
  closeSign: () => void;
}>((set) => ({
  editing: null,
  openSign: (position, text, kind, textSize) => {
    set({ editing: { ...position, text, textSize: cleanSignTextSize(textSize), kind } });
    useGameStore.getState().setMode('pause');
  },
  closeSign: () => set({ editing: null }),
}));

export function saveSign(world: World, position: SignPosition, text: string, textSize = DEFAULT_SIGN_TEXT_SIZE) {
  const value = cleanSignText(text);
  setVoxelText(world, position, value, cleanSignTextSize(textSize));
  useSignStore.getState().closeSign();
  useGameStore.getState().setNotice(translate('Panneau enregistré.', 'Sign saved.'));
}
