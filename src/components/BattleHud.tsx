import { useEffect } from 'react';
import { chooseBattleTeam, useBattleStore } from '../game/battle';
import { clearInput, requestPlay } from '../game/input';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';

export function BattleHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const mode = useGameStore((state) => state.mode);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const team = useBattleStore((state) => state.team);
  const ready = useBattleStore((state) => state.ready);
  const teams = useBattleStore((state) => state.teams);
  const scores = useBattleStore((state) => state.scores);
  const events = useBattleStore((state) => state.events);
  const deadUntil = useBattleStore((state) => state.deadUntil);
  useEffect(() => {
    if (mode !== 'play' || gameplayMode !== 'battle' || !enabled || status !== 'online' || team || !ready) return;
    clearInput();
    if (document.pointerLockElement) document.exitPointerLock();
    useGameStore.getState().setMode('pause');
  }, [gameplayMode, enabled, status, team, mode, ready]);
  const selectTeam = (nextTeam: 'red' | 'blue') => {
    if (chooseBattleTeam(nextTeam)) void requestPlay();
  };
  if (gameplayMode !== 'battle' || !enabled) return null;
  const redCount = Object.values(teams).filter((value) => value === 'red').length;
  const blueCount = Object.values(teams).filter((value) => value === 'blue').length;
  return (
    <>
      <div className="battle-scoreboard" aria-label="Score de la bataille">
        <span className="battle-red">Rouge · {scores.red}</span>
        <strong>BATAILLE</strong>
        <span className="battle-blue">Bleu · {scores.blue}</span>
      </div>
      {!team && (
        <div className="battle-team-picker">
          {ready ? (
            <>
              <strong>Choisis ton équipe</strong><span>2 contre 1 autorisé</span>
              <div>
                <button className="battle-red" aria-pressed="false" onClick={() => selectTeam('red')}>Rouge · {redCount}</button>
                <button className="battle-blue" aria-pressed="false" onClick={() => selectTeam('blue')}>Bleu · {blueCount}</button>
              </div>
            </>
          ) : <strong role="status">Préparation de l’arène…</strong>}
        </div>
      )}
      <div className="battle-events" aria-live="polite">
        {events.map((event) => <p key={event.id}><strong>{event.killerName}</strong> a éliminé <strong>{event.victimName}</strong></p>)}
      </div>
      {deadUntil > 0 && <div className="battle-death">Éliminé !<span>Réapparition à ta base…</span></div>}
    </>
  );
}
