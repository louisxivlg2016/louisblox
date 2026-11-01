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
  const soloScores = useBattleStore((state) => state.soloScores);
  const lobbyPlayers = useMultiplayerStore((state) => state.players);
  const events = useBattleStore((state) => state.events);
  const deadUntil = useBattleStore((state) => state.deadUntil);
  useEffect(() => {
    if (mode !== 'play' || gameplayMode !== 'battle' || !enabled || status !== 'online' || team || !ready) return;
    clearInput();
    if (document.pointerLockElement) document.exitPointerLock();
    useGameStore.getState().setMode('pause');
  }, [gameplayMode, enabled, status, team, mode, ready]);
  const selectTeam = (nextTeam: 'red' | 'blue' | 'solo') => {
    if (chooseBattleTeam(nextTeam)) void requestPlay();
  };
  if (gameplayMode !== 'battle' || !enabled) return null;
  const redCount = Object.values(teams).filter((value) => value === 'red').length;
  const blueCount = Object.values(teams).filter((value) => value === 'blue').length;
  const soloCount = Object.values(teams).filter((value) => value === 'solo').length;
  const names = new Map(lobbyPlayers.map((player) => [player.playerId, player.self ? 'Toi' : player.name]));
  const soloLeaders = Object.entries(soloScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  return (
    <>
      <div className="battle-scoreboard" aria-label="Score de la bataille">
        {(redCount > 0 || blueCount > 0 || soloCount === 0) && <span className="battle-red">Rouge · {scores.red}</span>}
        <strong>BATAILLE</strong>
        {(redCount > 0 || blueCount > 0 || soloCount === 0) && <span className="battle-blue">Bleu · {scores.blue}</span>}
        {soloLeaders.map(([playerId, kills]) => (
          <span key={playerId} className="battle-solo">{names.get(playerId) ?? 'Joueur'} · {kills}</span>
        ))}
      </div>
      {!team && (
        <div className="battle-team-picker">
          {ready ? (
            <>
              <strong>Choisis ton équipe</strong><span>2 contre 1 autorisé · Chacun pour soi : 1 joueur = 1 équipe</span>
              <div>
                <button className="battle-red" aria-pressed="false" onClick={() => selectTeam('red')}>Rouge · {redCount}</button>
                <button className="battle-blue" aria-pressed="false" onClick={() => selectTeam('blue')}>Bleu · {blueCount}</button>
              </div>
              <button className="battle-solo" aria-pressed="false" onClick={() => selectTeam('solo')}>Chacun pour soi · {soloCount}</button>
            </>
          ) : <strong role="status">Préparation de l’arène…</strong>}
        </div>
      )}
      <div className="battle-events" aria-live="polite">
        {events.map((event) => <p key={event.id}><strong>{event.killerName}</strong> a éliminé <strong>{event.victimName}</strong></p>)}
      </div>
      {deadUntil > 0 && <div className="battle-death">Éliminé !<span>{team === 'solo' ? 'Réapparition dans l’arène…' : 'Réapparition à ta base…'}</span></div>}
    </>
  );
}
