import type { AnimalKind } from './animals';

export const MEAT_NAMES: Record<AnimalKind, string> = {
  camel: 'Camel Meat',
  cow: 'Beef',
  horse: 'Horse Meat',
  pig: 'Pork',
  sheep: 'Mutton',
  chicken: 'Chicken',
  duck: 'Duck',
  bear: 'Bear Meat',
  deer: 'Venison',
  wolf: 'Wolf Meat',
  snowWolf: 'Snow Wolf Meat',
  snowBear: 'Polar Bear Meat',
  snowDeer: 'Snow Venison',
  zombie: 'Zombie Flesh',
  monkey: 'Monkey Meat',
  ocelot: 'Ocelot Meat',
  giraffe: 'Giraffe Meat',
  elephant: 'Elephant Meat',
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
  snowDeer: '#d9c4a7',
  zombie: '#657d43',
  monkey: '#7a4b2b',
  ocelot: '#c9a33a',
  giraffe: '#c29c5a',
  elephant: '#89969b',
};

export function createMeatInventory(): Record<AnimalKind, number> {
  return Object.fromEntries((Object.keys(MEAT_NAMES) as AnimalKind[]).map((kind) => [kind, 0])) as Record<AnimalKind, number>;
}
