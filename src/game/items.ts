import { BLOCK_INFO, BlockKind } from './voxel';
import { GALLERY_ITEM_MAP, isGalleryItem } from './galleryCatalog';
import type { GalleryItemId } from './galleryCatalog';
export type { GalleryItemId } from './galleryCatalog';

export type ItemCategory = 'sword' | 'pickaxe' | 'shovel' | 'bow' | 'gun' | 'armor' | 'food' | 'vehicle' | 'saddle' | 'resource';
export type ArmorKind = 'gold' | 'diamond' | 'silver';
export type ItemKind =
  | 'hand' | 'stick'
  | 'sword_wood' | 'sword_stone' | 'sword_iron' | 'sword_gold' | 'sword_diamond' | 'sword_silver'
  | 'pickaxe_wood' | 'pickaxe_stone' | 'pickaxe_iron' | 'pickaxe_gold' | 'pickaxe_diamond' | 'pickaxe_silver'
  | 'shovel_wood' | 'shovel_stone' | 'shovel_iron' | 'shovel_gold' | 'shovel_diamond' | 'shovel_silver'
  | 'armor_gold' | 'armor_diamond' | 'armor_silver'
  | 'apple' | 'bread' | 'cooked_meat' | 'berries'
  | 'corn' | 'wheat' | 'tomato' | 'carrot' | 'watermelon'
  | 'bow' | 'crossbow' | 'pistol_iron' | 'pistol_gold' | 'pistol_bomb'
  | 'car_red' | 'car_blue' | 'plane' | 'train' | 'boat' | 'saddle';
export type SelectedKind = BlockKind | ItemKind | GalleryItemId;
export type ItemMeta = {
  name: string;
  color: string;
  category: ItemCategory;
  armor?: ArmorKind;
  healing?: number;
  protection?: number;
  cooldown?: number;
  efficiency?: number;
  shape?: string;
};

const item = (name: string, color: string, category: ItemCategory, extra: Partial<ItemMeta> = {}): ItemMeta => ({
  name, color, category, ...extra,
});

export const ITEM_META: Record<ItemKind, ItemMeta> = {
  hand: item('Main', '#e7a0aa', 'resource', { shape: 'hand' }),
  stick: item('Bâton', '#8b633c', 'resource', { shape: 'stick' }),
  sword_wood: item('Épée en bois', '#b98a53', 'sword', { cooldown: 0.35 }),
  sword_stone: item('Épée en pierre', '#92999e', 'sword', { cooldown: 0.35 }),
  sword_iron: item('Épée en fer', '#e0e8eb', 'sword', { cooldown: 0.32 }),
  sword_gold: item('Épée en or', '#f1c83c', 'sword', { cooldown: 0.3 }),
  sword_diamond: item('Épée en diamant', '#55d5d8', 'sword', { cooldown: 0.3 }),
  sword_silver: item('Épée en argent', '#bac9d9', 'sword', { cooldown: 0.32 }),
  pickaxe_wood: item('Pioche en bois', '#b98a53', 'pickaxe', { efficiency: 2 }),
  pickaxe_stone: item('Pioche en pierre', '#92999e', 'pickaxe', { efficiency: 2.5 }),
  pickaxe_iron: item('Pioche en fer', '#e0e8eb', 'pickaxe', { efficiency: 3.5 }),
  pickaxe_gold: item('Pioche en or', '#f1c83c', 'pickaxe', { efficiency: 4.5 }),
  pickaxe_diamond: item('Pioche en diamant', '#55d5d8', 'pickaxe', { efficiency: 6 }),
  pickaxe_silver: item('Pioche en argent', '#bac9d9', 'pickaxe', { efficiency: 4 }),
  shovel_wood: item('Pelle en bois', '#b98a53', 'shovel', { efficiency: 2 }),
  shovel_stone: item('Pelle en pierre', '#92999e', 'shovel', { efficiency: 2.5 }),
  shovel_iron: item('Pelle en fer', '#e0e8eb', 'shovel', { efficiency: 3.5 }),
  shovel_gold: item('Pelle en or', '#f1c83c', 'shovel', { efficiency: 4.5 }),
  shovel_diamond: item('Pelle en diamant', '#55d5d8', 'shovel', { efficiency: 6 }),
  shovel_silver: item('Pelle en argent', '#bac9d9', 'shovel', { efficiency: 4 }),
  armor_gold: item('Armure de chevalier en or', '#eac244', 'armor', { armor: 'gold', protection: 0.25 }),
  armor_diamond: item('Armure de chevalier en diamant', '#54ced5', 'armor', { armor: 'diamond', protection: 0.5 }),
  armor_silver: item('Armure de chevalier en argent', '#c4d0dc', 'armor', { armor: 'silver', protection: 0.35 }),
  apple: item('Pomme', '#d64236', 'food', { healing: 2 }),
  bread: item('Pain', '#d9a75f', 'food', { healing: 3 }),
  cooked_meat: item('Viande cuite', '#a96341', 'food', { healing: 4 }),
  berries: item('Baies', '#a74a82', 'food', { healing: 1 }),
  corn: item('Maïs', '#e5c442', 'food', { healing: 2 }),
  wheat: item('Blé', '#cfa853', 'food', { healing: 1 }),
  tomato: item('Tomate', '#dc4936', 'food', { healing: 2 }),
  carrot: item('Carotte', '#e78b2f', 'food', { healing: 2 }),
  watermelon: item('Pastèque', '#4b984b', 'food', { healing: 3 }),
  bow: item('Arc à flèches', '#a77843', 'bow', { cooldown: 0.55 }),
  crossbow: item('Arbalète', '#8c8c83', 'bow', { cooldown: 0.7 }),
  pistol_iron: item('Pistolet en fer', '#9caab3', 'gun', { cooldown: 0.42 }),
  pistol_gold: item('Pistolet en or', '#e5b934', 'gun', { cooldown: 0.32 }),
  pistol_bomb: item('Pistolet lance-bombes', '#686d79', 'gun', { cooldown: 1.1 }),
  car_red: item('Voiture de course rouge', '#d63935', 'vehicle'),
  car_blue: item('Voiture bleue avec cabine', '#347cd0', 'vehicle'),
  plane: item('Avion de passagers', '#d9e4eb', 'vehicle', { shape: 'plane' }),
  train: item('Train de passagers', '#a73b38', 'vehicle', { shape: 'train' }),
  boat: item('Bateau à deux places', '#9b6b3f', 'vehicle', { shape: 'boat' }),
  saddle: item('Selle pour cheval', '#80502e', 'saddle'),
};

