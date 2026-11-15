import { useState } from 'react';
import { requestPlay } from '../game/input';
import { getItemMeta, ITEM_ORDER, selectionInfo } from '../game/items';
import { GALLERY_CATEGORIES, GALLERY_ITEMS } from '../game/galleryCatalog';
import type { SelectedKind } from '../game/items';
import { MEAT_NAMES } from '../game/meats';
import type { AnimalKind } from '../game/animals';
import { useGameStore } from '../game/store';
import { eatItem, eatMeat } from '../game/systems/itemSystem';
import { placeMeat } from '../game/foods';
import { isPaintballGun, WHITE_PAINTBALL_GUN_ID } from '../game/paintball';
import { HOTBAR_BLOCKS } from '../game/voxel';
import { world } from '../game/world';
import { ItemIcon } from './ItemIcon';
import { CROP_KINDS, isCrop } from '../game/extraBlocks';
import { inventoryCount } from '../game/inventory';
import { CraftingPanel } from './CraftingPanel';
import { normalizeSearch } from '../game/search';

export function Backpack() {
  const open = useGameStore((state) => state.backpackOpen);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const hotbarSlots = useGameStore((state) => state.hotbarSlots);
  const backpackItem = useGameStore((state) => state.backpackItem);
  const itemCounts = useGameStore((state) => state.itemCounts);
  const equippedArmor = useGameStore((state) => state.equippedArmor);
  const apples = useGameStore((state) => state.apples);
  const meat = useGameStore((state) => state.meat);
  const setHotbarSlot = useGameStore((state) => state.setHotbarSlot);
  const setBackpackItem = useGameStore((state) => state.setBackpackItem);
  const setBackpack = useGameStore((state) => state.setBackpack);
  const discardApple = useGameStore((state) => state.discardApple);
  const discardMeat = useGameStore((state) => state.discardMeat);
  const [galleryCategory, setGalleryCategory] = useState('Tools & Weapons');
  const [gallerySearch, setGallerySearch] = useState('');
  const survival = gameplayMode === 'survival';
  const inventory = { itemCounts, gameplayMode };
  if (!open) return null;
  const close = () => {
    setBackpack(false);
    void requestPlay();
  };
  const assign = (index: number) => {
    if (backpackItem !== null) setHotbarSlot(index, backpackItem);
  };
  const resources = (Object.entries(meat) as Array<[AnimalKind, number]>).filter(([, count]) => count > 0);
  const query = normalizeSearch(gallerySearch);
  const matchesSearch = (kind: SelectedKind) => normalizeSearch(selectionInfo(kind).name).includes(query)
    || (kind === 'gallery_tools_weapons_book' && 'book'.includes(query));
  const visibleGalleryItems = GALLERY_ITEMS.filter((item) =>
    (query !== '' || galleryCategory === 'all' || item.category === galleryCategory) && matchesSearch(item.id)
    && (!isPaintballGun(item.id) || item.id === WHITE_PAINTBALL_GUN_ID)
    && (!survival || inventoryCount(item.id, inventory) > 0),
  );
  const itemButton = (kind: SelectedKind) => {
    const meta = selectionInfo(kind);
    const count = survival ? inventoryCount(kind, inventory) : typeof kind === 'string' && getItemMeta(kind).category === 'food'
      ? kind === 'apple' ? apples : itemCounts[kind] ?? 1
      : null;
    const equipped = typeof kind === 'string' && getItemMeta(kind).category === 'armor' && getItemMeta(kind).armor === equippedArmor;
    return (
      <button
        key={kind}
        className={`backpack-block ${backpackItem === kind ? 'selected' : ''}`}
        draggable
        disabled={count === 0}
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', String(kind));
          event.dataTransfer.effectAllowed = 'move';
          setBackpackItem(kind);
        }}
        onClick={() => setBackpackItem(kind)}
        aria-label={`Choose ${meta.name}`}
      >
        <ItemIcon kind={kind} />
        <span>{meta.name}{count !== null ? ` ×${count}` : ''}{equipped ? ' · equipped' : ''}</span>
      </button>
    );
  };
  return (
    <div className="backpack-backdrop">
      <section className="backpack-panel" aria-label="Backpack">
        <div className="backpack-header">
          <h2>{survival ? 'Survival · gathering and crafting' : 'Backpack'}</h2>
          <button
            className="secondary-button"
            type="button"
            aria-label="Close backpack"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              close();
            }}
            onClick={(event) => { if (event.detail === 0) close(); }}
          >Close</button>
        </div>
        <div className="gallery-controls backpack-global-search">
          <input type="search" aria-label="Search backpack" placeholder="Search the entire backpack…" value={gallerySearch} onChange={(event) => setGallerySearch(event.target.value)} />
        </div>
        <div className="backpack-content">
          <p className="backpack-label">{survival ? 'Gathered resources' : 'Blocks, doors, and trapdoors'}</p>
          <div className="backpack-blocks">{HOTBAR_BLOCKS.filter((kind) => !isCrop(kind) && matchesSearch(kind) && (!survival || inventoryCount(kind, inventory) > 0)).map(itemButton)}</div>
          <p className="backpack-label">Seeds and crops · on grass or dirt · E to harvest when ripe</p>
          <div className="backpack-blocks">{CROP_KINDS.filter((kind) => matchesSearch(kind) && (!survival || inventoryCount(kind, inventory) > 0)).map(itemButton)}</div>
          <p className="backpack-label">{survival ? 'Crafted items' : 'Pickaxes, shovels, swords, armor, and equipment · left click to mine or use'}</p>
          <div className="backpack-blocks">{ITEM_ORDER.filter((kind) => matchesSearch(kind) && (!survival || inventoryCount(kind, inventory) > 0)).map(itemButton)}</div>
          {survival && <CraftingPanel />}
          <div className="gallery-controls">
            <select aria-label="Gallery category" value={galleryCategory} onChange={(event) => setGalleryCategory(event.target.value)}>
              <option value="all">All categories</option>
              {GALLERY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <p className="backpack-label">{visibleGalleryItems.length} items shown</p>
          <div className="backpack-blocks">{visibleGalleryItems.map((item) => itemButton(item.id))}</div>
          <p className="backpack-label">Eat to restore lives</p>
          <div className="backpack-resources">
            {ITEM_ORDER.filter((kind) => getItemMeta(kind).category === 'food' && (!survival || inventoryCount(kind, inventory) > 0)).map((kind) => (
              <div className="backpack-resource" key={kind}>
                <span>{getItemMeta(kind).name} · +{getItemMeta(kind).healing} vies</span>
                <button onClick={() => eatItem(world, kind)}>Eat</button>
              </div>
            ))}
            <div className="backpack-resource"><span>Collected apples ×{apples}</span><span><button onClick={() => eatItem(world, 'apple')} disabled={apples === 0}>Eat</button> <button onClick={discardApple} disabled={apples === 0}>Drop 1</button></span></div>
            {resources.map(([kind, count]) => (
              <div className="backpack-resource" key={kind}>
                <span>{MEAT_NAMES[kind]} ×{count}</span>
                <span><button onClick={() => eatMeat(world, kind)}>Eat</button> <button onClick={() => { if (placeMeat(world, kind)) close(); }}>Place</button> <button onClick={() => discardMeat(kind)}>Drop 1</button></span>
              </div>
            ))}
          </div>
        </div>
        <div className="backpack-active-area">
          <p className="backpack-label">Active slots · choose an item then a slot, or drag it</p>
          <div className="backpack-active-slots">{hotbarSlots.map((kind, index) => (
            <button
              key={`${kind ?? 'empty'}-${index}`}
              className="backpack-block active-slot"
              onClick={() => assign(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); assign(index); }}
              aria-label={`Slot ${index === 9 ? '0' : index + 1} : ${kind === null ? 'empty' : selectionInfo(kind).name}`}
              title={kind === null ? 'Empty' : selectionInfo(kind).name}
            >
              <span className="active-slot-number">{index === 9 ? '0' : index + 1}</span>
              {kind !== null && <ItemIcon kind={kind} />}
            </button>
          ))}</div>
        </div>
      </section>
    </div>
  );
}
