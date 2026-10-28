export const EXTRA_BLOCKS = {
  BeigeBrick: 21,
  WhiteBrick: 22,
  GrayBrick: 23,
  Glass: 24,
  ConcreteWhite: 25,
  ConcreteOrange: 26,
  ConcreteMagenta: 27,
  ConcreteLightBlue: 28,
  ConcreteYellow: 29,
  ConcreteLime: 30,
  ConcretePink: 31,
  ConcreteGray: 32,
  ConcreteLightGray: 33,
  ConcreteCyan: 34,
  ConcretePurple: 35,
  ConcreteBlue: 36,
  ConcreteBrown: 37,
  ConcreteGreen: 38,
  ConcreteRed: 39,
  ConcreteBlack: 40,
  OakSapling: 41,
  PineSapling: 42,
  AutumnSapling: 43,
} as const;

export type ExtraBlockKind = (typeof EXTRA_BLOCKS)[keyof typeof EXTRA_BLOCKS];
export const EXTRA_BLOCK_ORDER = Object.values(EXTRA_BLOCKS) as ExtraBlockKind[];
export const SAPLING_KINDS = [EXTRA_BLOCKS.OakSapling, EXTRA_BLOCKS.PineSapling, EXTRA_BLOCKS.AutumnSapling] as const;
export const isSapling = (kind: number) => (SAPLING_KINDS as readonly number[]).includes(kind);

function shade(hex: string, amount: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.max(0, Math.min(255, ((value >> shift) & 255) + amount));
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
}

function palette(color: string) {
  return [color, shade(color, 14), shade(color, -15), shade(color, 24), shade(color, -25)];
}

type ExtraBlockMeta = { name: string; color: string; hardness: number; palette: string[] };
function block(name: string, color: string, hardness: number): ExtraBlockMeta {
  return { name, color, hardness, palette: palette(color) };
}

export const EXTRA_BLOCK_META: Record<ExtraBlockKind, ExtraBlockMeta> = {
  [EXTRA_BLOCKS.BeigeBrick]: block('Brique beige', '#c8a77a', 2.2),
  [EXTRA_BLOCKS.WhiteBrick]: block('Brique blanche', '#e4e4df', 2.2),
  [EXTRA_BLOCKS.GrayBrick]: block('Brique grise', '#85898c', 2.2),
  [EXTRA_BLOCKS.Glass]: block('Verre', '#bfe8f2', 0.35),
  [EXTRA_BLOCKS.ConcreteWhite]: block('Béton blanc', '#d8dedc', 2.4),
  [EXTRA_BLOCKS.ConcreteOrange]: block('Béton orange', '#e88422', 2.4),
  [EXTRA_BLOCKS.ConcreteMagenta]: block('Béton magenta', '#b54bb4', 2.4),
  [EXTRA_BLOCKS.ConcreteLightBlue]: block('Béton bleu clair', '#56a7dd', 2.4),
  [EXTRA_BLOCKS.ConcreteYellow]: block('Béton jaune', '#e5c92c', 2.4),
  [EXTRA_BLOCKS.ConcreteLime]: block('Béton lime', '#67b83c', 2.4),
  [EXTRA_BLOCKS.ConcretePink]: block('Béton rose', '#e68ea3', 2.4),
  [EXTRA_BLOCKS.ConcreteGray]: block('Béton gris', '#555b60', 2.4),
  [EXTRA_BLOCKS.ConcreteLightGray]: block('Béton gris clair', '#9aa3a5', 2.4),
  [EXTRA_BLOCKS.ConcreteCyan]: block('Béton cyan', '#2c9aa0', 2.4),
  [EXTRA_BLOCKS.ConcretePurple]: block('Béton violet', '#743ba5', 2.4),
  [EXTRA_BLOCKS.ConcreteBlue]: block('Béton bleu', '#374ca5', 2.4),
  [EXTRA_BLOCKS.ConcreteBrown]: block('Béton marron', '#79523a', 2.4),
  [EXTRA_BLOCKS.ConcreteGreen]: block('Béton vert', '#3f7c3a', 2.4),
  [EXTRA_BLOCKS.ConcreteRed]: block('Béton rouge', '#b83935', 2.4),
  [EXTRA_BLOCKS.ConcreteBlack]: block('Béton noir', '#25282b', 2.4),
  [EXTRA_BLOCKS.OakSapling]: block('Pousse de chêne', '#4b8e3d', 0.15),
  [EXTRA_BLOCKS.PineSapling]: block('Pousse de sapin', '#2d6241', 0.15),
  [EXTRA_BLOCKS.AutumnSapling]: block('Pousse d’arbre d’automne', '#d8752f', 0.15),
};
