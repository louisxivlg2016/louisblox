import { getItemMeta } from './items';
import type { GalleryItemId, ItemKind } from './items';

export function firearmYaw(_kind: ItemKind | GalleryItemId) {
  return 0;
}

export function heldWeaponYaw(kind: ItemKind | GalleryItemId, fullCharacter: boolean) {
  const weapon = ['sword', 'bow', 'gun', 'pickaxe', 'shovel'].includes(getItemMeta(kind).category) || kind === 'extinguisher' || getItemMeta(kind).shape === 'shears';
  return firearmYaw(kind) + (fullCharacter && weapon ? Math.PI : 0);
}
