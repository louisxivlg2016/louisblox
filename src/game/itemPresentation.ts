import { getItemMeta } from './items';
import type { GalleryItemId, ItemKind } from './items';
import { isPaintballGun } from './paintball';

export function firearmYaw(kind: ItemKind | GalleryItemId) {
  const meta = getItemMeta(kind);
  return meta.category === 'gun' || meta.shape === 'gun' || meta.shape === 'rpg' || isPaintballGun(kind) ? Math.PI : 0;
}
