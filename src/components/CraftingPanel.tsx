import { useState } from 'react';
import { craftRecipe, recipeFor } from '../game/crafting';
import { inventoryCount } from '../game/inventory';
import { ITEM_ORDER, selectionInfo } from '../game/items';
import { GALLERY_ITEMS } from '../game/galleryCatalog';
import { HOTBAR_BLOCKS } from '../game/voxel';
import { useGameStore } from '../game/store';
import { ItemIcon } from './ItemIcon';

export function CraftingPanel() {
  const itemCounts = useGameStore((state) => state.itemCounts);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const [search, setSearch] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const state = { itemCounts, gameplayMode };
  const kinds = [...HOTBAR_BLOCKS, ...ITEM_ORDER, ...(showGallery ? GALLERY_ITEMS.map((item) => item.id) : [])];
  const recipes = kinds.map(recipeFor).filter((recipe) => recipe !== null)
    .filter((recipe) => selectionInfo(recipe.output).name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <section className="crafting-panel" aria-label="Fabrication">
      <div className="backpack-header">
        <div>
          <h3>Fabriquer</h3>
          <p className="boutique-hint">Récolte les ressources, puis fabrique chaque objet toi-même.</p>
        </div>
        <button className="secondary-button" onClick={() => setShowGallery((value) => !value)}>{showGallery ? 'Recettes principales' : 'Toutes les recettes'}</button>
      </div>
      <input type="search" aria-label="Rechercher une recette" placeholder="Rechercher un objet à fabriquer…" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="recipe-grid">
        {recipes.map((recipe) => {
          const possible = recipe.ingredients.every((ingredient) => inventoryCount(ingredient.kind, state) >= ingredient.count);
          return (
            <button key={String(recipe.output)} className={`recipe-card ${possible ? 'available' : 'locked'}`} disabled={!possible} onClick={() => craftRecipe(recipe.output)} aria-label={`Fabriquer ${selectionInfo(recipe.output).name}`}>
              <span className="recipe-title"><ItemIcon kind={recipe.output} /><strong>{selectionInfo(recipe.output).name}{recipe.count > 1 ? ` ×${recipe.count}` : ''}</strong></span>
              <span className="recipe-ingredients">
                {recipe.ingredients.map((ingredient) => (
                  <span key={String(ingredient.kind)} className={inventoryCount(ingredient.kind, state) >= ingredient.count ? 'ingredient-ready' : 'ingredient-missing'}>
                    {selectionInfo(ingredient.kind).name} {inventoryCount(ingredient.kind, state)}/{ingredient.count}
                  </span>
                ))}
              </span>
              <span className="recipe-action">{possible ? 'Fabriquer' : 'À récolter'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
