import { create } from 'zustand';
import type { World } from 'koota';
import { setVoxelImage } from './chunks';
import { cleanPaintingImage } from './paintingImage';
import { useGameStore } from './store';
import { translate } from './language';

type PaintingPosition = { x: number; y: number; z: number };
type PaintingEditor = PaintingPosition & { image?: string; drawing?: boolean };

export const useCustomPaintingStore = create<{
  editing: PaintingEditor | null;
  openPainting: (position: PaintingPosition, image?: string, drawing?: boolean) => void;
  closePainting: () => void;
}>((set) => ({
  editing: null,
  openPainting: (position, image, drawing = false) => {
    set({ editing: { ...position, image: cleanPaintingImage(image), drawing } });
    useGameStore.getState().setMode('pause');
  },
  closePainting: () => set({ editing: null }),
}));

export function saveCustomPainting(world: World, position: PaintingPosition, image: string) {
  if (!setVoxelImage(world, position, image)) return false;
  useCustomPaintingStore.getState().closePainting();
  useGameStore.getState().setNotice(translate('Image enregistrée dans le tableau.', 'Image saved in the painting.'));
  return true;
}
