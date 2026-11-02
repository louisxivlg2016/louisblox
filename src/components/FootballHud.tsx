import { useEffect, useState } from 'react';
import { chooseBattleTeam, useBattleStore } from '../game/battle';
import { isFootballFrozen, refereeWhistle, useFootballStore } from '../game/footballClient';
import { clearInput, requestPlay } from '../game/input';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { canManageProtection } from '../game/protection';

export function FootballHud() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const mode = useGameStore((state) => state.mode);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const team = useBattleStore((state) => state.team);
  const ready = useBattleStore((state) => state.ready);
  const localId = useBattleStore((state) => state.localPlayerId);
  const phase = useFootballStore((state) => state.phase);
  const phaseUntil = useFootballStore((state) => state.phaseUntil);
  const endsAt = useFootballStore((state) => state.endsAt);
  const score = useFootballStore((state) => state.score);
  const notice = useFootballStore((state) => state.notice);
  const winner = useFootballStore((state) => state.winner);
  const overtime = useFootballStore((state) => state.overtime);
  const cards = useFootballStore((state) => state.cards);
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
  const card = localId ? cards[localId] : undefined;
  return (
    <>
      <div className="battle-scoreboard football-scoreboard" aria-label="Score du match de football">
        <span className="battle-red">Rouge · {score.red}</span>
        <strong>{winner ? 'MATCH TERMINÉ' : overtime ? 'BUT EN OR' : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}</strong>
        <span className="battle-blue">Bleu · {score.blue}</span>
      </div>
      {!team && <div className="battle-team-picker football-picker">
        {!ready ? <strong>Préparation du stade…</strong> : <>
          <strong>Choisis ton équipe de football</strong><span>5 minutes · rouge contre bleu</span>
          <div><button className="battle-red" onClick={() => selectTeam('red')}>Rouge</button><button className="battle-blue" onClick={() => selectTeam('blue')}>Bleu</button></div>
          <button className="battle-solo" onClick={() => selectTeam('auto')}>Équipe automatique</button>
        </>}
      </div>}
      {team && mode === 'play' && <div className="football-notice" role="status">
        <strong>{notice}</strong>
        {phase === 'countdown' && <span>Départ dans {Math.max(0, Math.ceil((phaseUntil - Date.now()) / 1000))}</span>}
        {phase === 'penalty' && <span>Penalty {penaltyTeam === 'red' ? 'rouge' : 'bleu'} · le tireur et le gardien se placent</span>}
        {isFootballFrozen() && phase !== 'finished' && <span>Attends le coup de sifflet</span>}
        <small>Clic gauche : tir / tacle · sprint + saut + clic : tir puissant · clic droit ou E : tacler</small>
      </div>}
      {card && card.yellow > 0 && <div className={`football-card-notice ${card.redUntil > Date.now() ? 'red' : 'yellow'}`} role="status">{card.redUntil > Date.now() ? `Carton rouge · exclusion ${Math.ceil((card.redUntil - Date.now()) / 1000)} s` : `Carton jaune · ${card.yellow}`}</div>}
      {winner && <div className="pirate-winner">Victoire de l’équipe {winner === 'red' ? 'rouge' : 'bleue'} !</div>}
      {team && canManageProtection() && <button className="football-referee" onClick={() => { refereeWhistle(); clearInput(); }}>Sifflet de l’arbitre</button>}
    </>
  );
}
