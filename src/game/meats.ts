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
};

export function createMeatInventory(): Record<AnimalKind, number> {
  return Object.fromEntries((Object.keys(MEAT_NAMES) as AnimalKind[]).map((kind) => [kind, 0])) as Record<AnimalKind, number>;
}
