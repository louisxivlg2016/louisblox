import { useEffect } from 'react';
import { acceptRestaurantInvitation, advanceTraderStory, arriveAtVillageWithTrader, canTrade, eatRestaurantMeal, merchantStories, openRestaurant, tradeWithMerchant, TRADE_OFFERS, useTradeStore, viewTraderOffers } from '../game/trading';
import { world } from '../game/world';
import { requestPlay } from '../game/input';
import { selectionInfo } from '../game/items';
import { useGameStore } from '../game/store';
import { mountTraderCamel } from '../game/traderCamel';
import { ItemIcon } from './ItemIcon';
import { translate } from '../game/language';
import { getWorldSeed } from '../game/chunks';
import { nearestVillageAt, tradeCityAt } from '../game/villages';
import { useNavigationStore } from '../game/navigation';
import { TraderPosition } from '../game/traits';

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
  const definition = merchantStories()[storyId] ?? merchantStories()[0];
  const lastStep = definition.steps.length - 1;
  const close = () => {
    useTradeStore.getState().setOpen(false);
    void requestPlay();
  };
  const accompany = () => {
    const position = traderId?.get(TraderPosition);
    const destination = (position ? nearestVillageAt(position.x, position.z, getWorldSeed(world)) : null) ?? tradeCityAt(getWorldSeed(world));
    useNavigationStore.getState().setCaravanDestination(destination.x, destination.z);
    useTradeStore.getState().setFollowing(true);
    useGameStore.getState().setNotice(translate('Suis le marchand jusqu’à la ville, à environ 1 km. Il t’attend si tu t’éloignes.', 'Follow the trader to the city, about 1 km away. He waits if you fall behind.'));
    close();
  };
  const stopAccompanying = () => {
    useNavigationStore.getState().clearCaravanDestination();
    useTradeStore.getState().setFollowing(false);
    useGameStore.getState().setNotice(translate('Tu reprends la route seul.', 'You are traveling alone again.'));
    close();
  };
  return (
    <div className="backpack-backdrop trade-backdrop">
      <section className="book-panel backpack-panel trade-panel" aria-label={translate('Discussion avec le marchand', 'Conversation with trader')}>
        <div className="backpack-header"><h2>{view === 'village' ? translate('Habitant du village', 'Village resident') : view === 'restaurant' ? translate('Restaurant du village', 'Village restaurant') : translate('Marchand ambulant', 'Traveling trader')}</h2><button className="secondary-button" onClick={close}>{translate('Fermer et reprendre', 'Close and resume')}</button></div>
        {view === 'village' ? (
          <div className="trade-story" role="status">
            <p>{story}</p>
            <div className="trade-story-actions">
              <button className="primary-button" aria-keyshortcuts="E" onClick={() => advanceTraderStory(traderId)}>{translate('Parler encore (E)', 'Keep talking (E)')}</button>
              <button className="secondary-button" onClick={openRestaurant}>{translate('L’invitation au restaurant', 'Restaurant invitation')}</button>
            </div>
          </div>
        ) : view === 'restaurant' ? (
          <div className="trade-story" role="status">
            <p>{story}</p>
            <p>{translate('Au menu : pain, maïs et fromage. Le marchand offre le repas aux voyageurs.', 'On the menu: bread, corn, and cheese. The trader offers meals to travelers.')}</p>
            <div className="trade-story-actions">
              <button className="primary-button" onClick={() => acceptRestaurantInvitation(world)}>{translate('Aller au restaurant', 'Go to restaurant')}</button>
              <button className="secondary-button" disabled={mealEaten} onClick={() => eatRestaurantMeal(world)}>{translate('Manger le repas · +4 vie', 'Eat meal · +4 lives')}</button>
            </div>
            {message && <p className="trade-message">{message}</p>}
          </div>
        ) : view === 'story' ? (
          <div className="trade-story" role="status">
            <p><strong>{definition.title}</strong> · Story {step + 1} / {definition.steps.length}</p>
            <p>{following ? definition.companion : story}</p>
            {!following && step < lastStep && <p>{translate('Reste près de moi pour écouter la suite, ou avance le récit ici.', 'Stay close to hear more, or advance the story here.')}</p>}
            {!following && step === lastStep && <p>{translate('Veux-tu monter sur un chameau ?', 'Would you like to ride a camel?')}</p>}
            <div className="trade-story-actions">
              {!following && step < lastStep && <button className="primary-button" aria-keyshortcuts="E" onClick={() => advanceTraderStory(traderId)}>{translate('Texte suivant (E)', 'Next text (E)')}</button>}
              {!following && step === lastStep && <button className="primary-button" data-mount-trader-camel onClick={() => mountTraderCamel(world)}>{translate('Oui, monter sur un chameau', 'Yes, ride a camel')}</button>}
              {!following && step === lastStep && <button className="secondary-button" onClick={accompany}>{translate('L’accompagner', 'Travel with him')}</button>}
              {following && <button className="primary-button" onClick={stopAccompanying}>{translate('Reprendre la route seul', 'Travel alone again')}</button>}
              <button className="secondary-button" data-skip-trader-journey onClick={() => arriveAtVillageWithTrader(world)}>{translate('Arriver immédiatement au village', 'Arrive at the village immediately')}</button>
              <button className="secondary-button" onClick={() => viewTraderOffers(world)}>{translate('Voir les marchandises', 'View goods')}</button>
              <button className="secondary-button" onClick={close}>{translate('Plus tard', 'Later')}</button>
            </div>
          </div>
        ) : (
          <>
            <p>{gameplayMode === 'survival' ? translate('Choisis une offre : les objets sont échangés réellement.', 'Choose an offer: items are really exchanged.') : translate('Choisis une offre : elle est gratuite en mode créatif.', 'Choose an offer: it is free in Creative mode.')}</p>
            <div className="trade-offers">
              {TRADE_OFFERS.map((offer) => (
                <article className="trade-offer" data-offer={offer.id} key={offer.id}>
                  <div className="trade-offer-items">
                    <span><ItemIcon kind={offer.cost} /> {offer.costCount} {selectionInfo(offer.cost).name}</span>
                    <span>→</span>
                    <span><ItemIcon kind={offer.reward} /> {offer.rewardCount} {selectionInfo(offer.reward).name}</span>
                  </div>
                  <button className="primary-button" disabled={!canTrade(offer)} onClick={() => tradeWithMerchant(offer)}>{translate('Échanger', 'Trade')}</button>
                </article>
              ))}
            </div>
            {message && <p className="trade-message" role="status">{message}</p>}
            <span className="trade-inventory-note">{translate('Les quantités de ton sac sont utilisées.', 'Your backpack quantities are used.')} {Object.keys(itemCounts).length} {translate('types d’objets.', 'item types.')}</span>
            <button className="secondary-button trade-talk-button" onClick={() => useTradeStore.getState().setView('story')}>{translate('Parler du voyage', 'Talk about the journey')}</button>
          </>
        )}
      </section>
    </div>
  );
}
