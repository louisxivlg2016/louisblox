import { chooseBattleTeam, useBattleStore } from '../game/battle';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';

const TEAM_NAMES = { red: 'Rouge', blue: 'Bleu' } as const;

export function BattleHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const team = useBattleStore((state) => state.team);
  const teams = useBattleStore((state) => state.teams);
  const scores = useBattleStore((state) => state.scores);
  const events = useBattleStore((state) => state.events);
  const deadUntil = useBattleStore((state) => state.deadUntil);
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
      <div className={`battle-team-picker ${team ? 'compact' : ''}`}>
        {!team && <><strong>Choisis ton équipe</strong><span>2 contre 1 autorisé</span></>}
        <div>
          <button className="battle-red" aria-pressed={team === 'red'} onClick={() => chooseBattleTeam('red')}>Rouge · {redCount}</button>
          <button className="battle-blue" aria-pressed={team === 'blue'} onClick={() => chooseBattleTeam('blue')}>Bleu · {blueCount}</button>
        </div>
        {team && <span>Équipe {TEAM_NAMES[team]} · clique pour changer</span>}
      </div>
      <div className="battle-events" aria-live="polite">
        {events.map((event) => <p key={event.id}><strong>{event.killerName}</strong> a éliminé <strong>{event.victimName}</strong></p>)}
      </div>
      {deadUntil > 0 && <div className="battle-death">Éliminé !<span>Réapparition à ta base…</span></div>}
    </>
  );
}
