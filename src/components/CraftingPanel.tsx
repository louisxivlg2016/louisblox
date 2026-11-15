import { useState } from 'react';
import { craftRecipe, recipeFor } from '../game/crafting';
import { inventoryCount } from '../game/inventory';
import { ITEM_ORDER, selectionInfo } from '../game/items';
import { GALLERY_ITEMS } from '../game/galleryCatalog';
import { HOTBAR_BLOCKS } from '../game/voxel';
import { useGameStore } from '../game/store';
import { ItemIcon } from './ItemIcon';
import { matchesSearch } from '../game/search';

export function CraftingPanel() {
  const itemCounts = useGameStore((state) => state.itemCounts);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const [search, setSearch] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const state = { itemCounts, gameplayMode };
  const kinds = [...HOTBAR_BLOCKS, ...ITEM_ORDER, ...(showGallery ? GALLERY_ITEMS.map((item) => item.id) : [])];
  const recipes = kinds.map(recipeFor).filter((recipe) => recipe !== null)
    .filter((recipe) => matchesSearch(selectionInfo(recipe.output).name, search));

  return (
    <section className="crafting-panel" aria-label="Crafting">
      <div className="backpack-header">
        <div>
          <h3>Craft</h3>
          <p className="boutique-hint">Gather resources, then craft each item yourself.</p>
        </div>
        <button className="secondary-button" onClick={() => setShowGallery((value) => !value)}>{showGallery ? 'Main recipes' : 'All recipes'}</button>
      </div>
      <input type="search" aria-label="Search recipes" placeholder="Search for an item to craft…" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="recipe-grid">
        {recipes.map((recipe) => {
          const possible = recipe.ingredients.every((ingredient) => inventoryCount(ingredient.kind, state) >= ingredient.count);
          return (
            <button key={String(recipe.output)} className={`recipe-card ${possible ? 'available' : 'locked'}`} disabled={!possible} onClick={() => craftRecipe(recipe.output)} aria-label={`Craft ${selectionInfo(recipe.output).name}`}>
              <span className="recipe-title"><ItemIcon kind={recipe.output} /><strong>{selectionInfo(recipe.output).name}{recipe.count > 1 ? ` ×${recipe.count}` : ''}</strong></span>
              <span className="recipe-ingredients">
                {recipe.ingredients.map((ingredient) => (
                  <span key={String(ingredient.kind)} className={inventoryCount(ingredient.kind, state) >= ingredient.count ? 'ingredient-ready' : 'ingredient-missing'}>
                    {selectionInfo(ingredient.kind).name} {inventoryCount(ingredient.kind, state)}/{ingredient.count}
                  </span>
                ))}
              </span>
              <span className="recipe-action">{possible ? 'Craft' : 'Gather resources'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
