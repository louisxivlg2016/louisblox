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
  const playerScores = useBattleStore((state) => state.playerScores);
  const playerNames = useBattleStore((state) => state.names);
  const localPlayerId = useBattleStore((state) => state.localPlayerId);
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
  const freeForAll = soloCount > 0 || team === 'solo';
  const showTeams = !freeForAll || redCount > 0 || blueCount > 0;
  const ranking = Object.entries(teams)
    .map(([playerId, playerTeam]) => ({
      playerId,
      team: playerTeam,
      kills: playerScores[playerId] ?? 0,
      name: playerId === localPlayerId ? 'Toi' : playerNames[playerId] ?? 'Joueur',
    }))
    .sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name));
  return (
    <>
      <div className={`battle-scoreboard${freeForAll ? ' free-for-all' : ''}`} aria-label="Score de la bataille">
        {showTeams && <span className="battle-red">Rouge · {scores.red}</span>}
        <strong>BATAILLE</strong>
        {showTeams && <span className="battle-blue">Bleu · {scores.blue}</span>}
        {freeForAll && (
          <ol className="battle-ranking" aria-label="Score de chaque joueur">
            {ranking.map((player) => (
              <li key={player.playerId} className={`battle-${player.team}${player.playerId === localPlayerId ? ' self' : ''}`}>
                {player.name} · {player.kills}
              </li>
            ))}
          </ol>
        )}
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
