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
    useGameStore.getState().setNotice('Follow the trader to the city, about 1 km away. He waits if you fall behind.');
    close();
  };
  const stopAccompanying = () => {
    useTradeStore.getState().setFollowing(false);
    useGameStore.getState().setNotice('You are traveling alone again.');
    close();
  };
  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel trade-panel" aria-label="Conversation with trader">
        <div className="backpack-header"><h2>{view === 'village' ? 'Village resident' : view === 'restaurant' ? 'Village restaurant' : 'Traveling trader'}</h2><button className="secondary-button" onClick={close}>Close and resume</button></div>
        {view === 'village' ? (
          <div className="trade-story" role="status">
            <p>{story}</p>
            <div className="trade-story-actions">
              <button className="primary-button" aria-keyshortcuts="E" onClick={() => advanceTraderStory(traderId)}>Keep talking (E)</button>
              <button className="secondary-button" onClick={openRestaurant}>Restaurant invitation</button>
            </div>
          </div>
        ) : view === 'restaurant' ? (
          <div className="trade-story" role="status">
            <p>{story}</p>
            <p>On the menu: bread, corn, and cheese. The trader offers meals to travelers.</p>
            <div className="trade-story-actions">
              <button className="primary-button" onClick={() => acceptRestaurantInvitation(world)}>Go to restaurant</button>
              <button className="secondary-button" disabled={mealEaten} onClick={() => eatRestaurantMeal(world)}>Eat meal · +4 lives</button>
            </div>
            {message && <p className="trade-message">{message}</p>}
          </div>
        ) : view === 'story' ? (
          <div className="trade-story" role="status">
            <p><strong>{definition.title}</strong> · Story {step + 1} / {definition.steps.length}</p>
            <p>{following ? definition.companion : story}</p>
            {!following && step < lastStep && <p>Stay close to hear more, or advance the story here.</p>}
            {!following && step === lastStep && <p>Would you like to travel with me, or would you rather see my goods?</p>}
            <div className="trade-story-actions">
              {!following && step < lastStep && <button className="primary-button" aria-keyshortcuts="E" onClick={() => advanceTraderStory(traderId)}>Next text (E)</button>}
              {!following && step === lastStep && <button className="primary-button" onClick={accompany}>Travel with him</button>}
              {following && <button className="primary-button" onClick={stopAccompanying}>Travel alone again</button>}
              <button className="secondary-button" onClick={() => useTradeStore.getState().setView('offers')}>View goods</button>
              <button className="secondary-button" onClick={close}>Later</button>
            </div>
          </div>
        ) : (
          <>
            <p>{gameplayMode === 'survival' ? 'Choose an offer: items are really exchanged.' : 'Choose an offer: it is free in Creative mode.'}</p>
            <div className="trade-offers">
              {TRADE_OFFERS.map((offer) => (
                <article className="trade-offer" data-offer={offer.id} key={offer.id}>
                  <div className="trade-offer-items">
                    <span><ItemIcon kind={offer.cost} /> {offer.costCount} {selectionInfo(offer.cost).name}</span>
                    <span>→</span>
                    <span><ItemIcon kind={offer.reward} /> {offer.rewardCount} {selectionInfo(offer.reward).name}</span>
                  </div>
                  <button className="primary-button" disabled={!canTrade(offer)} onClick={() => tradeWithMerchant(offer)}>Trade</button>
                </article>
              ))}
            </div>
            {message && <p className="trade-message" role="status">{message}</p>}
            <span className="trade-inventory-note">Your backpack quantities are used. {Object.keys(itemCounts).length} item types.</span>
            <button className="secondary-button trade-talk-button" onClick={() => useTradeStore.getState().setView('story')}>Talk about the journey</button>
          </>
        )}
      </section>
    </div>
  );
}
