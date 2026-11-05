export const OUTFIT_ORDER = ['default', 'king', 'military', 'knight', 'explorer', 'princess', 'louis14', 'louis15', 'pirate', 'footballer', 'firefighter', 'police'] as const;
export type OutfitKind = (typeof OUTFIT_ORDER)[number];

export const OUTFITS: Record<OutfitKind, { name: string; description: string; body: string; legs: string; color: string }> = {
  default: { name: 'Tenue normale', description: 'Le style LouisBlox classique.', body: '', legs: '', color: '#4d83a7' },
  king: { name: 'Roi', description: 'Couronne dorée, cape royale et habit élégant.', body: '#8e303d', legs: '#3b335d', color: '#d8b33f' },
  military: { name: 'Militaire', description: 'Uniforme vert, casque et gilet.', body: '#526647', legs: '#344334', color: '#526647' },
  knight: { name: 'Chevalier', description: 'Armure argentée et casque de combat.', body: '#a8b7c3', legs: '#53626f', color: '#b7c5d0' },
  explorer: { name: 'Explorateur', description: 'Chapeau et sac pour les grandes aventures.', body: '#967148', legs: '#4a3e32', color: '#a6814c' },
  princess: { name: 'Princesse', description: 'Robe élégante et petite couronne.', body: '#c467a5', legs: '#8a457e', color: '#d68abb' },
  louis14: { name: 'Louis XIV', description: 'Grande perruque bouclée et habit royal.', body: '#2d467f', legs: '#2a304c', color: '#4b3528' },
  louis15: { name: 'Louis XV', description: 'Petite perruque poudrée et habit élégant.', body: '#6681a6', legs: '#454d69', color: '#d7d0c3' },
  pirate: { name: 'Pirate', description: 'Tricorne, manteau rouge, ceinture et bottes de corsaire.', body: '#7d2937', legs: '#302935', color: '#8e303d' },
  footballer: { name: 'Joueur de foot', description: 'Maillot rayé, short, chaussettes et chaussures de football.', body: '#397ab5', legs: '#253a50', color: '#397ab5' },
  firefighter: { name: 'Pompier', description: 'Casque jaune et uniforme avec bandes réfléchissantes.', body: '#343d42', legs: '#293238', color: '#e4b93e' },
  police: { name: 'Policier', description: 'Casquette, chemise bleue, ceinturon et uniforme.', body: '#4777a7', legs: '#283a53', color: '#4777a7' },
};

export function isOutfitKind(value: unknown): value is OutfitKind {
  return typeof value === 'string' && (OUTFIT_ORDER as readonly string[]).includes(value);
}

export const WIG_ORDER = ['auto', 'none', 'louis14', 'louis15'] as const;
export type WigKind = 'louis14' | 'louis15';
export type WigSelection = (typeof WIG_ORDER)[number];
export const WIGS: Record<WigSelection, { name: string; description: string; color: string }> = {
  auto: { name: 'Du costume', description: 'La perruque prévue avec les costumes Louis XIV et Louis XV.', color: '#8b929b' },
  none: { name: 'Sans perruque', description: 'Garde la coiffure normale du personnage.', color: '#a67b61' },
  louis14: { name: 'Perruque Louis XIV', description: 'Grande perruque brune à boucles, compatible avec tous les costumes.', color: '#4b3528' },
  louis15: { name: 'Perruque Louis XV', description: 'Petite perruque poudrée, compatible avec tous les costumes.', color: '#d7d0c3' },
};

export function isWigSelection(value: unknown): value is WigSelection {
  return typeof value === 'string' && (WIG_ORDER as readonly string[]).includes(value);
}

export function selectedWig(outfit: OutfitKind, selection: WigSelection): WigKind | null {
  if (selection === 'none') return null;
  if (selection !== 'auto') return selection;
  return outfit === 'louis14' || outfit === 'louis15' ? outfit : null;
}
