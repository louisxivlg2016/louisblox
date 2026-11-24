import { translate } from './language';

export const OUTFIT_ORDER = ['default', 'king', 'military', 'knight', 'explorer', 'princess', 'louis14', 'louis15', 'pirate', 'corsair', 'footballer', 'firefighter', 'worker', 'police', 'soldier', 'trader'] as const;
export type OutfitKind = (typeof OUTFIT_ORDER)[number];

export const OUTFITS = (): Record<OutfitKind, { name: string; description: string; body: string; legs: string; color: string }> => ({
  default: { name: translate('Tenue normale', 'Default Outfit'), description: translate('Le style LouisBlox classique.', 'The classic LouisBlox style.'), body: '#526b45', legs: '#38363b', color: '#526b45' },
  king: { name: translate('Roi', 'King'), description: translate('Couronne dorée, cape royale et habit élégant.', 'Golden crown, royal cape, and elegant outfit.'), body: '#8e303d', legs: '#3b335d', color: '#d8b33f' },
  military: { name: translate('Militaire', 'Military'), description: translate('Uniforme vert, casque et gilet.', 'Green uniform, helmet, and vest.'), body: '#526647', legs: '#344334', color: '#526647' },
  knight: { name: translate('Chevalier', 'Knight'), description: translate('Armure argentée et casque de combat.', 'Silver armor and combat helmet.'), body: '#a8b7c3', legs: '#53626f', color: '#b7c5d0' },
  explorer: { name: translate('Explorateur', 'Explorer'), description: translate('Chapeau et sac pour les grandes aventures.', 'Hat and bag for great adventures.'), body: '#967148', legs: '#4a3e32', color: '#a6814c' },
  princess: { name: translate('Princesse', 'Princess'), description: translate('Robe élégante et petite couronne.', 'Elegant dress and small crown.'), body: '#c467a5', legs: '#8a457e', color: '#d68abb' },
  louis14: { name: 'Louis XIV', description: translate('Grande perruque bouclée et habit royal.', 'Large curly wig and royal outfit.'), body: '#2d467f', legs: '#2a304c', color: '#4b3528' },
  louis15: { name: 'Louis XV', description: translate('Petite perruque poudrée et habit élégant.', 'Small powdered wig and elegant outfit.'), body: '#6681a6', legs: '#454d69', color: '#d7d0c3' },
  pirate: { name: 'Pirate', description: translate('Tricorne, manteau rouge, ceinture et bottes de corsaire.', 'Tricorn, red coat, belt, and pirate boots.'), body: '#7d2937', legs: '#302935', color: '#8e303d' },
  corsair: { name: translate('Pirate au bandeau', 'Bandana Pirate'), description: translate('Pirate avec bandeau rouge, cache-œil et chemise claire.', 'Pirate with red bandana, eye patch, and light shirt.'), body: '#3b2d27', legs: '#302935', color: '#8e303d' },
  footballer: { name: translate('Joueur de foot', 'Footballer'), description: translate('Maillot bleu numéro 10, short blanc, chaussettes bleues et cheveux blonds.', 'Blue number 10 jersey, white shorts, blue socks, and blond hair.'), body: '#2868b3', legs: '#f0f1eb', color: '#2868b3' },
  firefighter: { name: translate('Pompier', 'Firefighter'), description: translate('Casque jaune et uniforme avec bandes réfléchissantes.', 'Yellow helmet and uniform with reflective stripes.'), body: '#343d42', legs: '#293238', color: '#e4b93e' },
  worker: { name: translate('Travailleur', 'Construction Worker'), description: translate('Gilet fluorescent, casque de chantier et lampe frontale.', 'High-visibility vest, hard hat, and working headlamp.'), body: '#454d50', legs: '#30383c', color: '#ed7d24' },
  police: { name: translate('Policier', 'Police Officer'), description: translate('Casquette, chemise bleue, ceinturon et uniforme.', 'Cap, blue shirt, belt, and uniform.'), body: '#4777a7', legs: '#283a53', color: '#4777a7' },
  soldier: { name: translate('Soldat', 'Soldier'), description: translate('Uniforme bleu, bandoulières blanches, bicorne et baïonnette.', 'Blue uniform, white crossbelts, bicorne, and bayonet.'), body: '#293e74', legs: '#e4e7e1', color: '#293e74' },
  trader: { name: translate('Marchand', 'Trader'), description: translate('Turban bleu, tunique et ceinture dorée du marchand voyageur.', 'Blue turban, tunic, and golden belt of the traveling trader.'), body: '#49668b', legs: '#43352e', color: '#49668b' },
});

export function isOutfitKind(value: unknown): value is OutfitKind {
  return typeof value === 'string' && (OUTFIT_ORDER as readonly string[]).includes(value);
}

export const WIG_ORDER = ['auto', 'none', 'louis14', 'louis15'] as const;
export type WigKind = 'louis14' | 'louis15';
export type WigSelection = (typeof WIG_ORDER)[number];
export const WIGS = (): Record<WigSelection, { name: string; description: string; color: string }> => ({
  auto: { name: translate('Du costume', 'Costume Default'), description: translate('La perruque prévue avec les costumes Louis XIV et Louis XV.', 'The wig included with the Louis XIV and Louis XV costumes.'), color: '#8b929b' },
  none: { name: translate('Sans perruque', 'No Wig'), description: translate('Garde la coiffure normale du personnage.', 'Keeps the character’s normal hairstyle.'), color: '#a67b61' },
  louis14: { name: translate('Perruque Louis XIV', 'Louis XIV Wig'), description: translate('Grande perruque brune à boucles, compatible avec tous les costumes.', 'Large brown curly wig, compatible with every costume.'), color: '#4b3528' },
  louis15: { name: translate('Perruque Louis XV', 'Louis XV Wig'), description: translate('Petite perruque poudrée, compatible avec tous les costumes.', 'Small powdered wig, compatible with every costume.'), color: '#d7d0c3' },
});

export function isWigSelection(value: unknown): value is WigSelection {
  return typeof value === 'string' && (WIG_ORDER as readonly string[]).includes(value);
}

export function canRotateHead(_outfit: OutfitKind) {
  return true;
}

export function selectedWig(outfit: OutfitKind, selection: WigSelection): WigKind | null {
  if (selection === 'none') return null;
  if (selection !== 'auto') return selection;
  return outfit === 'louis14' || outfit === 'louis15' ? outfit : null;
}
