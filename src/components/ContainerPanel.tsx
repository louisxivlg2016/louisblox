import { closeContainer, cookMeat, depositChest, withdrawChest } from '../game/containers';
import { selectionInfo } from '../game/items';
import { MEAT_NAMES } from '../game/meats';
import type { AnimalKind } from '../game/animals';
import { useGameStore } from '../game/store';
import { world } from '../game/world';
import { ItemIcon } from './ItemIcon';

export function ContainerPanel() {
  const container = useGameStore((state) => state.container);
  const items = useGameStore((state) => state.chestItems);
  const selected = useGameStore((state) => state.selected);
  const meat = useGameStore((state) => state.meat);
  const notice = useGameStore((state) => state.notice);
  if (!container) return null;
  return (
    <div className="backpack-backdrop">
      <section className="container-panel" aria-label={container.type === 'chest' ? 'Chest' : 'Furnace'}>
        <div className="backpack-header">
          <h2>{container.type === 'chest' ? 'Chest' : 'Furnace'}</h2>
          <button className="secondary-button" onClick={closeContainer}>Close and resume</button>
        </div>
        {container.type === 'chest' ? (
          <>
            <p className="backpack-label">24 slots · items stay in this chest after reloading</p>
            <button className="container-deposit" onClick={() => depositChest(world)}>Deposit: {selectionInfo(selected).name}</button>
            <div className="backpack-blocks">
              {items.map((item, index) => (
                <button className="backpack-block" key={`${item}-${index}`} onClick={() => withdrawChest(world, index)} aria-label={`Take ${selectionInfo(item).name}`}>
                  <ItemIcon kind={item} /><span>{selectionInfo(item).name}</span>
                </button>
              ))}
            </div>
            {items.length === 0 && <p className="container-empty">The chest is empty. Choose an item in your hotbar and deposit it.</p>}
          </>
        ) : (
          <>
            <p className="backpack-label">Cook animal meat · cooked meat restores 4 lives</p>
            <div className="backpack-resources">
              {(Object.entries(meat) as Array<[AnimalKind, number]>).map(([kind, count]) => (
                <div className="backpack-resource" key={kind}>
                  <span>{MEAT_NAMES[kind]} ×{count}</span>
                  <button disabled={count === 0} onClick={() => cookMeat(kind)}>Cook 1</button>
                </div>
              ))}
            </div>
          </>
        )}
        {notice && <p className="container-notice">{notice}</p>}
      </section>
    </div>
  );
}
