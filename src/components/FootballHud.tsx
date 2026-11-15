import { useEffect, useState } from 'react';
import { chooseBattleTeam, useBattleStore } from '../game/battle';
import { isFootballFrozen, useFootballStore } from '../game/footballClient';
import { clearInput, requestPlay } from '../game/input';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { MatchResultActions } from './MatchResultActions';

export function FootballHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const mode = useGameStore((state) => state.mode);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const team = useBattleStore((state) => state.team);
  const ready = useBattleStore((state) => state.ready);
  const phase = useFootballStore((state) => state.phase);
  const phaseUntil = useFootballStore((state) => state.phaseUntil);
  const endsAt = useFootballStore((state) => state.endsAt);
  const score = useFootballStore((state) => state.score);
  const notice = useFootballStore((state) => state.notice);
  const winner = useFootballStore((state) => state.winner);
  const overtime = useFootballStore((state) => state.overtime);
  const penaltyTeam = useFootballStore((state) => state.penaltyTeam);
  const [, refresh] = useState(0);
  useEffect(() => {
    if (gameplayMode !== 'football' || mode !== 'play' || !enabled || status !== 'online' || !ready || team) return;
    clearInput();
    if (document.pointerLockElement) document.exitPointerLock();
    useGameStore.getState().setMode('pause');
  }, [gameplayMode, enabled, status, team, mode, ready]);
  useEffect(() => {
    if (gameplayMode !== 'football') return;
    const timer = window.setInterval(() => refresh((value) => value + 1), 250);
    return () => window.clearInterval(timer);
  }, [gameplayMode]);
  if (gameplayMode !== 'football' || !enabled) return null;
  const selectTeam = (next: 'red' | 'blue' | 'auto') => {
    if (chooseBattleTeam(next)) void requestPlay();
  };
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  return (
    <>
      <div className="battle-scoreboard football-scoreboard" aria-label="Football match score">
        <span className="battle-red">Red · {score.red}</span>
        <strong>{winner ? 'FULL TIME' : overtime ? 'GOLDEN GOAL' : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}</strong>
        <span className="battle-blue">Blue · {score.blue}</span>
      </div>
      {!team && <div className="battle-team-picker football-picker">
        {!ready ? <strong>Preparing stadium…</strong> : <>
          <strong>Choose your football team</strong><span>5 minutes · red versus blue</span>
          <div><button className="battle-red" onClick={() => selectTeam('red')}>Red</button><button className="battle-blue" onClick={() => selectTeam('blue')}>Blue</button></div>
          <button className="battle-solo" onClick={() => selectTeam('auto')}>Automatic team</button>
        </>}
      </div>}
      {team && mode === 'play' && <div className="football-notice" role="status">
        <strong>{notice}</strong>
        {phase === 'countdown' && <span>Kickoff in {Math.max(0, Math.ceil((phaseUntil - Date.now()) / 1000))}</span>}
        {phase === 'penalty' && <span>Penalty for {penaltyTeam === 'red' ? 'red' : 'blue'} · shooter and goalkeeper get ready</span>}
        {isFootballFrozen() && phase !== 'finished' && <span>Wait for the whistle</span>}
        <small>Left click: shoot · E: power shot · T or right click: tackle · G: pass</small>
      </div>}
      {winner && <div className="pirate-winner">The {winner === 'red' ? 'red' : 'blue'} team wins!<MatchResultActions /></div>}
    </>
  );
}
