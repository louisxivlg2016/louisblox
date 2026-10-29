import { requestPlay } from '../game/input';
import { ITEM_META, ITEM_ORDER, selectionInfo } from '../game/items';
import type { SelectedKind } from '../game/items';
import { MEAT_NAMES } from '../game/meats';
import type { AnimalKind } from '../game/animals';
import { useGameStore } from '../game/store';
import { eatItem, eatMeat } from '../game/systems/itemSystem';
import { HOTBAR_BLOCKS } from '../game/voxel';
import { world } from '../game/world';
import { ItemIcon } from './ItemIcon';
import { CROP_KINDS, isCrop } from '../game/extraBlocks';

export function Backpack() {
  const open = useGameStore((state) => state.backpackOpen);
  const selected = useGameStore((state) => state.selected);
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
  if (!open) return null;
  const close = () => {
    setBackpack(false);
    void requestPlay();
  };
  const assign = (index: number) => {
    if (backpackItem !== null) setHotbarSlot(index, backpackItem);
    close();
  };
  const resources = (Object.entries(meat) as Array<[AnimalKind, number]>).filter(([, count]) => count > 0);
  const itemButton = (kind: SelectedKind) => {
    const meta = selectionInfo(kind);
    const count = typeof kind === 'string' && ITEM_META[kind].category === 'food'
      ? kind === 'apple' ? apples : itemCounts[kind]
      : null;
    const equipped = typeof kind === 'string' && ITEM_META[kind].category === 'armor' && ITEM_META[kind].armor === equippedArmor;
    return (
      <button
        key={kind}
        className={`backpack-block ${backpackItem === kind ? 'selected' : ''}`}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', String(kind));
          event.dataTransfer.effectAllowed = 'move';
          setBackpackItem(kind);
        }}
        onClick={() => setBackpackItem(kind)}
        aria-label={`Choisir ${meta.name}`}
      >
        <ItemIcon kind={kind} />
        <span>{meta.name}{count !== null ? ` ×${count}` : ''}{equipped ? ' · portée' : ''}</span>
      </button>
    );
  };
  return (
    <div className="backpack-backdrop">
      <section className="backpack-panel" aria-label="Sac à dos">
        <div className="backpack-header">
          <h2>Sac à dos</h2>
          <button className="secondary-button" onClick={close}>Fermer et reprendre</button>
        </div>
        <p className="backpack-label">Choisis un objet puis une case, ou fais-le glisser. La souris revient à la fermeture.</p>
        <div className="backpack-active-slots">{hotbarSlots.map((kind, index) => (
          <button key={`${kind}-${index}`} className="backpack-block active-slot" onClick={() => assign(index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); assign(index); }}>
            <ItemIcon kind={kind} /><span>{index === 9 ? '0' : index + 1} · {selectionInfo(kind).name}</span>
          </button>
        ))}</div>
        <p className="backpack-label">Blocs, portes et trappes</p>
        <div className="backpack-blocks">{HOTBAR_BLOCKS.filter((kind) => !isCrop(kind)).map(itemButton)}</div>
        <p className="backpack-label">Graines et plants · sur herbe ou terre · E pour récolter quand c’est mûr</p>
        <div className="backpack-blocks">{CROP_KINDS.map(itemButton)}</div>
        <p className="backpack-label">Épées, armures, arcs, pistolets, voitures et selle · E pour utiliser</p>
        <div className="backpack-blocks">{ITEM_ORDER.map(itemButton)}</div>
        <p className="backpack-label">Manger pour récupérer des vies</p>
        <div className="backpack-resources">
          {ITEM_ORDER.filter((kind) => ITEM_META[kind].category === 'food').map((kind) => (
            <div className="backpack-resource" key={kind}>
              <span>{ITEM_META[kind].name} · +{ITEM_META[kind].healing} vies</span>
              <button onClick={() => eatItem(world, kind)}>Manger</button>
            </div>
          ))}
          <div className="backpack-resource"><span>Pommes cueillies ×{apples}</span><button onClick={discardApple} disabled={apples === 0}>Jeter 1</button></div>
          {resources.map(([kind, count]) => (
            <div className="backpack-resource" key={kind}>
              <span>{MEAT_NAMES[kind]} ×{count}</span>
              <span><button onClick={() => eatMeat(world, kind)}>Manger</button> <button onClick={() => discardMeat(kind)}>Jeter 1</button></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
