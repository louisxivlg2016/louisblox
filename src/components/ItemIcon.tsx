import { getItemMeta, selectionInfo } from '../game/items';
import type { SelectedKind } from '../game/items';
import { BlockKind } from '../game/voxel';
import { isGlass } from '../game/extraBlocks';
import { getVitrailDesign, getVitrailIcon } from '../game/vitrailDesigns';
import { brickTexture, texture } from '../game/textures';
import tntUrl from '../../assets/references/tnt.png';
import redFireUrl from '../../assets/ui/red-fire.png';
import trafficLightUrl from '../../assets/ui/traffic-light.png';
import streetLampUrl from '../../assets/ui/street-lamp.png';
import parisStreetLampUrl from '../../assets/ui/paris-street-lamp.png';

const iconCache = new Map<BlockKind, string>();

function blockIcon(kind: BlockKind) {
  const cached = iconCache.get(kind);
  if (cached) return cached;
  const source = kind === BlockKind.BeigeBrick || kind === BlockKind.WhiteBrick || kind === BlockKind.GrayBrick ? brickTexture(kind) : texture(kind, 'side');
  const url = source.image.toDataURL();
  iconCache.set(kind, url);
  return url;
}

export function ItemIcon({ kind }: { kind: SelectedKind }) {
  const info = selectionInfo(kind);
  if (kind === BlockKind.Tnt) return <img className="tnt-icon" src={tntUrl} alt="" />;
  if (kind === BlockKind.Wildfire) return <img className="tnt-icon red-fire-icon" src={redFireUrl} alt="" />;
  if (kind === BlockKind.TrafficLight) return <img className="tnt-icon traffic-light-icon" src={trafficLightUrl} alt="" />;
  if (kind === BlockKind.StreetLamp) return <img className="tnt-icon street-lamp-icon" src={streetLampUrl} alt="" />;
  if (kind === BlockKind.ParisStreetLamp) return <img className="tnt-icon paris-street-lamp-icon" src={parisStreetLampUrl} alt="" />;
  if (typeof kind === 'number' && isGlass(kind)) return <img className="block-swatch block-icon stained-glass-icon" src={getVitrailIcon(kind)} alt={getVitrailDesign(kind)?.name ?? ''} />;
  if (typeof kind === 'number') {
    if (kind >= BlockKind.ConcreteWhite && kind <= BlockKind.ConcreteBlack) return <span className="block-swatch block-concrete" style={{ backgroundColor: info.color }} />;
    const brick = kind === BlockKind.BeigeBrick || kind === BlockKind.WhiteBrick || kind === BlockKind.GrayBrick;
    return <img className={`block-swatch block-icon${brick ? ' block-icon-smooth' : ''}`} src={blockIcon(kind)} alt="" />;
  }
  const meta = getItemMeta(kind);
  if (meta.shape === 'bucket' || meta.shape === 'water_bucket') return <span className={`item-icon item-bucket ${meta.shape === 'water_bucket' ? 'full' : 'empty'}`} aria-hidden="true"><i /><b /><em /></span>;
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
