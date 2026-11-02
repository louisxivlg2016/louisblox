import { useEffect, useState } from 'react';
import { chooseBattleTeam, useBattleStore } from '../game/battle';
import { buyPirateItem, choosePirateKit, isPirateEliminated, usePirateStore } from '../game/piratesClient';
import { PIRATE_KITS, PIRATE_SHOP } from '../game/pirates';
import type { PirateKit } from '../game/pirates';
import { clearInput, requestPlay } from '../game/input';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';

export function PiratesHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const mode = useGameStore((state) => state.mode);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const team = useBattleStore((state) => state.team);
  const ready = useBattleStore((state) => state.ready);
  const localPlayerId = useBattleStore((state) => state.localPlayerId);
  const kit = usePirateStore((state) => state.kit);
  const coins = usePirateStore((state) => state.coins);
  const objectives = usePirateStore((state) => state.objectives);
  const winner = usePirateStore((state) => state.winner);
  const [shopOpen, setShopOpen] = useState(false);
  useEffect(() => {
    if (gameplayMode !== 'pirates' || mode !== 'play' || !enabled || status !== 'online' || !ready || (team && kit)) return;
    clearInput();
    if (document.pointerLockElement) document.exitPointerLock();
    useGameStore.getState().setMode('pause');
  }, [gameplayMode, enabled, status, team, kit, mode, ready]);
  if (gameplayMode !== 'pirates' || !enabled) return null;
  const selectTeam = (next: 'red' | 'blue' | 'auto') => {
    if (chooseBattleTeam(next)) void requestPlay();
  };
  const selectKit = (next: PirateKit) => {
    if (choosePirateKit(next)) void requestPlay();
  };
  const money = localPlayerId ? coins[localPlayerId] ?? 0 : 0;
  return (
    <>
      <div className="battle-scoreboard pirate-scoreboard" aria-label="Objectifs des bateaux">
        <span className="battle-red">Rouge · {objectives.red}</span><strong>TRÉSORS</strong><span className="battle-blue">Bleu · {objectives.blue}</span><span className="pirate-coins">Or · {money}</span>
      </div>
      {(!team || !kit) && (
        <div className="battle-team-picker pirate-picker">
          {!ready ? <strong>Préparation des navires…</strong> : !team ? (
            <>
              <strong>Choisis ton équipage</strong><span>Le mode automatique équilibre les deux bateaux.</span>
              <div><button className="battle-red" onClick={() => selectTeam('red')}>Rouge</button><button className="battle-blue" onClick={() => selectTeam('blue')}>Bleu</button></div>
              <button className="battle-solo" onClick={() => selectTeam('auto')}>Équipe automatique</button>
            </>
          ) : (
            <>
              <strong>Choisis ton rôle</strong><span>Chaque rôle a un équipement différent.</span>
              <div className="pirate-kit-list">{(Object.keys(PIRATE_KITS) as PirateKit[]).map((value) => <button key={value} onClick={() => selectKit(value)}><strong>{PIRATE_KITS[value].name}</strong><small>{PIRATE_KITS[value].description}</small></button>)}</div>
            </>
          )}
        </div>
      )}
      {team && kit && !winner && <button className="pirate-shop-toggle" onClick={() => { clearInput(); if (document.pointerLockElement) document.exitPointerLock(); setShopOpen(true); useGameStore.getState().setMode('pause'); }}>Boutique pirate</button>}
      {shopOpen && (
        <div className="pirate-shop-panel">
          <h2>Boutique pirate · {money} pièces</h2>
          {PIRATE_SHOP.map((entry) => <button key={entry.item} disabled={money < entry.cost} onClick={() => buyPirateItem(entry.item)}>{entry.name} · {entry.cost} pièces</button>)}
          <button className="primary-button" onClick={() => { setShopOpen(false); void requestPlay(); }}>Retour au navire</button>
        </div>
      )}
      {winner && <div className="pirate-winner">Victoire de l’équipage {winner === 'red' ? 'rouge' : 'bleu'} !</div>}
      {isPirateEliminated() && !winner && <div className="battle-death">Élimination définitive<span>Le trésor de ton équipage est détruit.</span></div>}
    </>
  );
}
