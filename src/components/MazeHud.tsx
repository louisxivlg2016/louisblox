import { useEffect, useState } from 'react';
import { useMazeStore, requestMazeReset, requestMazeStart, toggleMazeOverview } from '../game/mazeClient';
import { useBattleStore } from '../game/battle';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { canManageProtection } from '../game/protection';
import { MatchResultActions } from './MatchResultActions';

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
  if (gameplayMode !== 'maze') return null;
  const referee = canManageProtection() || !enabled;
  const elapsed = phase === 'finished' ? finishMs : startedAt ? Date.now() - startedAt : 0;
  const seconds = Math.max(0, Math.floor(elapsed / 1000));
  return (
    <>
      <div className="battle-scoreboard maze-scoreboard"><strong>COURSE LABYRINTHE</strong><span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div>
      {mode === 'play' && <div className="football-notice maze-notice" role="status"><strong>{notice}</strong><span>{phase === 'countdown' ? `Ouverture dans ${Math.max(0, Math.ceil((phaseUntil - Date.now()) / 1000))}` : phase === 'running' ? 'Trouve la ligne jaune au nord du labyrinthe.' : phase === 'finished' ? 'Course terminée' : 'Attends le coup de sifflet de l’arbitre.'}</span></div>}
      {mode !== 'menu' && <div className="maze-referee-controls">
        {referee && (phase === 'waiting' || phase === 'ready') && <button onClick={requestMazeStart}>{phase === 'waiting' ? 'Prêts ? · premier sifflet' : 'Départ · deuxième sifflet'}</button>}
        {referee && <button onClick={toggleMazeOverview}>{overview ? 'Rejoindre mon couloir' : 'Vue d’ensemble'}</button>}
        {referee && <button onClick={requestMazeReset}>Réinitialiser la course</button>}
        {!referee && phase === 'waiting' && <span>En place dans ton couloir…</span>}
      </div>}
      {phase === 'finished' && <div className="pirate-winner">{winner === 'solo' || winner === localId ? 'Tu as gagné la course !' : `${winnerName ?? 'Un joueur'} a gagné !`}<span>{(finishMs / 1000).toFixed(1)} secondes</span><MatchResultActions /></div>}
    </>
  );
}
