import { BLOCK_INFO, BlockKind } from './voxel';

export type ItemCategory = 'sword' | 'bow' | 'gun' | 'armor' | 'food' | 'vehicle' | 'saddle';
export type ArmorKind = 'gold' | 'diamond' | 'silver';
export type ItemKind =
  | 'sword_wood' | 'sword_stone' | 'sword_iron' | 'sword_gold' | 'sword_diamond' | 'sword_silver'
  | 'armor_gold' | 'armor_diamond' | 'armor_silver'
  | 'apple' | 'bread' | 'cooked_meat' | 'berries'
  | 'bow' | 'crossbow' | 'pistol_iron' | 'pistol_gold' | 'pistol_bomb'
  | 'car_red' | 'car_blue' | 'saddle';
export type SelectedKind = BlockKind | ItemKind;
export type ItemMeta = {
  name: string;
  color: string;
  category: ItemCategory;
  armor?: ArmorKind;
  healing?: number;
  protection?: number;
  cooldown?: number;
};

const item = (name: string, color: string, category: ItemCategory, extra: Partial<ItemMeta> = {}): ItemMeta => ({
  name, color, category, ...extra,
});

export const ITEM_META: Record<ItemKind, ItemMeta> = {
  sword_wood: item('Épée en bois', '#b98a53', 'sword', { cooldown: 0.35 }),
  sword_stone: item('Épée en pierre', '#92999e', 'sword', { cooldown: 0.35 }),
  sword_iron: item('Épée en fer', '#e0e8eb', 'sword', { cooldown: 0.32 }),
  sword_gold: item('Épée en or', '#f1c83c', 'sword', { cooldown: 0.3 }),
  sword_diamond: item('Épée en diamant', '#55d5d8', 'sword', { cooldown: 0.3 }),
  sword_silver: item('Épée en argent', '#bac9d9', 'sword', { cooldown: 0.32 }),
  armor_gold: item('Armure de chevalier en or', '#eac244', 'armor', { armor: 'gold', protection: 0.25 }),
  armor_diamond: item('Armure de chevalier en diamant', '#54ced5', 'armor', { armor: 'diamond', protection: 0.5 }),
  armor_silver: item('Armure de chevalier en argent', '#c4d0dc', 'armor', { armor: 'silver', protection: 0.35 }),
  apple: item('Pomme', '#d64236', 'food', { healing: 2 }),
  bread: item('Pain', '#d9a75f', 'food', { healing: 3 }),
  cooked_meat: item('Viande cuite', '#a96341', 'food', { healing: 4 }),
  berries: item('Baies', '#a74a82', 'food', { healing: 1 }),
  bow: item('Arc à flèches', '#a77843', 'bow', { cooldown: 0.55 }),
  crossbow: item('Arbalète', '#8c8c83', 'bow', { cooldown: 0.7 }),
  pistol_iron: item('Pistolet en fer', '#9caab3', 'gun', { cooldown: 0.42 }),
  pistol_gold: item('Pistolet en or', '#e5b934', 'gun', { cooldown: 0.32 }),
  pistol_bomb: item('Pistolet lance-bombes', '#686d79', 'gun', { cooldown: 1.1 }),
  car_red: item('Voiture de course rouge', '#d63935', 'vehicle'),
  car_blue: item('Voiture de course bleue', '#347cd0', 'vehicle'),
  saddle: item('Selle pour cheval', '#80502e', 'saddle'),
};

export const ITEM_ORDER = Object.keys(ITEM_META) as ItemKind[];
export const DEFAULT_ITEM_COUNTS: Record<ItemKind, number> = Object.fromEntries(
  ITEM_ORDER.map((kind) => [kind, kind === 'bread' ? 12 : kind === 'cooked_meat' ? 6 : kind === 'berries' ? 16 : 1]),
) as Record<ItemKind, number>;

export function selectionInfo(kind: SelectedKind) {
  return typeof kind === 'number' ? BLOCK_INFO[kind] : ITEM_META[kind];
}

export function isSelectedKind(value: unknown): value is SelectedKind {
  return (typeof value === 'number' && Number.isInteger(value) && value in BLOCK_INFO)
    || (typeof value === 'string' && value in ITEM_META);
}

export function isSword(kind: SelectedKind) {
  return typeof kind === 'string' && ITEM_META[kind].category === 'sword';
}
