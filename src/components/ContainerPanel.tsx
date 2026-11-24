import { closeContainer, cookMeat, depositChest, withdrawChest } from '../game/containers';
import { selectionInfo } from '../game/items';
import type { SelectedKind } from '../game/items';
import { MEAT_NAMES } from '../game/meats';
import type { AnimalKind } from '../game/animals';
import { useGameStore } from '../game/store';
import { world } from '../game/world';
import { ItemIcon } from './ItemIcon';
import { translate } from '../game/language';

export function ContainerPanel() {
  const container = useGameStore((state) => state.container);
  const items = useGameStore((state) => state.chestItems);
  const selected = useGameStore((state) => state.selected);
  const meat = useGameStore((state) => state.meat);
  const notice = useGameStore((state) => state.notice);
  if (!container) return null;
  const grouped = new Map<SelectedKind, { count: number; index: number }>();
  for (const [index, item] of items.entries()) {
    const current = grouped.get(item);
    if (current) current.count += 1;
    else grouped.set(item, { count: 1, index });
  }
  return (
    <div className="backpack-backdrop">
      <section className="container-panel" aria-label={container.type === 'chest' ? translate('Coffre', 'Chest') : translate('Four', 'Furnace')}>
        <div className="backpack-header">
          <h2>{container.type === 'chest' ? translate('Coffre', 'Chest') : translate('Four', 'Furnace')}</h2>
          <button className="secondary-button" onClick={closeContainer}>{translate('Fermer et reprendre', 'Close and resume')}</button>
        </div>
        {container.type === 'chest' ? (
          <>
            <p className="backpack-label">{translate('24 places · les objets restent dans ce coffre après rechargement', '24 slots · items stay in this chest after reloading')}</p>
            <button className="container-deposit" onClick={() => depositChest(world)}>Deposit: {selectionInfo(selected).name}</button>
            <div className="backpack-blocks">
              {[...grouped].map(([item, { count, index }]) => (
                <button className="backpack-block" key={item} onClick={() => withdrawChest(world, index)} aria-label={translate(`Prendre ${selectionInfo(item).name}`, `Take ${selectionInfo(item).name}`, `Tomar ${selectionInfo(item).name}`)}>
                  <ItemIcon kind={item} /><span>{selectionInfo(item).name}{count > 1 ? ` ×${count}` : ''}</span>
                </button>
              ))}
            </div>
            {items.length === 0 && <p className="container-empty">{translate('Le coffre est vide. Choisis un objet dans ta barre rapide puis dépose-le.', 'The chest is empty. Choose an item in your hotbar and deposit it.')}</p>}
          </>
        ) : (
          <>
            <p className="backpack-label">{translate('Cuisiner la viande des animaux · la viande cuite rend 4 vies', 'Cook animal meat · cooked meat restores 4 lives')}</p>
            <div className="backpack-resources">
              {(Object.entries(meat) as Array<[AnimalKind, number]>).map(([kind, count]) => (
                <div className="backpack-resource" key={kind}>
                  <span>{MEAT_NAMES()[kind]} ×{count}</span>
                  <button disabled={count === 0} onClick={() => cookMeat(kind)}>{translate('Cuire 1', 'Cook 1')}</button>
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
