import { useEffect, useState } from 'react';
import { useMazeStore, requestMazeReset, requestMazeStart, toggleMazeOverview } from '../game/mazeClient';
import { useBattleStore } from '../game/battle';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { canManageProtection } from '../game/protection';
import { MatchResultActions } from './MatchResultActions';
import { releasePointerForOverlay } from '../game/input';

export function MazeHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const mode = useGameStore((state) => state.mode);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const phase = useMazeStore((state) => state.phase);
  const phaseUntil = useMazeStore((state) => state.phaseUntil);
  const startedAt = useMazeStore((state) => state.startedAt);
  const finishMs = useMazeStore((state) => state.finishMs);
  const winnerName = useMazeStore((state) => state.winnerName);
  const winner = useMazeStore((state) => state.winner);
  const notice = useMazeStore((state) => state.notice);
  const overview = useMazeStore((state) => state.overview);
  const localId = useBattleStore((state) => state.localPlayerId);
  const [, refresh] = useState(0);
  useEffect(() => {
    if (gameplayMode !== 'maze') return;
    const timer = window.setInterval(() => refresh((value) => value + 1), 250);
    return () => window.clearInterval(timer);
  }, [gameplayMode]);
  useEffect(() => {
    if (gameplayMode === 'maze') releasePointerForOverlay();
  }, [gameplayMode, phase]);
  if (gameplayMode !== 'maze' || mode === 'menu') return null;
  const referee = canManageProtection() || !enabled;
  const elapsed = phase === 'finished' ? finishMs : startedAt ? Date.now() - startedAt : 0;
  const seconds = Math.max(0, Math.floor(elapsed / 1000));
  return (
    <>
      <div className="battle-scoreboard maze-scoreboard"><strong>MAZE RACE</strong><span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div>
      {mode === 'play' && <div className="football-notice maze-notice" role="status"><strong>{notice}</strong><span>{phase === 'countdown' ? `Opening in ${Math.max(0, Math.ceil((phaseUntil - Date.now()) / 1000))}` : phase === 'running' ? 'Find the yellow line at the north of the maze.' : phase === 'finished' ? 'Race finished' : 'Wait for the referee’s whistle.'}</span></div>}
      {mode === 'play' && <div className="maze-referee-controls">
        {referee && (phase === 'waiting' || phase === 'ready') && <button onClick={requestMazeStart}>{phase === 'waiting' ? 'Ready? · first whistle' : 'Start · second whistle'}</button>}
        {referee && <button onClick={toggleMazeOverview}>{overview ? 'Return to my lane' : 'Overview'}</button>}
        {referee && <button onClick={requestMazeReset}>Reset race</button>}
        {!referee && phase === 'waiting' && <span>Get in your lane…</span>}
      </div>}
      {phase === 'finished' && <div className="pirate-winner">{winner === 'solo' || winner === localId ? 'You won the race!' : `${winnerName ?? 'A player'} won!`}<span>{(finishMs / 1000).toFixed(1)} seconds</span><MatchResultActions /></div>}
    </>
  );
}
