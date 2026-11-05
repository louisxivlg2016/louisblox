import { canTrade, tradeWithMerchant, TRADE_OFFERS, useTradeStore } from '../game/trading';
import { requestPlay } from '../game/input';
import { selectionInfo } from '../game/items';
import { useGameStore } from '../game/store';
import { ItemIcon } from './ItemIcon';

export function TradingPanel() {
  const open = useTradeStore((state) => state.open);
  const message = useTradeStore((state) => state.message);
  const itemCounts = useGameStore((state) => state.itemCounts);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  if (!open) return null;
  const close = () => {
    useTradeStore.getState().setOpen(false);
    void requestPlay();
  };
  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel trade-panel" aria-label="Échange avec le marchand">
        <div className="backpack-header"><h2>Marchand ambulant</h2><button className="secondary-button" onClick={close}>Fermer et reprendre</button></div>
        <p>{gameplayMode === 'survival' ? 'Choisis une offre : les objets sont échangés réellement.' : 'Choisis une offre : elle est gratuite en mode créatif.'}</p>
        <div className="trade-offers">
          {TRADE_OFFERS.map((offer) => (
            <article className="trade-offer" data-offer={offer.id} key={offer.id}>
              <div className="trade-offer-items">
                <span><ItemIcon kind={offer.cost} /> {offer.costCount} {selectionInfo(offer.cost).name}</span>
                <span>→</span>
                <span><ItemIcon kind={offer.reward} /> {offer.rewardCount} {selectionInfo(offer.reward).name}</span>
              </div>
              <button className="primary-button" disabled={!canTrade(offer)} onClick={() => tradeWithMerchant(offer)}>Échanger</button>
            </article>
          ))}
        </div>
        {message && <p className="trade-message" role="status">{message}</p>}
        <span className="trade-inventory-note">Les quantités de ton sac sont utilisées. {Object.keys(itemCounts).length} types d’objets.</span>
      </section>
    </div>
  );
}
