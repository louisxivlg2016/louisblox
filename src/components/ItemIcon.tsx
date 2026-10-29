import { getItemMeta, selectionInfo } from '../game/items';
import type { SelectedKind } from '../game/items';

export function ItemIcon({ kind }: { kind: SelectedKind }) {
  const info = selectionInfo(kind);
  if (typeof kind === 'number') return <span className="block-swatch" style={{ backgroundColor: info.color }} />;
  const meta = getItemMeta(kind);
  const rawShape = meta.shape ?? meta.category;
  const aliases: Record<string, string> = {
    axe: 'pickaxe', hoe: 'pickaxe', spade: 'shovel', spear: 'sword', dagger: 'sword', club: 'sword', mace: 'sword', whip: 'sword', boomerang: 'sword',
    fishing_rod: 'bow', crossbow: 'bow', rpg: 'gun', bowl: 'food', meat: 'food', milk: 'food', cheese: 'food', fish: 'food',
    car: 'vehicle', boat: 'vehicle', hovercraft: 'vehicle', bed: 'saddle', pod: 'saddle', banner: 'saddle',
    spawn_orb: 'gun', spawner: 'gun', catcher: 'gun', ammo: 'gun', bomb: 'gun', ball: 'gun',
    potion: 'potion', splash_potion: 'potion', arrow_potion: 'potion', plant: 'plant', flower: 'plant', seed: 'plant', mushroom: 'plant',
    firecracker: 'firecracker', pebble: 'firecracker', bar: 'mineral', fragment: 'mineral', gem: 'mineral',
  };
  const category = aliases[rawShape] ?? (['sword', 'pickaxe', 'shovel', 'bow', 'gun', 'armor', 'food', 'vehicle', 'saddle'].includes(rawShape) ? rawShape : 'resource');
  return (
    <span className={`item-icon item-${category}`} style={{ '--item-color': info.color } as React.CSSProperties} aria-hidden="true">
      <i /><b /><em />
    </span>
  );
}
