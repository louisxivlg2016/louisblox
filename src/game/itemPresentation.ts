import { getItemMeta } from './items';
import type { GalleryItemId, ItemKind, StoredAnimalItem } from './items';

type HandheldItem = ItemKind | GalleryItemId | StoredAnimalItem;

export function firearmYaw(_kind: HandheldItem) {
  return 0;
}

export function heldWeaponYaw(kind: HandheldItem, fullCharacter: boolean) {
  const weapon = ['sword', 'bow', 'gun', 'pickaxe', 'shovel'].includes(getItemMeta(kind).category) || kind === 'extinguisher' || getItemMeta(kind).shape === 'shears';
  return firearmYaw(kind) + (fullCharacter && weapon ? Math.PI : 0);
}
