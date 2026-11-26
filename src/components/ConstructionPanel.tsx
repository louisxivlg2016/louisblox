import { useEffect } from 'react';
import { CONSTRUCTION_INFO, purchaseConstruction, useConstructionStore } from '../game/constructions';
import type { ConstructionKind } from '../game/constructions';
import { requestPlay } from '../game/input';
import { translate } from '../game/language';
import { useGameStore } from '../game/store';
import { world } from '../game/world';
import { selectedItemPrice, sellSelectedItem } from '../game/shops';
import { sellableInventoryCount } from '../game/inventory';
import { selectionInfo } from '../game/items';
import { ItemIcon } from './ItemIcon';
import { allowsConstruction } from '../game/worldMode';

export function ConstructionPanel() {
  const open = useConstructionStore((state) => state.open);
  const setOpen = useConstructionStore((state) => state.setOpen);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  useEffect(() => {
    if (!allowsConstruction(gameplayMode)) setOpen(false);
  }, [gameplayMode, setOpen]);
  const coins = useGameStore((state) => state.coins);
  const selected = useGameStore((state) => state.selected);
  const price = selectedItemPrice(selected);
  const count = sellableInventoryCount(selected, useGameStore.getState());
  const stock = count;
  const canSell = price > 0 && stock > 0;
  if (!open || !allowsConstruction(gameplayMode)) return null;
  const close = () => {
    setOpen(false);
    void requestPlay();
  };
  const buy = (kind: ConstructionKind) => {
    if (purchaseConstruction(world, kind)) void requestPlay();
  };
  const info = CONSTRUCTION_INFO();
  return (
    <div className="construction-backdrop">
      <section className="construction-panel" role="dialog" aria-modal="true" aria-label={translate('Constructions préfabriquées', 'Prefabricated constructions')}>
        <header className="construction-header">
          <div><p className="eyebrow">{translate('CONSTRUCTION', 'CONSTRUCTION')}</p><h2>{translate('Bâtiments déjà construits', 'Ready-made buildings')}</h2></div>
          <button type="button" className="secondary-button" onClick={close} aria-label={translate('Fermer les constructions', 'Close constructions')}>{translate('Fermer', 'Close')}</button>
        </header>
        <p>{translate('Choisis un bâtiment. Il sera placé devant toi et sauvegardé dans ton monde.', 'Choose a building. It will be placed in front of you and saved in your world.')}</p>
        <p className="construction-balance">{translate('Monnaie', 'Coins')} · <strong>{coins}</strong></p>
        <div className="construction-sell">
          <ItemIcon kind={selected} />
          <div><strong>{translate('Vendre l’objet sélectionné', 'Sell selected item')}</strong><p>{selectionInfo(selected).name}{` · ${translate('stock', 'stock')} ${stock}`}{price > 0 ? ` · ${price} ${translate('pièces', 'coins')}` : ''}</p></div>
          <button type="button" data-sell-selected disabled={!canSell} onClick={() => sellSelectedItem()}>{translate('Vendre', 'Sell')}</button>
        </div>
        <p className="construction-hint">{translate('Choisis un objet dans ta barre rapide, puis ouvre Construction avec C pour le vendre.', 'Choose an item in your hotbar, then open Construction with C to sell it.')}</p>
        <div className="construction-list">
          {(Object.keys(info) as ConstructionKind[]).map((kind) => {
            const item = info[kind];
            return (
              <article className="construction-card" key={kind}>
                <div className={`construction-emblem construction-emblem-${kind}`} aria-hidden="true"><span /><i /><b /></div>
                <div><h3>{item.name}</h3><p>{item.description}</p></div>
                <button type="button" data-construction={kind} disabled={coins < item.cost} onClick={() => buy(kind)}>{translate(`Construire · ${item.cost} pièces`, `Build · ${item.cost} coins`)}</button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
