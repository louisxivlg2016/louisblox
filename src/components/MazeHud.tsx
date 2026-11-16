import { useEffect, useState } from 'react';
import { useMazeStore, requestMazeReset, requestMazeStart, toggleMazeOverview } from '../game/mazeClient';
import { useBattleStore } from '../game/battle';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { canManageProtection } from '../game/protection';
import { MatchResultActions } from './MatchResultActions';
import { releasePointerForOverlay } from '../game/input';
import { translate } from '../game/language';

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
      <div className="battle-scoreboard maze-scoreboard"><strong>{translate('COURSE LABYRINTHE', 'MAZE RACE')}</strong><span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div>
      {mode === 'play' && <div className="football-notice maze-notice" role="status"><strong>{notice}</strong><span>{phase === 'countdown' ? translate(`Ouverture dans ${Math.max(0, Math.ceil((phaseUntil - Date.now()) / 1000))}`, `Opening in ${Math.max(0, Math.ceil((phaseUntil - Date.now()) / 1000))}`, `Apertura en ${Math.max(0, Math.ceil((phaseUntil - Date.now()) / 1000))}`) : phase === 'running' ? translate('Trouve la ligne jaune au nord du labyrinthe.', 'Find the yellow line at the north of the maze.') : phase === 'finished' ? translate('Course terminée', 'Race finished') : translate('Attends le coup de sifflet de l’arbitre.', 'Wait for the referee’s whistle.')}</span></div>}
      {mode === 'play' && <div className="maze-referee-controls">
        {referee && (phase === 'waiting' || phase === 'ready') && <button onClick={requestMazeStart}>{phase === 'waiting' ? translate('Prêts ? · premier sifflet', 'Ready? · first whistle') : translate('Départ · deuxième sifflet', 'Start · second whistle')}</button>}
        {referee && <button onClick={toggleMazeOverview}>{overview ? translate('Rejoindre mon couloir', 'Return to my lane') : translate('Vue d’ensemble', 'Overview')}</button>}
        {referee && <button onClick={requestMazeReset}>{translate('Réinitialiser la course', 'Reset race')}</button>}
        {!referee && phase === 'waiting' && <span>{translate('En place dans ton couloir…', 'Get in your lane…')}</span>}
      </div>}
      {phase === 'finished' && <div className="pirate-winner">{winner === 'solo' || winner === localId ? translate('Tu as gagné la course !', 'You won the race!') : `${winnerName ?? translate('Un joueur', 'A player')} won!`}<span>{(finishMs / 1000).toFixed(1)} seconds</span><MatchResultActions /></div>}
    </>
  );
}
