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
  useEffect(() => {
    if (gameplayMode !== 'pirates') return;
    const toggle = () => setShopOpen((current) => {
      if (current) void requestPlay();
      else releasePointerForOverlay();
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
  return (
    <>
      <div className="battle-scoreboard pirate-scoreboard" aria-label="Ship objectives">
        <span className="battle-red">Red · {objectives.red}</span><strong>TREASURES</strong><span className="battle-blue">Blue · {objectives.blue}</span><span className="pirate-coins">Gold · {money}</span>
      </div>
      {!team && (
        <div className="battle-team-picker pirate-picker">
          {!ready ? <strong>Preparing ships…</strong> : (
            <>
              <strong>Choose your crew</strong><span>Automatic mode balances the two ships.</span>
              <div><button className="battle-red" onClick={() => selectTeam('red')}>Red</button><button className="battle-blue" onClick={() => selectTeam('blue')}>Blue</button></div>
              <button className="battle-solo" onClick={() => selectTeam('auto')}>Automatic team</button>
            </>
          )}
        </div>
      )}
      {team && !winner && <button className="pirate-shop-toggle" aria-label="Pirate shop" onClick={() => { releasePointerForOverlay(); setShopOpen(true); }}><img src={pirateShopButtonUrl} alt="" /></button>}
      {shopOpen && (
        <div className="pirate-shop-panel">
          <h2>Pirate shop · {money} coins</h2>
          {PIRATE_SHOP.map((entry) => <button key={entry.item} disabled={money < entry.cost} onClick={() => buyPirateItem(entry.item)}>{entry.name} · {entry.cost} coins</button>)}
          <button className="primary-button" onClick={() => { setShopOpen(false); void requestPlay(); }}>Return to ship</button>
        </div>
      )}
      {winner && <div className="pirate-winner">The {winner === 'red' ? 'red' : 'blue'} crew wins!<MatchResultActions /></div>}
      {isPirateEliminated() && !winner && <div className="battle-death">Permanent elimination<span>Your crew’s treasure has been destroyed.</span></div>}
    </>
  );
}
