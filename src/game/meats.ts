import type { AnimalKind } from './animals';
import { translate } from './language';

export const MEAT_NAMES = (): Record<AnimalKind, string> => ({
  camel: translate('Viande de chameau', 'Camel Meat'),
  cow: translate('Bœuf', 'Beef'),
  horse: translate('Viande de cheval', 'Horse Meat'),
  pig: translate('Porc', 'Pork'),
  sheep: translate('Mouton', 'Mutton'),
  chicken: translate('Poulet', 'Chicken'),
  duck: translate('Canard', 'Duck'),
  bear: translate('Viande d’ours', 'Bear Meat'),
  deer: translate('Venaison', 'Venison'),
  wolf: translate('Viande de loup', 'Wolf Meat'),
  snowWolf: translate('Viande de loup des neiges', 'Snow Wolf Meat'),
  snowBear: translate('Viande d’ours blanc', 'Polar Bear Meat'),
  snowDeer: translate('Venaison des neiges', 'Snow Venison'),
  zombie: translate('Chair de zombie', 'Zombie Flesh'),
  monkey: translate('Viande de singe', 'Monkey Meat'),
  ocelot: translate('Viande d’ocelot', 'Ocelot Meat'),
  giraffe: translate('Viande de girafe', 'Giraffe Meat'),
  elephant: translate('Viande d’éléphant', 'Elephant Meat'),
});

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
  return Object.fromEntries((Object.keys(MEAT_NAMES()) as AnimalKind[]).map((kind) => [kind, 0])) as Record<AnimalKind, number>;
}
