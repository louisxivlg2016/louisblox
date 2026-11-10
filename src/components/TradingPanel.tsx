import { useEffect } from 'react';
import { acceptRestaurantInvitation, advanceTraderStory, canTrade, eatRestaurantMeal, MERCHANT_STORIES, openRestaurant, tradeWithMerchant, TRADE_OFFERS, useTradeStore } from '../game/trading';
import { world } from '../game/world';
import { requestPlay } from '../game/input';
import { selectionInfo } from '../game/items';
import { useGameStore } from '../game/store';
import { ItemIcon } from './ItemIcon';

export function TradingPanel() {
  const open = useTradeStore((state) => state.open);
  const message = useTradeStore((state) => state.message);
  const view = useTradeStore((state) => state.view);
  const story = useTradeStore((state) => state.story);
  const storyId = useTradeStore((state) => state.storyId);
  const step = useTradeStore((state) => state.step);
  const traderId = useTradeStore((state) => state.traderId);
  const following = useTradeStore((state) => state.following);
  const mealEaten = useTradeStore((state) => state.mealEaten);
  useEffect(() => {
    if (!open || (view !== 'story' && view !== 'village') || following) return;
    const next = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || event.repeat) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      advanceTraderStory(traderId);
    };
    window.addEventListener('keydown', next, true);
    return () => window.removeEventListener('keydown', next, true);
  }, [open, view, following, traderId, step]);
  const itemCounts = useGameStore((state) => state.itemCounts);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  if (!open) return null;
  const definition = MERCHANT_STORIES[storyId] ?? MERCHANT_STORIES[0];
  const lastStep = definition.steps.length - 1;
  const close = () => {
    useTradeStore.getState().setOpen(false);
    void requestPlay();
  };
  const accompany = () => {
    useTradeStore.getState().setFollowing(true);
    useGameStore.getState().setNotice('Suis le marchand jusqu’à la ville, à environ 1 km. Il t’attend si tu t’éloignes.');
    close();
  };
  const stopAccompanying = () => {
    useTradeStore.getState().setFollowing(false);
    useGameStore.getState().setNotice('Tu reprends la route seul.');
    close();
  };
  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel trade-panel" aria-label="Discussion avec le marchand">
        <div className="backpack-header"><h2>{view === 'village' ? 'Habitant du village' : view === 'restaurant' ? 'Restaurant du village' : 'Marchand ambulant'}</h2><button className="secondary-button" onClick={close}>Fermer et reprendre</button></div>
        {view === 'village' ? (
          <div className="trade-story" role="status">
            <p>{story}</p>
            <div className="trade-story-actions">
              <button className="primary-button" aria-keyshortcuts="E" onClick={() => advanceTraderStory(traderId)}>Parler encore (E)</button>
              <button className="secondary-button" onClick={openRestaurant}>L’invitation au restaurant</button>
            </div>
          </div>
        ) : view === 'restaurant' ? (
          <div className="trade-story" role="status">
            <p>{story}</p>
            <p>Au menu : pain, maïs et fromage. Le marchand offre le repas aux voyageurs.</p>
            <div className="trade-story-actions">
              <button className="primary-button" onClick={() => acceptRestaurantInvitation(world)}>Aller au restaurant</button>
              <button className="secondary-button" disabled={mealEaten} onClick={() => eatRestaurantMeal(world)}>Manger le repas · +4 vie</button>
            </div>
            {message && <p className="trade-message">{message}</p>}
          </div>
        ) : view === 'story' ? (
          <div className="trade-story" role="status">
            <p><strong>{definition.title}</strong> · Récit {step + 1} / {definition.steps.length}</p>
            <p>{following ? definition.companion : story}</p>
            {!following && step < lastStep && <p>Reste près de moi pour écouter la suite, ou avance le récit ici.</p>}
            {!following && step === lastStep && <p>Veux-tu m’accompagner un moment, ou préfères-tu voir mes marchandises ?</p>}
            <div className="trade-story-actions">
              {!following && step < lastStep && <button className="primary-button" aria-keyshortcuts="E" onClick={() => advanceTraderStory(traderId)}>Texte suivant (E)</button>}
              {!following && step === lastStep && <button className="primary-button" onClick={accompany}>L’accompagner</button>}
              {following && <button className="primary-button" onClick={stopAccompanying}>Reprendre la route seul</button>}
              <button className="secondary-button" onClick={() => useTradeStore.getState().setView('offers')}>Voir les marchandises</button>
              <button className="secondary-button" onClick={close}>Plus tard</button>
            </div>
          </div>
        ) : (
          <>
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
            <button className="secondary-button trade-talk-button" onClick={() => useTradeStore.getState().setView('story')}>Parler du voyage</button>
          </>
        )}
      </section>
    </div>
  );
}
