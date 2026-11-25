import { useDeliveryStore } from '../game/deliveryClient';
import { useSkyfallStore } from '../game/skyfallClient';
import { HEIST_DELIVERY_POINTS } from '../game/heistCity';
import { useGameStore } from '../game/store';
import { translate } from '../game/language';

export function DeliveryHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const phase = useDeliveryStore((state) => state.phase);
  const startedAt = useDeliveryStore((state) => state.startedAt);
  const index = useDeliveryStore((state) => state.index);
  const coins = useDeliveryStore((state) => state.coins);
  const grappleReadyAt = useDeliveryStore((state) => state.grappleReadyAt);
  if (gameplayMode !== 'delivery') return null;
  const elapsed = phase === 'waiting' ? 0 : Math.max(0, Date.now() - startedAt);
  const remaining = Math.max(0, 120000 - elapsed);
  const point = HEIST_DELIVERY_POINTS[index];
  return <div className="delivery-hud"><strong>{translate('Livraison Express', 'Express Delivery')}</strong><span>{translate(`Colis ${index}/4 · ${coins} pièces`, `Parcels ${index}/4 · ${coins} coins`)}</span><small>{point ? translate(`Destination : ${point.name}`, `Destination: ${point.name}`) : translate('Tous les colis sont livrés !', 'All parcels delivered!')} · {Math.ceil(remaining / 1000)} s</small>{index >= 3 && grappleReadyAt > Date.now() && <small>{translate(`Grappin ${Math.ceil((grappleReadyAt - Date.now()) / 1000)} s`, `Grapple ${Math.ceil((grappleReadyAt - Date.now()) / 1000)} s`)}</small>}{phase === 'finished' && <h2>{translate('Livraison réussie !', 'Delivery complete!')}</h2>}{phase === 'lost' && <h2>{translate('Temps écoulé !', 'Time is up!')}</h2>}</div>;
}

export function SkyfallHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const phase = useSkyfallStore((state) => state.phase);
  const startedAt = useSkyfallStore((state) => state.startedAt);
  const bestMs = useSkyfallStore((state) => state.bestMs);
  const blocks = useSkyfallStore((state) => state.blocks);
  if (gameplayMode !== 'skyfall') return null;
  const survival = phase === 'waiting' ? 0 : Date.now() - startedAt;
  return <div className="skyfall-hud"><strong>{translate(`Survie ${Math.floor(survival / 1000)} s`, `Survival ${Math.floor(survival / 1000)} s`)}</strong><span>{translate(`${blocks.length} blocs dans le ciel`, `${blocks.length} blocks in the sky`)}</span>{phase === 'finished' && <h2>{translate(`Partie terminée · ${Math.floor(bestMs / 1000)} s`, `Game over · ${Math.floor(bestMs / 1000)} s`)}</h2>}</div>;
}
