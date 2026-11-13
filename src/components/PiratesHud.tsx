import { useEffect, useState } from 'react';
import { chooseBattleTeam, useBattleStore } from '../game/battle';
import { buyPirateItem, choosePirateKit, isPirateEliminated, usePirateStore } from '../game/piratesClient';
import { PIRATE_SHOP } from '../game/pirates';
import { clearInput, releasePointerForOverlay, requestPlay } from '../game/input';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { MatchResultActions } from './MatchResultActions';
import pirateShopButtonUrl from '../../assets/menu/pirate-shop-button.webp';

export function PiratesHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const mode = useGameStore((state) => state.mode);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const team = useBattleStore((state) => state.team);
  const ready = useBattleStore((state) => state.ready);
  const localPlayerId = useBattleStore((state) => state.localPlayerId);
  const coins = usePirateStore((state) => state.coins);
  const objectives = usePirateStore((state) => state.objectives);
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
  if (gameplayMode !== 'pirates' || !enabled) return null;
  const selectTeam = (next: 'red' | 'blue' | 'auto') => {
    if (!chooseBattleTeam(next)) return;
    choosePirateKit();
    void requestPlay();
  };
  const money = localPlayerId ? coins[localPlayerId] ?? 0 : 0;
  return (
    <>
      <div className="battle-scoreboard pirate-scoreboard" aria-label="Objectifs des bateaux">
        <span className="battle-red">Rouge · {objectives.red}</span><strong>TRÉSORS</strong><span className="battle-blue">Bleu · {objectives.blue}</span><span className="pirate-coins">Or · {money}</span>
      </div>
      {!team && (
        <div className="battle-team-picker pirate-picker">
          {!ready ? <strong>Préparation des navires…</strong> : (
            <>
              <strong>Choisis ton équipage</strong><span>Le mode automatique équilibre les deux bateaux.</span>
              <div><button className="battle-red" onClick={() => selectTeam('red')}>Rouge</button><button className="battle-blue" onClick={() => selectTeam('blue')}>Bleu</button></div>
              <button className="battle-solo" onClick={() => selectTeam('auto')}>Équipe automatique</button>
            </>
          )}
        </div>
      )}
      {team && !winner && <button className="pirate-shop-toggle" aria-label="Boutique pirate" onClick={() => { releasePointerForOverlay(); setShopOpen(true); }}><img src={pirateShopButtonUrl} alt="" /></button>}
      {shopOpen && (
        <div className="pirate-shop-panel">
          <h2>Boutique pirate · {money} pièces</h2>
          {PIRATE_SHOP.map((entry) => <button key={entry.item} disabled={money < entry.cost} onClick={() => buyPirateItem(entry.item)}>{entry.name} · {entry.cost} pièces</button>)}
          <button className="primary-button" onClick={() => { setShopOpen(false); void requestPlay(); }}>Retour au navire</button>
        </div>
      )}
      {winner && <div className="pirate-winner">Victoire de l’équipage {winner === 'red' ? 'rouge' : 'bleu'} !<MatchResultActions /></div>}
      {isPirateEliminated() && !winner && <div className="battle-death">Élimination définitive<span>Le trésor de ton équipage est détruit.</span></div>}
    </>
  );
}
