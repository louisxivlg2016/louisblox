import { BLOCK_INFO, BlockKind } from './voxel';
import { isBed, isChest, isDoor, isLadder, isSign, isStair, isTrapdoor, stairSource } from './extraBlocks';
import { GALLERY_ITEM_MAP, isGalleryItem } from './galleryCatalog';
import type { GalleryItemId } from './galleryCatalog';
export type { GalleryItemId } from './galleryCatalog';

export type ItemCategory = 'sword' | 'pickaxe' | 'shovel' | 'bow' | 'gun' | 'armor' | 'food' | 'vehicle' | 'saddle' | 'resource';
export type ArmorKind = 'gold' | 'diamond' | 'silver';
export type ItemKind =
  | 'hand' | 'stick' | 'shears' | 'bucket' | 'water_bucket' | 'empty_bucket' | 'extinguisher'
  | 'sword_wood' | 'sword_stone' | 'sword_iron' | 'sword_gold' | 'sword_diamond' | 'sword_silver'
  | 'pickaxe_wood' | 'pickaxe_stone' | 'pickaxe_iron' | 'pickaxe_gold' | 'pickaxe_diamond' | 'pickaxe_silver'
  | 'shovel_wood' | 'shovel_stone' | 'shovel_iron' | 'shovel_gold' | 'shovel_diamond' | 'shovel_silver'
  | 'armor_gold' | 'armor_diamond' | 'armor_silver'
  | 'apple' | 'bread' | 'cake' | 'raw_meat' | 'cooked_meat' | 'berries'
  | 'corn' | 'cooked_corn' | 'wheat' | 'tomato' | 'carrot' | 'watermelon'
  | 'raw_chicken' | 'cooked_chicken' | 'raw_salmon' | 'cooked_salmon'
  | 'cheese_slice' | 'cheese_wheel' | 'milk' | 'wool'
  | 'bow' | 'crossbow' | 'pistol_iron' | 'pistol_gold' | 'pistol_bomb' | 'rifle_auto' | 'rifle_flintlock'
  | 'car_red' | 'car_blue' | 'plane' | 'train' | 'metro' | 'boat' | 'jeep' | 'police_car' | 'firetruck' | 'carriage' | 'cannon' | 'saddle' | 'parachute';
export type SelectedKind = BlockKind | ItemKind | GalleryItemId;
export type ItemMeta = {
  name: string;
  color: string;
  category: ItemCategory;
  armor?: ArmorKind;
  healing?: number;
  protection?: number;
  cooldown?: number;
  damage?: number;
  efficiency?: number;
  shape?: string;
};

const item = (name: string, color: string, category: ItemCategory, extra: Partial<ItemMeta> = {}): ItemMeta => ({
  name, color, category, ...extra,
});

