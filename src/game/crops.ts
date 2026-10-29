import { BlockKind } from './voxel';
import type { ItemKind } from './items';

export type CropDefinition = {
  name: string;
  food: ItemKind;
  yield: number;
  regrows: boolean;
  growthTime: number;
};

export const CROP_DEFINITIONS: Record<number, CropDefinition> = {
  [BlockKind.Corn]: { name: 'Maïs', food: 'corn', yield: 2, regrows: true, growthTime: 8 },
  [BlockKind.Wheat]: { name: 'Blé', food: 'wheat', yield: 3, regrows: false, growthTime: 8 },
  [BlockKind.Tomato]: { name: 'Tomates', food: 'tomato', yield: 3, regrows: true, growthTime: 8 },
  [BlockKind.Carrot]: { name: 'Carottes', food: 'carrot', yield: 3, regrows: false, growthTime: 8 },
  [BlockKind.Watermelon]: { name: 'Pastèque', food: 'watermelon', yield: 2, regrows: true, growthTime: 8 },
};

export function cropDefinition(kind: BlockKind) {
  return CROP_DEFINITIONS[kind];
}
