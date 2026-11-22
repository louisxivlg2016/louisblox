import { useRef, useState } from 'react';
import { requestPlay } from '../game/input';
import { getItemMeta, ITEM_ORDER, selectionInfo } from '../game/items';
import { GALLERY_CATEGORIES, GALLERY_ITEMS, GALLERY_ITEM_MAP } from '../game/galleryCatalog';
import type { SelectedKind } from '../game/items';
import { useGameStore } from '../game/store';
import { isPaintballGun, WHITE_PAINTBALL_GUN_ID } from '../game/paintball';
import { BlockKind, HOTBAR_BLOCKS } from '../game/voxel';
import { world } from '../game/world';
import { ItemIcon } from './ItemIcon';
import { CROP_KINDS, isCrop } from '../game/extraBlocks';
import { inventoryCount } from '../game/inventory';
import { CraftingPanel } from './CraftingPanel';
import { normalizeSearch } from '../game/search';
import { translate } from '../game/language';

export function Backpack() {
  const open = useGameStore((state) => state.backpackOpen);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const hotbarSlots = useGameStore((state) => state.hotbarSlots);
  const backpackItem = useGameStore((state) => state.backpackItem);
  const itemCounts = useGameStore((state) => state.itemCounts);
  const equippedArmor = useGameStore((state) => state.equippedArmor);
  const setHotbarSlot = useGameStore((state) => state.setHotbarSlot);
  const setBackpackItem = useGameStore((state) => state.setBackpackItem);
  const setBackpack = useGameStore((state) => state.setBackpack);
  const [sections, setSections] = useState({ blocks: true, crops: true, items: true, gallery: true });
  const [galleryCategory, setGalleryCategory] = useState('Tools & Weapons');
  const [gallerySearch, setGallerySearch] = useState('');
  const dragSlot = useRef<{ index: number; kind: SelectedKind; pointerId: number; x: number; y: number } | null>(null);
  const survival = gameplayMode === 'survival';
  const inventory = { itemCounts, gameplayMode };
  if (!open) return null;
  const close = () => {
    setBackpack(false);
    void requestPlay();
  };
  const assign = (index: number) => {
    if (backpackItem !== null) setHotbarSlot(index, backpackItem);
    else {
      const kind = hotbarSlots[index];
      if (kind !== null) useGameStore.getState().selectBlock(kind, index);
    }
  };
  const discardSlot = (index: number) => {
    const kind = hotbarSlots[index];
    if (kind === null) return;
    setHotbarSlot(index, null);
    if (useGameStore.getState().selected === kind && useGameStore.getState().selectedSlot === index) useGameStore.getState().selectBlock('hand');
  };
  const query = normalizeSearch(gallerySearch);
  const matchesSearch = (kind: SelectedKind) => {
    const firework = GALLERY_ITEM_MAP[kind as string]?.category === 'Firecrackers & Firecracker Pebbles';
    return normalizeSearch(selectionInfo(kind).name).includes(query)
      || (kind === BlockKind.Radio && ['radio', 'redio', 'musique', 'music'].includes(query))
      || (kind === 'gallery_tools_weapons_book' && translate('livre', 'book').includes(query))
      || (firework && ['feu', 'feux', 'feu d artifice', 'feux d artifice', 'feu d atifice', 'feux d atifice', 'firecracker'].includes(query));
  };
  const visibleGalleryItems = GALLERY_ITEMS.filter((item) =>
    (query !== '' || galleryCategory === 'all' || item.category === galleryCategory) && matchesSearch(item.id)
    && (!isPaintballGun(item.id) || item.id === WHITE_PAINTBALL_GUN_ID)
    && (!survival || inventoryCount(item.id, inventory) > 0),
  );
  const toggleSection = (key: keyof typeof sections) => setSections((current) => ({ ...current, [key]: !current[key] }));
  const itemButton = (kind: SelectedKind) => {
    const meta = selectionInfo(kind);
    const count = survival ? inventoryCount(kind, inventory) : typeof kind === 'string' && getItemMeta(kind).category === 'food'
      ? itemCounts[kind] ?? 1
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
        aria-label={translate(`Choisir ${meta.name}`, `Choose ${meta.name}`, `Elegir ${meta.name}`)}
      >
        <ItemIcon kind={kind} />
        <span>{meta.name}{count !== null ? ` ×${count}` : ''}{equipped ? translate(' · portée', ' · equipped') : ''}</span>
      </button>
    );
  };
  return (
    <div className="backpack-backdrop">
      <section className="backpack-panel" aria-label={translate('Sac à dos', 'Backpack')}>
        <div className="backpack-header">
          <h2>{survival ? translate('Survie · récolte et fabrication', 'Survival · gathering and crafting') : translate('Sac à dos', 'Backpack')}</h2>
          <button
            className="secondary-button"
            type="button"
            aria-label={translate('Fermer le sac à dos', 'Close backpack')}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              close();
            }}
            onClick={(event) => { if (event.detail === 0) close(); }}
          >{translate('Fermer', 'Close')}</button>
        </div>
        <div className="gallery-controls backpack-global-search">
          <input type="search" aria-label={translate('Rechercher dans le sac à dos', 'Search backpack')} placeholder={translate('Rechercher dans tout le sac…', 'Search the entire backpack…')} value={gallerySearch} onChange={(event) => setGallerySearch(event.target.value)} />
        </div>
        <div className="backpack-content">
          <fieldset className="backpack-categories"><legend>{translate('Catégories affichées', 'Visible categories')}</legend>{([
            ['blocks', translate('Blocs', 'Blocks')],
            ['crops', translate('Graines', 'Seeds')],
            ['items', translate('Objets', 'Items')],
            ['gallery', translate('Galerie', 'Gallery')],
          ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={sections[key]} onChange={() => toggleSection(key)} /> {label}</label>)}</fieldset>
          {sections.blocks && <><p className="backpack-label">{survival ? translate('Ressources récoltées', 'Gathered resources') : translate('Blocs, portes et trappes', 'Blocks, doors, and trapdoors')}</p>
          <div className="backpack-blocks">{HOTBAR_BLOCKS.filter((kind) => !isCrop(kind) && matchesSearch(kind) && (!survival || inventoryCount(kind, inventory) > 0)).map(itemButton)}</div></>}
          {sections.crops && <><p className="backpack-label">{translate('Graines et plants · sur herbe ou terre · E pour récolter quand c’est mûr', 'Seeds and crops · on grass or dirt · E to harvest when ripe')}</p>
          <div className="backpack-blocks">{CROP_KINDS.filter((kind) => matchesSearch(kind) && (!survival || inventoryCount(kind, inventory) > 0)).map(itemButton)}</div></>}
          {sections.items && <><p className="backpack-label">{survival ? translate('Objets fabriqués', 'Crafted items') : translate('Pioches, pelles, épées, armures et équipement · clic gauche pour miner ou utiliser', 'Pickaxes, shovels, swords, armor, and equipment · left click to mine or use')}</p>
          <div className="backpack-blocks">{ITEM_ORDER.filter((kind) => matchesSearch(kind) && (!survival || inventoryCount(kind, inventory) > 0)).map(itemButton)}</div></>}
          {survival && <CraftingPanel />}
          {sections.gallery && <><div className="gallery-controls">
            <select aria-label={translate('Catégorie de la galerie', 'Gallery category')} value={galleryCategory} onChange={(event) => setGalleryCategory(event.target.value)}>
              <option value="all">{translate('Toutes les catégories', 'All categories')}</option>
              {GALLERY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <p className="backpack-label">{translate(`${visibleGalleryItems.length} objets affichés`, `${visibleGalleryItems.length} items shown`, `${visibleGalleryItems.length} objetos mostrados`)}</p>
          <div className="backpack-blocks">{visibleGalleryItems.map((item) => itemButton(item.id))}</div></>}
        </div>
        <div className="backpack-active-area">
          <p className="backpack-label">{translate('Cases actives · choisis un objet puis une case, ou fais-le glisser', 'Active slots · choose an item then a slot, or drag it')}</p>
          <div className="backpack-active-slots">{hotbarSlots.map((kind, index) => (
            <div className="active-slot-container" key={`${kind ?? translate('vide', 'empty')}-${index}`}>
            <button
              className="backpack-block active-slot"
              onClick={() => assign(index)}
              draggable={kind !== null}
              onDragStart={(event) => {
                if (kind === null) return;
                event.dataTransfer.setData('text/plain', String(kind));
                setBackpackItem(kind);
              }}
              onDragEnd={(event) => {
                const moved = dragSlot.current !== null && Math.hypot(event.clientX - dragSlot.current.x, event.clientY - dragSlot.current.y) > 24;
                const outside = !document.elementFromPoint(event.clientX, event.clientY)?.closest('.backpack-panel');
                dragSlot.current = null;
                if (kind !== null && moved && outside && event.dataTransfer.dropEffect === 'none') discardSlot(index);
              }}
              onPointerDown={(event) => {
                if (kind === null) return;
                dragSlot.current = { index, kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerUp={(event) => {
                const drag = dragSlot.current;
                dragSlot.current = null;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const outside = !document.elementFromPoint(event.clientX, event.clientY)?.closest('.backpack-panel');
                if (outside && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 24) discardSlot(drag.index);
              }}
              onPointerCancel={() => { dragSlot.current = null; }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); assign(index); }}
              aria-label={`Slot ${index === 9 ? '0' : index + 1} : ${kind === null ? translate('vide', 'empty') : selectionInfo(kind).name}`}
              title={kind === null ? translate('Vide', 'Empty') : selectionInfo(kind).name}
            >
              <span className="active-slot-number">{index === 9 ? '0' : index + 1}</span>
              {kind !== null && <ItemIcon kind={kind} />}
            </button>
            {kind !== null && <button type="button" className="active-slot-drop" onClick={(event) => { event.stopPropagation(); discardSlot(index); }} aria-label={translate(`Jeter ${selectionInfo(kind).name}`, `Drop ${selectionInfo(kind).name}`, `Tirar ${selectionInfo(kind).name}`)}>{translate('Jeter', 'Drop', 'Tirar')}</button>}
            </div>
          ))}</div>
        </div>
      </section>
    </div>
  );
}
