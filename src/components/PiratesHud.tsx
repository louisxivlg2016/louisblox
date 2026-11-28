import { useEffect, useState } from 'react';
import { chooseBattleTeam, useBattleStore } from '../game/battle';
import { buyPirateItem, choosePirateKit, isPirateEliminated, usePirateStore } from '../game/piratesClient';
import { PIRATE_SHOP } from '../game/pirates';
import { clearInput, releasePointerForOverlay, requestPlay } from '../game/input';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { MatchResultActions } from './MatchResultActions';
import { translate, useLanguageStore } from '../game/language';
import pirateShopButtonUrl from '../../assets/menu/pirate-shop-button.webp';
import defeatEnUrl from '../../assets/menu/english/defeat.jpeg';
import defaiteFrUrl from '../../assets/menu/defaite.jpeg';
import derrotaEsUrl from '../../assets/menu/spanish/derrota.jpeg';

export function PiratesHud() {
  const language = useLanguageStore((state) => state.language);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const mode = useGameStore((state) => state.mode);
  const worldTemplate = useGameStore((state) => state.worldTemplate);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const team = useBattleStore((state) => state.team);
  const ready = useBattleStore((state) => state.ready);
  const localPlayerId = useBattleStore((state) => state.localPlayerId);
  const coins = usePirateStore((state) => state.coins);
  const objectives = usePirateStore((state) => state.objectives);
  const health = useBattleStore((state) => state.health);
  const winner = usePirateStore((state) => state.winner);
  const [shopOpen, setShopOpen] = useState(false);
  useEffect(() => {
    if (gameplayMode !== 'pirates' || mode !== 'play' || !enabled || status !== 'online' || !ready || team) return;
    clearInput();
    if (document.pointerLockElement) document.exitPointerLock();
    useGameStore.getState().setMode('pause');
  }, [gameplayMode, enabled, status, team, mode, ready]);
  useEffect(() => {
    if (gameplayMode !== 'pirates' || mode !== 'play' || !winner) return;
    setShopOpen(false);
    releasePointerForOverlay();
  }, [gameplayMode, mode, winner]);
  useEffect(() => {
    if (gameplayMode !== 'pirates' || !shopOpen) return;
    releasePointerForOverlay();
    useGameStore.getState().setMode('pause');
  }, [gameplayMode, shopOpen]);
  useEffect(() => {
    if (gameplayMode !== 'pirates') return;
    const toggle = () => setShopOpen((current) => {
      if (current) void requestPlay();
      else {
        releasePointerForOverlay();
        useGameStore.getState().setMode('pause');
      }
      return !current;
    });
    window.addEventListener('louisblox:pirate-shop-toggle', toggle);
    return () => window.removeEventListener('louisblox:pirate-shop-toggle', toggle);
  }, [gameplayMode]);
  if (gameplayMode !== 'pirates' || !enabled) return null;
  const selectTeam = (next: 'red' | 'blue' | 'auto') => {
    if (!chooseBattleTeam(next)) return;
    choosePirateKit();
    void requestPlay();
  };
  const money = localPlayerId ? coins[localPlayerId] ?? 0 : 0;
  const lives = localPlayerId ? health[localPlayerId] ?? 10 : 10;
  const defeated = Boolean(worldTemplate === 'fortress' && winner && team && winner !== team);
  return (
    <>
      <div className="battle-scoreboard pirate-scoreboard" aria-label={translate('Objectifs des bateaux', 'Ship objectives')}>
        <span className="battle-red">{translate('Rouge', 'Red')} · {objectives.red}</span><strong>{translate('TRÉSORS', 'TREASURES')}</strong><span className="battle-blue">{translate('Bleu', 'Blue')} · {objectives.blue}</span><span className="pirate-coins">{translate('Or', 'Gold')} · {money}</span>{worldTemplate === 'fortress' && <span className="pirate-lives">{translate('Vies', 'Lives')} · {lives}/10</span>}
      </div>
      {!team && (
        <div className="battle-team-picker pirate-picker">
          {!ready ? <strong>{translate('Préparation des navires…', 'Preparing ships…')}</strong> : (
            <>
              <strong>{translate('Choisis ton équipage', 'Choose your crew')}</strong><span>{translate('Le mode automatique équilibre les deux bateaux.', 'Automatic mode balances the two ships.')}</span>
              <div><button className="battle-red" onClick={() => selectTeam('red')}>{translate('Rouge', 'Red')}</button><button className="battle-blue" onClick={() => selectTeam('blue')}>{translate('Bleu', 'Blue')}</button></div>
              <button className="battle-solo" onClick={() => selectTeam('auto')}>{translate('Équipe automatique', 'Automatic team')}</button>
            </>
          )}
        </div>
      )}
      {team && !winner && <button className="pirate-shop-toggle" aria-label={translate('Boutique pirate', 'Pirate shop')} onClick={() => { releasePointerForOverlay(); useGameStore.getState().setMode('pause'); setShopOpen(true); }}>{language === 'es' ? <span className="localized-button-text">TIENDA PIRATA</span> : <img src={pirateShopButtonUrl} alt="" />}</button>}
      {shopOpen && (
        <div className="pirate-shop-panel">
          <h2>{translate('Boutique pirate · {money} pièces', 'Pirate shop · {money} coins')}</h2>
          {PIRATE_SHOP().map((entry) => <button key={entry.item} disabled={money < entry.cost} onClick={() => buyPirateItem(entry.item)}>{entry.name} · {entry.cost} {translate('pièces', 'coins', 'monedas')}</button>)}
          <button className="primary-button" onClick={() => { setShopOpen(false); void requestPlay(); }}>{translate('Retour au navire', 'Return to ship')}</button>
        </div>
      )}
      {winner && (defeated ? <div className="pirate-defeat"><img src={translate(defaiteFrUrl, defeatEnUrl, derrotaEsUrl)} alt={translate('Défaite', 'Defeat', 'Derrota')} /><MatchResultActions /></div> : <div className="pirate-winner">{translate(`Victoire de l’équipage ${winner === 'red' ? 'rouge' : 'bleu'} !`, `The ${winner} crew wins!`, `¡La tripulación ${winner === 'red' ? 'roja' : 'azul'} gana!`)}<MatchResultActions /></div>)}
      {isPirateEliminated() && !winner && <div className="battle-death">{translate('Élimination définitive', 'Permanent elimination')}<span>{translate('Le trésor de ton équipage est détruit.', 'Your crew’s treasure has been destroyed.')}</span></div>}
    </>
  );
}
