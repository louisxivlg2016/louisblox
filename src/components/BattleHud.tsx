import { useEffect } from 'react';
import { chooseBattleTeam, useBattleStore } from '../game/battle';
import { battleTeamColor, isIndividualBattleTeam } from '../game/battleArena';
import { clearInput, requestPlay } from '../game/input';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { MatchResultActions } from './MatchResultActions';

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
  const winner = useBattleStore((state) => state.winner);
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
  const soloCount = Object.values(teams).filter(isIndividualBattleTeam).length;
  const freeForAll = soloCount > 0 || isIndividualBattleTeam(team);
  const showTeams = !freeForAll || redCount > 0 || blueCount > 0;
  const ranking = Object.entries(teams)
    .map(([playerId, playerTeam]) => ({
      playerId,
      team: playerTeam,
      kills: playerScores[playerId] ?? 0,
      name: playerId === localPlayerId ? 'You' : playerNames[playerId] ?? 'Player',
    }))
    .sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name));
  return (
    <>
      <div className={`battle-scoreboard${freeForAll ? ' free-for-all' : ''}`} aria-label="Combat score">
        {showTeams && <span className="battle-red">Red · {scores.red}</span>}
        <strong>COMBAT</strong>
        {showTeams && <span className="battle-blue">Blue · {scores.blue}</span>}
        {freeForAll && (
          <ol className="battle-ranking" aria-label="Each player’s score">
            {ranking.map((player) => (
              <li
                key={player.playerId}
                className={`${player.team === 'red' ? 'battle-red' : player.team === 'blue' ? 'battle-blue' : 'battle-solo'}${player.playerId === localPlayerId ? ' self' : ''}`}
                style={{ color: battleTeamColor(player.team) }}
              >
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
              <strong>Choose your team</strong><span>Red/Blue teams · 1 player = 1 team, as many teams as players</span>
              <div>
                <button className="battle-red" aria-pressed="false" onClick={() => selectTeam('red')}>Red · {redCount}</button>
                <button className="battle-blue" aria-pressed="false" onClick={() => selectTeam('blue')}>Blue · {blueCount}</button>
              </div>
              <button className="battle-solo" aria-pressed="false" onClick={() => selectTeam('solo')}>My own team · {soloCount}</button>
            </>
          ) : <strong role="status">Preparing arena…</strong>}
        </div>
      )}
      <div className="battle-events" aria-live="polite">
        {events.map((event) => <p key={event.id}><strong>{event.killerName}</strong> eliminated <strong>{event.victimName}</strong></p>)}
      </div>
      {deadUntil > 0 && <div className="battle-death">Eliminated!<span>{isIndividualBattleTeam(team) ? 'Respawning in arena…' : 'Respawning at your base…'}</span></div>}
      {winner && <div className="pirate-winner">{isIndividualBattleTeam(winner) ? `${playerNames[winner.slice(5)] ?? 'a player'} wins!` : `The ${winner === 'red' ? 'red' : 'blue'} team wins!`}<MatchResultActions /></div>}
    </>
  );
}
