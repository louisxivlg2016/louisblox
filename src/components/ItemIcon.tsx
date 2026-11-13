import { getItemMeta, selectionInfo } from '../game/items';
import type { ItemKind, SelectedKind } from '../game/items';
import { BlockKind } from '../game/voxel';
import { isGlass, isStair, isTrafficSign, stairSource } from '../game/extraBlocks';
import { getVitrailDesign, getVitrailIcon } from '../game/vitrailDesigns';
import { brickTexture, texture } from '../game/textures';
import { isReferenceFood, referenceFoodIcons } from './ReferenceFoodModel';
import tntUrl from '../../assets/references/tnt.png';
import redFireUrl from '../../assets/ui/red-fire.png';
import trafficLightUrl from '../../assets/ui/traffic-light.png';
import streetLampUrl from '../../assets/ui/street-lamp.png';
import parisStreetLampUrl from '../../assets/ui/paris-street-lamp.png';
import wheatCropIcon from '../../assets/crop-icons/wheat.png';
import carrotCropIcon from '../../assets/crop-icons/carrot.png';
import cornCropIcon from '../../assets/crop-icons/corn.png';
import tomatoCropIcon from '../../assets/crop-icons/tomato.png';
import extinguisherUrl from '../../son/extincteur.png';
import airplaneIconUrl from '../../assets/icons/airplane.png';
import bayonetRifleIconUrl from '../../assets/icons/bayonet-rifle.png';
import raceCarIconUrl from '../../assets/references/raceCar.png';
import blueCarIconUrl from '../../assets/references/blueCar.png';
import trainIconUrl from '../../assets/references/train.png';

const photoIcons: Partial<Record<ItemKind, string>> = {
  plane: airplaneIconUrl,
  rifle_flintlock: bayonetRifleIconUrl,
  car_red: raceCarIconUrl,
  car_blue: blueCarIconUrl,
  train: trainIconUrl,
};

const cropIcons: Partial<Record<BlockKind, string>> = {
  [BlockKind.Wheat]: wheatCropIcon,
  [BlockKind.Carrot]: carrotCropIcon,
  [BlockKind.Corn]: cornCropIcon,
  [BlockKind.Tomato]: tomatoCropIcon,
};
const iconCache = new Map<BlockKind, string>();
const trafficSignLabels: Partial<Record<BlockKind, { label: string; className?: string }>> = {
  [BlockKind.StopSign]: { label: 'STOP', className: 'stop' },
  [BlockKind.YieldSign]: { label: 'CÉDEZ' },
  [BlockKind.NoEntrySign]: { label: 'INTERDIT', className: 'no-entry' },
  [BlockKind.OneWaySign]: { label: 'UNIQUE' },
  [BlockKind.SpeedLimitSign]: { label: '50', className: 'speed' },
  [BlockKind.PedestrianSign]: { label: 'PIÉTON' },
  [BlockKind.SchoolSign]: { label: 'ÉCOLE' },
  [BlockKind.ParkingSign]: { label: 'P', className: 'parking' },
  [BlockKind.DirectionSign]: { label: '➜', className: 'direction' },
  [BlockKind.DangerSign]: { label: '!', className: 'danger' },
  [BlockKind.RoundaboutSign]: { label: '↻' },
  [BlockKind.PrioritySign]: { label: '◆', className: 'priority' },
};

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
  if (typeof kind === 'number' && cropIcons[kind]) return <img className="item-model-icon" src={cropIcons[kind]} alt={info.name} />;
  if (typeof kind !== 'number' && isReferenceFood(kind)) return <img className="item-model-icon" style={kind === 'cake' ? { transform: 'scale(1.25)' } : undefined} src={referenceFoodIcons[kind]} alt={info.name} />;
  if (kind === BlockKind.Tnt) return <img className="tnt-icon" src={tntUrl} alt="" />;
  if (kind === BlockKind.Wildfire) return <img className="tnt-icon red-fire-icon" src={redFireUrl} alt="" />;
  if (kind === BlockKind.TrafficLight) return <img className="tnt-icon traffic-light-icon" src={trafficLightUrl} alt="" />;
  if (kind === BlockKind.StreetLamp) return <img className="tnt-icon street-lamp-icon" src={streetLampUrl} alt="" />;
  if (kind === BlockKind.ParisStreetLamp) return <img className="tnt-icon paris-street-lamp-icon" src={parisStreetLampUrl} alt="" />;
  if (kind === BlockKind.ParisStreetSign) return <span className="paris-street-sign-icon" aria-hidden="true"><small>4e</small><strong>RUE</strong></span>;
  if (typeof kind === 'number' && isTrafficSign(kind)) {
    const sign = trafficSignLabels[kind];
    return <span className={`traffic-sign-icon ${sign?.className ?? ''}`} style={{ backgroundColor: info.color }}>{sign?.label}</span>;
  }
  if (typeof kind === 'number' && isGlass(kind) && kind !== BlockKind.Glass) return <img className="block-swatch block-icon stained-glass-icon" src={getVitrailIcon(kind)} alt={getVitrailDesign(kind)?.name ?? ''} />;
  if (typeof kind === 'number') {
    if (isStair(kind)) {
      const source = stairSource(kind) as BlockKind;
      return <span className="block-swatch stair-block-icon"><img className="stair-icon-lower" src={blockIcon(source)} alt="" /><img className="stair-icon-upper" src={blockIcon(source)} alt="" /></span>;
    }
    if (kind >= BlockKind.ConcreteWhite && kind <= BlockKind.ConcreteBlack) return <span className="block-swatch block-concrete" style={{ backgroundColor: info.color }} />;
    const brick = kind === BlockKind.BeigeBrick || kind === BlockKind.WhiteBrick || kind === BlockKind.GrayBrick;
    return <img className={`block-swatch block-icon${brick ? ' block-icon-smooth' : ''}`} src={blockIcon(kind)} alt="" />;
  }
  const meta = getItemMeta(kind);
  const photoIcon = photoIcons[kind as ItemKind];
  if (photoIcon) return <img className="item-model-icon item-photo-icon" src={photoIcon} alt={info.name} />;
  if (kind === 'extinguisher') return <img className="item-model-icon" style={{ imageRendering: 'pixelated' }} src={extinguisherUrl} alt={info.name} />;
  if (meta.shape === 'shears') return <span className="item-icon item-shears" style={{ '--item-color': info.color } as React.CSSProperties} aria-hidden="true"><i /><b /><em /></span>;
  if (meta.shape === 'cake') return <span className="item-icon item-cake" style={{ '--item-color': info.color } as React.CSSProperties} aria-hidden="true"><i /><b /><em /></span>;
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