export const ITEM_ORDER = Object.keys(ITEM_META) as ItemKind[];
export const DEFAULT_ITEM_COUNTS: Record<ItemKind, number> = Object.fromEntries(
  ITEM_ORDER.map((kind) => [kind, kind === 'bread' ? 12 : kind === 'cooked_meat' ? 6 : kind === 'berries' ? 16 : 1]),
) as Record<ItemKind, number>;

function galleryCategory(shape: string): ItemCategory {
  if (['sword', 'spear', 'dagger', 'club', 'mace', 'whip', 'boomerang', 'stick'].includes(shape)) return 'sword';
  if (shape === 'bow' || shape === 'crossbow') return 'bow';
  if (shape === 'gun' || shape === 'rpg') return 'gun';
  if (['food', 'bowl', 'meat', 'milk', 'cheese', 'fish'].includes(shape)) return 'food';
  if (shape === 'armor') return 'armor';
  if (shape === 'car' || shape === 'boat' || shape === 'hovercraft') return 'vehicle';
  if (shape === 'pickaxe' || shape === 'axe') return 'pickaxe';
  if (shape === 'spade') return 'shovel';
  return 'resource';
}

function toolEfficiency(name: string) {
  const value = name.toLowerCase();
  if (value.includes('moonstone') || value.includes('golem') || value.includes('artisan')) return 7;
  if (value.includes('diamond')) return 6;
  if (value.includes('gold')) return 4.5;
  if (value.includes('iron')) return 3.5;
  if (value.includes('stone')) return 2.5;
  return 2;
}

export function getItemMeta(kind: ItemKind | GalleryItemId): ItemMeta {
  if (isGalleryItem(kind)) {
    const item = GALLERY_ITEM_MAP[kind];
    const name = item.name.toLowerCase();
    const shape = item.shape;
    const healing = shape === 'meat' ? 4 : shape === 'bowl' ? 3 : ['food', 'fish', 'milk', 'cheese'].includes(shape) ? 2 : undefined;
    const protection = shape === 'armor'
      ? name.includes('diamond') ? 0.5 : name.includes('gold') ? 0.35 : name.includes('iron') ? 0.3 : name.includes('military') ? 0.4 : name.includes('fur') ? 0.2 : 0.15
      : undefined;
    const armor = shape === 'armor' ? name.includes('diamond') ? 'diamond' as const : name.includes('gold') ? 'gold' as const : 'silver' as const : undefined;
    const cooldown = shape === 'rpg' ? 1.2 : shape === 'gun' ? 0.4 : shape === 'bow' || shape === 'crossbow' ? 0.6 : undefined;
    return {
      name: item.name,
      color: item.color,
      category: galleryCategory(shape),
      shape,
      healing,
      protection,
      armor,
      cooldown,
      efficiency: toolEfficiency(name),
    };
  }
  return ITEM_META[kind];
}

export function selectionInfo(kind: SelectedKind) {
  return typeof kind === 'number' ? BLOCK_INFO[kind] : getItemMeta(kind);
}

export function isSelectedKind(value: unknown): value is SelectedKind {
  return (typeof value === 'number' && Number.isInteger(value) && value in BLOCK_INFO)
    || (typeof value === 'string' && (value in ITEM_META || isGalleryItem(value)));
}

export function isSword(kind: SelectedKind) {
  return typeof kind === 'string' && getItemMeta(kind).category === 'sword';
}

export function miningSpeed(selection: SelectedKind, block: BlockKind) {
  if (typeof selection === 'number' || block === BlockKind.Bedrock) return 1;
  const meta = getItemMeta(selection);
  const hardBlock = block === BlockKind.Stone || block === BlockKind.CoalOre || block === BlockKind.IronOre
    || block === BlockKind.GoldOre || block === BlockKind.DiamondOre || block === BlockKind.Ice
    || (block >= BlockKind.BeigeBrick && block <= BlockKind.ConcreteBlack);
  const softBlock = block === BlockKind.Grass || block === BlockKind.Dirt || block === BlockKind.Sand
    || block === BlockKind.Snow || block === BlockKind.AutumnGrass || block === BlockKind.ForestGrass;
  const woodBlock = block === BlockKind.Wood || block === BlockKind.OakPlanks || block === BlockKind.PinePlanks || block === BlockKind.AutumnPlanks;
  const foliage = block === BlockKind.Leaves || block === BlockKind.PineLeaves || block === BlockKind.AutumnLeaves;
  return (meta.category === 'pickaxe' && meta.shape !== 'axe' && hardBlock) || (meta.category === 'shovel' && softBlock)
    || (meta.shape === 'axe' && woodBlock) || (meta.shape === 'shears' && foliage)
    ? meta.efficiency ?? 1
    : 1;
}
