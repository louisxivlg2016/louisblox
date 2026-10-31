import { BlockKind } from './voxel';
import { getItemMeta, selectionInfo } from './items';
import type { SelectedKind } from './items';
import { isGalleryItem } from './galleryCatalog';
import { changeInventory, inventoryCount } from './inventory';
import { useGameStore } from './store';

export type Recipe = {
  output: SelectedKind;
  count: number;
  ingredients: Array<{ kind: SelectedKind; count: number }>;
};

const recipe = (output: SelectedKind, count: number, ingredients: Array<[SelectedKind, number]>): Recipe => ({
  output,
  count,
  ingredients: ingredients.map(([kind, amount]) => ({ kind, count: amount })),
});

function materialFor(name: string): BlockKind {
  const value = name.toLowerCase();
  if (value.includes('diamond') || value.includes('moonstone') || value.includes('lunite')) return BlockKind.DiamondOre;
  if (value.includes('gold')) return BlockKind.GoldOre;
  if (value.includes('iron') || value.includes('steel') || value.includes('knight') || value.includes('military')) return BlockKind.IronOre;
  if (value.includes('stone')) return BlockKind.Stone;
  return BlockKind.Wood;
}

function blockRecipe(kind: BlockKind): Recipe | null {
  if (kind === BlockKind.OakPlanks || kind === BlockKind.PinePlanks || kind === BlockKind.AutumnPlanks) return recipe(kind, 4, [[BlockKind.Wood, 1]]);
  if (kind >= BlockKind.DoorWhite && kind <= BlockKind.DoorBlack) return recipe(kind, 1, [[BlockKind.OakPlanks, 3]]);
  if (kind >= BlockKind.TrapdoorWhite && kind <= BlockKind.TrapdoorBlack) return recipe(kind, 1, [[BlockKind.OakPlanks, 2]]);
  if (kind >= BlockKind.Bed && kind <= BlockKind.BedBlack) return recipe(kind, 1, [[BlockKind.OakPlanks, 3], [BlockKind.Leaves, 2]]);
  if (kind >= BlockKind.BeigeBrick && kind <= BlockKind.GrayBrick) return recipe(kind, 1, [[BlockKind.Stone, 3]]);
  if (kind >= BlockKind.ConcreteWhite && kind <= BlockKind.ConcreteBlack) return recipe(kind, 1, [[BlockKind.Stone, 2], [BlockKind.Sand, 1]]);
  if (kind === BlockKind.Glass) return recipe(kind, 1, [[BlockKind.Sand, 2], [BlockKind.CoalOre, 1]]);
  if (kind === BlockKind.Chest) return recipe(kind, 1, [[BlockKind.OakPlanks, 4]]);
  if (kind === BlockKind.Furnace) return recipe(kind, 1, [[BlockKind.Stone, 8]]);
  if (kind === BlockKind.Sign) return recipe(kind, 1, [[BlockKind.OakPlanks, 2], ['stick', 1]]);
  if (kind === BlockKind.Ladder) return recipe(kind, 2, [['stick', 3]]);
  if (kind === BlockKind.Rail) return recipe(kind, 4, [[BlockKind.IronOre, 2], ['stick', 1]]);
  if (kind === BlockKind.Candle) return recipe(kind, 1, [[BlockKind.CoalOre, 1], ['stick', 1]]);
  if (kind === BlockKind.Tnt) return recipe(kind, 1, [[BlockKind.CoalOre, 2], [BlockKind.Sand, 3]]);
  if (kind === BlockKind.Campfire) return recipe(kind, 1, [[BlockKind.Wood, 2], [BlockKind.CoalOre, 1]]);
  if (kind === BlockKind.Wildfire) return recipe(kind, 1, [[BlockKind.CoalOre, 2], [BlockKind.Wood, 1]]);
  if (kind >= BlockKind.Corn && kind <= BlockKind.Watermelon) return recipe(kind, 1, [[BlockKind.Wheat, 1]]);
  return null;
}