export const ITEM_META: Record<ItemKind, ItemMeta> = {
  hand: item('Main', '#e7a0aa', 'resource', { shape: 'hand' }),
  stick: item('Bâton', '#8b633c', 'resource', { shape: 'stick' }),
  shears: item('Cisailles', '#a8b5bc', 'resource', { shape: 'shears', efficiency: 2 }),
  bucket: item('Seau vide', '#a8b5bc', 'resource', { shape: 'bucket' }),
  water_bucket: item('Seau plein d’eau', '#359bd5', 'resource', { shape: 'water_bucket' }),
  empty_bucket: item('Seau toujours vide', '#a8b5bc', 'resource', { shape: 'bucket' }),
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
  cake: item('Gâteau', '#c98d52', 'food', { healing: 5, shape: 'cake' }),
  raw_meat: item('Viande crue', '#c7483d', 'food', { healing: 1 }),
  cooked_meat: item('Viande cuite', '#a96341', 'food', { healing: 4 }),
  raw_chicken: item('Poulet cru', '#e7a89a', 'food', { healing: 1 }),
  cooked_chicken: item('Poulet cuit', '#bc7d45', 'food', { healing: 4 }),
  raw_salmon: item('Saumon cru', '#ec866b', 'food', { healing: 1 }),
  cooked_salmon: item('Saumon cuit', '#c7a27c', 'food', { healing: 4 }),
  cheese_slice: item('Tranche de fromage', '#eac343', 'food', { healing: 2 }),
  cheese_wheel: item('Fromage entier', '#dcae35', 'food', { healing: 4 }),
  milk: item('Lait', '#e4e7e1', 'food', { healing: 2 }),
  wool: item('Laine', '#eee8d8', 'resource'),
  berries: item('Baies', '#a74a82', 'food', { healing: 1 }),
  corn: item('Maïs', '#e5c442', 'food', { healing: 2 }),
  cooked_corn: item('Maïs cuit', '#dfb834', 'food', { healing: 3 }),
  wheat: item('Blé', '#cfa853', 'food', { healing: 1 }),
  tomato: item('Tomate', '#dc4936', 'food', { healing: 2 }),
  carrot: item('Carotte', '#e78b2f', 'food', { healing: 2 }),
  watermelon: item('Pastèque', '#4b984b', 'food', { healing: 3 }),
  bow: item('Arc à flèches', '#a77843', 'bow', { cooldown: 0.55 }),
  crossbow: item('Arbalète', '#8c8c83', 'bow', { cooldown: 0.7 }),
  pistol_iron: item('Pistolet en fer', '#9caab3', 'gun', { cooldown: 0.42 }),
  pistol_gold: item('Pistolet en or', '#e5b934', 'gun', { cooldown: 0.32 }),
  pistol_bomb: item('Pistolet lance-bombes', '#686d79', 'gun', { cooldown: 0.35 }),
  rifle_auto: item('Fusil automatique', '#2f3b2c', 'gun', { cooldown: 0.09, damage: 2 }),
  rifle_flintlock: item('Fusil à baïonnette', '#885a32', 'gun', { cooldown: 0.85, damage: 2, shape: 'flintlock' }),
  car_red: item('Voiture de course rouge', '#d63935', 'vehicle'),
  car_blue: item('Voiture bleue avec cabine', '#347cd0', 'vehicle'),
  plane: item('Avion de passagers', '#d9e4eb', 'vehicle', { shape: 'plane' }),
  train: item('Train de passagers', '#a73b38', 'vehicle', { shape: 'train' }),
  metro: item('Train de métro', '#a73b38', 'vehicle', { shape: 'train' }),
  boat: item('Bateau à deux places', '#9b6b3f', 'vehicle', { shape: 'boat' }),
  jeep: item('Jeep militaire', '#777b43', 'vehicle', { shape: 'jeep' }),
  police_car: item('Voiture de police', '#e2e7e7', 'vehicle', { shape: 'police' }),
  firetruck: item('Camion de pompier avec sirène', '#d63632', 'vehicle', { shape: 'firetruck' }),
  carriage: item('Calèche avec chevaux', '#d6ae40', 'vehicle', { shape: 'carriage' }),
  cannon: item('Canon à roues', '#6d4829', 'vehicle', { shape: 'cannon' }),
  saddle: item('Selle pour cheval', '#80502e', 'saddle'),
  extinguisher: item('Extincteur', '#d72b25', 'resource', { shape: 'extinguisher' }),
  parachute: item('Parachute', '#d94b45', 'resource', { shape: 'parachute' }),
};

export const ITEM_ORDER = Object.keys(ITEM_META).filter((kind) => kind !== 'train') as ItemKind[];
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

export function isAnimalPoison(kind: SelectedKind) {
  return kind === 'gallery_potions_poison_potion' || kind === 'gallery_potions_splash_poison_potion';
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
      name: isAnimalPoison(kind) ? kind === 'gallery_potions_splash_poison_potion' ? 'Poison à lancer pour animaux' : 'Poison pour animaux' : item.name,
      color: isAnimalPoison(kind) ? '#72a94b' : item.color,
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

export function isWoodBlock(kind: BlockKind) {
  const source = isStair(kind) ? stairSource(kind) : undefined;
  return kind === BlockKind.Wood || kind >= BlockKind.OakPlanks && kind <= BlockKind.AutumnPlanks
    || source === BlockKind.Wood || source !== undefined && source >= BlockKind.OakPlanks && source <= BlockKind.AutumnPlanks
    || isDoor(kind) || isTrapdoor(kind) || isChest(kind) || isLadder(kind) || isSign(kind) || isBed(kind);
}

export function miningSpeed(selection: SelectedKind, block: BlockKind) {
  if (typeof selection === 'number' || block === BlockKind.Bedrock) return 1;
  const meta = getItemMeta(selection);
  const material = isStair(block) ? stairSource(block) as BlockKind : block;
  const hardBlock = material === BlockKind.Stone || material === BlockKind.CoalOre || material === BlockKind.IronOre
    || material === BlockKind.GoldOre || material === BlockKind.DiamondOre || material === BlockKind.Ice
    || (material >= BlockKind.BeigeBrick && material <= BlockKind.ConcreteBlack);
  const softBlock = material === BlockKind.Grass || material === BlockKind.Dirt || material === BlockKind.Sand
    || material === BlockKind.Snow || material === BlockKind.AutumnGrass || material === BlockKind.ForestGrass || material === BlockKind.JungleGrass;
  const woodBlock = isWoodBlock(block);
  const foliage = block === BlockKind.Leaves || block === BlockKind.PineLeaves || block === BlockKind.AutumnLeaves || block === BlockKind.JungleLeaves || block === BlockKind.JungleVine;
  return (meta.category === 'pickaxe' && meta.shape !== 'axe' && hardBlock) || (meta.category === 'shovel' && softBlock)
    || (meta.shape === 'axe' && woodBlock) || (meta.shape === 'shears' && foliage)
    ? meta.efficiency ?? 1
    : 1;
}
