import type { AnimalKind } from './animals';

export const MEAT_NAMES: Record<AnimalKind, string> = {
  camel: 'Viande de chameau',
  cow: 'Bœuf',
  horse: 'Viande de cheval',
  pig: 'Porc',
  sheep: 'Mouton',
  chicken: 'Poulet',
  duck: 'Canard',
  bear: 'Viande d’ours',
  deer: 'Venaison',
  wolf: 'Viande de loup',
  snowWolf: 'Viande de loup des neiges',
  snowBear: 'Viande d’ours blanc',
  zombie: 'Chair de zombie',
};

export const MEAT_COLORS: Record<AnimalKind, string> = {
  camel: '#b77b50',
  cow: '#9f3e3a',
  horse: '#895037',
  pig: '#ed929f',
  sheep: '#e5c7b8',
  chicken: '#f0d8c5',
  duck: '#c77d55',
  bear: '#63382e',
  deer: '#b85146',
  wolf: '#8c6663',
  snowWolf: '#d9c6c5',
  snowBear: '#ead9d4',
  zombie: '#657d43',
};

export function createMeatInventory(): Record<AnimalKind, number> {
  return Object.fromEntries((Object.keys(MEAT_NAMES) as AnimalKind[]).map((kind) => [kind, 0])) as Record<AnimalKind, number>;
}