export function recipeFor(kind: SelectedKind): Recipe | null {
  if (typeof kind === 'number') return blockRecipe(kind);
  if (kind === 'hand') return null;
  if (kind === 'stick') return recipe('stick', 4, [[BlockKind.OakPlanks, 2]]);
  if (kind === 'bread') return recipe('bread', 1, [[BlockKind.Wheat, 3]]);
  const meta = getItemMeta(kind);
  const shape = meta.shape ?? meta.category;
  const material = materialFor(meta.name);
  if (meta.category === 'sword') return recipe(kind, 1, [[material, 2], ['stick', 1]]);
  if (meta.category === 'pickaxe') return recipe(kind, 1, [[material, 3], ['stick', 2]]);
  if (meta.category === 'shovel') return recipe(kind, 1, [[material, 1], ['stick', 2]]);
  if (meta.category === 'armor') return recipe(kind, 1, [[material, 4]]);
  if (meta.category === 'bow') return recipe(kind, 1, [['stick', 3], [BlockKind.Leaves, 2]]);
  if (meta.category === 'gun') return recipe(kind, 1, [[BlockKind.IronOre, 3], [BlockKind.Wood, 1]]);
  if (meta.category === 'saddle') return recipe(kind, 1, [[BlockKind.Leaves, 3], [BlockKind.IronOre, 1]]);
  if (meta.category === 'vehicle') {
    if (kind === 'boat' || shape === 'boat') return recipe(kind, 1, [[BlockKind.OakPlanks, 5]]);
    if (kind === 'plane') return recipe(kind, 1, [[BlockKind.IronOre, 8], [BlockKind.OakPlanks, 4]]);
    if (kind === 'train') return recipe(kind, 1, [[BlockKind.IronOre, 10], [BlockKind.OakPlanks, 6]]);
    return recipe(kind, 1, [[BlockKind.IronOre, 4], [BlockKind.OakPlanks, 2]]);
  }
  if (!isGalleryItem(kind)) return null;
  if (shape === 'hoe') return recipe(kind, 1, [[material, 2], ['stick', 2]]);
  if (shape === 'shears') return recipe(kind, 1, [[BlockKind.IronOre, 2]]);
  if (shape === 'fishing_rod') return recipe(kind, 1, [['stick', 3], [BlockKind.Leaves, 2]]);
  if (shape === 'compass') return recipe(kind, 1, [[BlockKind.IronOre, 2], [BlockKind.DiamondOre, 1]]);
  if (shape === 'clock') return recipe(kind, 1, [[BlockKind.GoldOre, 2]]);
  if (shape === 'map') return recipe(kind, 1, [[BlockKind.Wheat, 2], [BlockKind.Leaves, 1]]);
  if (shape === 'book') return recipe(kind, 1, [[BlockKind.Wheat, 3], [BlockKind.Leaves, 1]]);
  if (shape === 'bone_meal') return recipe(kind, 1, [[BlockKind.Leaves, 2]]);
  if (shape === 'updraft') return recipe(kind, 1, [[BlockKind.DiamondOre, 1], [BlockKind.Leaves, 3]]);
  if (shape === 'snowdash') return recipe(kind, 1, [[BlockKind.Snow, 3]]);
  if (shape === 'hang_glider') return recipe(kind, 1, [[BlockKind.Leaves, 3], ['stick', 2]]);
  if (shape === 'plant' || shape === 'flower' || shape === 'mushroom') return recipe(kind, 1, [[BlockKind.Leaves, 1]]);
  if (shape === 'seed') return recipe(kind, 1, [[BlockKind.Wheat, 1]]);
  if (shape === 'bowl') return recipe(kind, 1, [[BlockKind.Wheat, 2]]);
  if (shape === 'potion') return recipe(kind, 1, [[BlockKind.CoalOre, 1], [BlockKind.Wheat, 1]]);
  if (shape === 'splash_potion') return recipe(kind, 1, [[BlockKind.CoalOre, 2], [BlockKind.Wheat, 1]]);
  if (shape === 'arrow_potion') return recipe(kind, 1, [[BlockKind.CoalOre, 1], [BlockKind.Wheat, 1], ['stick', 1]]);
  if (shape === 'firecracker' || shape === 'bomb') return recipe(kind, 1, [[BlockKind.CoalOre, 2], [BlockKind.Sand, 2]]);
  if (shape === 'pebble' || shape === 'ball') return recipe(kind, 1, [[shape === 'ball' ? BlockKind.Snow : BlockKind.Stone, 1]]);
  if (shape === 'arrow') return recipe(kind, 1, [['stick', 1], [BlockKind.Stone, 1]]);
  if (shape === 'ammo') return recipe(kind, 1, [[BlockKind.IronOre, 1]]);
  if (shape === 'bed') return recipe(kind, 1, [[BlockKind.OakPlanks, 3], [BlockKind.Leaves, 2]]);
  if (shape === 'pod') return recipe(kind, 1, [[BlockKind.Leaves, 2]]);
  if (shape === 'banner' || shape === 'arrow_sign') return recipe(kind, 1, [[BlockKind.OakPlanks, 2], ['stick', 1]]);
  if (shape === 'spawn_orb') return recipe(kind, 1, [[BlockKind.DiamondOre, 1], [BlockKind.Leaves, 2]]);
  if (shape === 'spawner') return recipe(kind, 1, [[BlockKind.Stone, 4], [BlockKind.DiamondOre, 1]]);
  if (shape === 'catcher') return recipe(kind, 1, [[BlockKind.IronOre, 2], [BlockKind.Leaves, 2]]);
  if (shape === 'ice_bridge') return recipe(kind, 1, [[BlockKind.Ice, 3]]);
  if (shape === 'tower') return recipe(kind, 1, [[BlockKind.Stone, 4]]);
  if (shape === 'balloon') return recipe(kind, 1, [[BlockKind.Leaves, 2], ['stick', 1]]);
  if (shape === 'stick') return recipe(kind, 1, [[BlockKind.Wood, 1]]);
  return null;
}

export function craftRecipe(kind: SelectedKind) {
  const selected = recipeFor(kind);
  if (!selected) return false;
  const store = useGameStore.getState();
  const missing = selected.ingredients.filter((ingredient) => inventoryCount(ingredient.kind, store) < ingredient.count);
  if (missing.length > 0) {
    store.setNotice(`Il manque : ${missing.map((ingredient) => `${ingredient.count} ${selectionInfo(ingredient.kind).name}`).join(', ')}.`);
    return false;
  }
  for (const ingredient of selected.ingredients) changeInventory(ingredient.kind, -ingredient.count);
  changeInventory(selected.output, selected.count);
  store.setNotice(`${selectionInfo(selected.output).name} fabriqué.`);
  return true;
}
