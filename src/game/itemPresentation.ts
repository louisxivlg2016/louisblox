import { getItemMeta } from './items';
import type { GalleryItemId, ItemKind } from './items';
import { isPaintballGun } from './paintball';

export function firearmYaw(kind: ItemKind | GalleryItemId) {
  const meta = getItemMeta(kind);
  return meta.category === 'gun' || meta.shape === 'gun' || meta.shape === 'rpg' || isPaintballGun(kind) ? Math.PI : 0;
}

export function heldWeaponYaw(kind: ItemKind | GalleryItemId, fullCharacter: boolean) {
  const weapon = ['sword', 'bow', 'gun', 'pickaxe', 'shovel'].includes(getItemMeta(kind).category) || kind === 'extinguisher' || getItemMeta(kind).shape === 'shears';
  return firearmYaw(kind) + (fullCharacter && weapon ? Math.PI : 0);
}
