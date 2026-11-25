import { create } from 'zustand';
import type { World } from 'koota';
import { setVoxelImage, setVoxelPaintingSize } from './chunks';
import { cleanPaintingImage } from './paintingImage';
import { cleanPaintingSize } from './voxel';
import { useGameStore } from './store';
import { translate } from './language';

type PaintingPosition = { x: number; y: number; z: number };
type PaintingEditor = PaintingPosition & { image?: string; drawing?: boolean; custom: boolean; size: number };

export const useCustomPaintingStore = create<{
  editing: PaintingEditor | null;
  openPainting: (position: PaintingPosition, image?: string, drawing?: boolean, size?: number, custom?: boolean) => void;
  closePainting: () => void;
}>((set) => ({
  editing: null,
  openPainting: (position, image, drawing = false, size = 1, custom = true) => {
    set({ editing: { ...position, image: cleanPaintingImage(image), drawing, custom, size: cleanPaintingSize(size) } });
    useGameStore.getState().setMode('pause');
  },
  closePainting: () => set({ editing: null }),
}));

export function changePaintingSize(world: World, position: PaintingPosition, size: number) {
  const cleaned = cleanPaintingSize(size);
  if (!setVoxelPaintingSize(world, position, cleaned)) return false;
  useCustomPaintingStore.setState((state) => ({ editing: state.editing ? { ...state.editing, size: cleaned } : null }));
  return true;
}

export function saveCustomPainting(world: World, position: PaintingPosition, image: string) {
  if (!setVoxelImage(world, position, image)) return false;
  useCustomPaintingStore.getState().closePainting();
  useGameStore.getState().setNotice(translate('Image enregistrée dans le tableau.', 'Image saved in the painting.'));
  return true;
}
