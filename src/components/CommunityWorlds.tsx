import { useEffect, useState } from 'react';
import { listModePlayers, listPublicWorlds } from '../game/publicWorlds';
import type { ModePlayer, PublicWorld } from '../game/publicWorlds';
import { GAMEPLAY_MODE_LABELS, isMultiplayerOnlyMode } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import { playerIdentity } from '../game/playerIdentity';
import { canCreateWorld, listWorlds, MAX_WORLDS } from '../game/save';
import type { WorldMeta } from '../game/save';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { usePublicWorldJoin } from './usePublicWorldJoin';
import { removeWorld } from '../game/deleteWorld';

export function CommunityWorlds({ onPlay, mode, onModeChange, onCreate }: {
  onPlay: () => void | Promise<void>;
  mode?: GameplayMode;
  onModeChange?: (mode: GameplayMode) => void;
  onCreate?: () => void;
}) {
  const [worlds, setWorlds] = useState<PublicWorld[]>([]);
  const [localWorlds, setLocalWorlds] = useState<WorldMeta[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [internalMode, setInternalMode] = useState<GameplayMode>(() => useGameStore.getState().gameplayMode);
  const selectedMode = mode ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const worldId = useGameStore((state) => state.worldId);
  const { join, joinBusiest, pending, error } = usePublicWorldJoin(onPlay);
  const selfId = playerIdentity();
  const others = worlds.filter((world) => world.ownerId !== selfId && world.gameplayMode === selectedMode);
  const localIds = new Set(localWorlds.map((world) => world.id));
  const ownPublic = worlds.filter((world) => world.ownerId === selfId && world.gameplayMode === selectedMode && !localIds.has(world.id));
  const ownLocal = localWorlds.filter((world) => (world.gameplayMode ?? 'creative') === selectedMode);
  const full = !canCreateWorld();

  useEffect(() => {
    let active = true;
    const load = () => listPublicWorlds().then((items) => { if (active) setWorlds(items); }).catch(() => { if (active) setWorlds([]); });
    void load();
    const timer = window.setInterval(load, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [status]);
  const [modePlayers, setModePlayers] = useState<ModePlayer[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const players = await listModePlayers(selectedMode).catch(() => [] as ModePlayer[]);
      if (active) setModePlayers(players);
    };
    void load();
    const timer = window.setInterval(load, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedMode, status]);
  useEffect(() => setLocalWorlds(listWorlds()), [worldId]);

  const openLocal = (world: WorldMeta) => {
    if (!enabled && isMultiplayerOnlyMode(world.gameplayMode ?? selectedMode)) {
      setDeleteError('Les modes Pirates et Football nécessitent le multijoueur.');
      return;
    }
    setDeleteError('');
    if (!enabled) {
      useGameStore.getState().openWorld(world.id, world.name);
      window.setTimeout(onPlay, 120);
      return;
    }
    const gameplayMode = world.gameplayMode ?? selectedMode;
    join({ id: world.id, name: world.name, ownerId: selfId, ownerName: playerName, gameplayMode, template: gameplayMode === 'city-ancient' || gameplayMode === 'city-modern' ? gameplayMode : 'nature', players: 0, updatedAt: world.updatedAt });
  };
  const remove = async (world: WorldMeta) => {
    if (!window.confirm(`Supprimer « ${world.name} » ?\n\nLa sauvegarde sur cet appareil sera définitivement supprimée. Si tu es le créateur du salon en ligne, il sera supprimé pour tout le monde.`)) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const result = await removeWorld(world.id);
      setLocalWorlds(listWorlds());
      setWorlds(await listPublicWorlds());
      if (result.warning) setDeleteError(result.warning);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Impossible de supprimer ce monde.');
    } finally {
      setDeleting(false);
    }
  };
  return (
    <section className="community-worlds">
      <div className="community-heading">
        <div><h2>Rejoindre un monde</h2><p>Un monde en ligne chez un autre joueur, ou l’une de tes sauvegardes.</p></div>
        <label>Mode
          <select value={selectedMode} onChange={(event) => setMode(event.target.value as GameplayMode)} aria-label="Mode des mondes proposés">
            {Object.entries(GAMEPLAY_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="community-actions">
        <button className="multiplayer-join community-random" onClick={() => void joinBusiest(selectedMode)} disabled={pending || status === 'connecting'}>Rejoindre</button>
        {onCreate && <button className="secondary-button community-create" onClick={onCreate} disabled={full || pending || status === 'connecting' || !enabled && isMultiplayerOnlyMode(selectedMode)}>{!enabled && isMultiplayerOnlyMode(selectedMode) ? 'Multijoueur requis' : 'Créer ici'}</button>}
      </div>
      <p className="community-random-hint">Rejoins le monde {GAMEPLAY_MODE_LABELS[selectedMode]} avec le plus de joueurs en ligne.</p>
      {full && <p className="multiplayer-error" role="alert">Tu as atteint {MAX_WORLDS} mondes. Supprimes-en un pour en créer un autre.</p>}
      {error && <p className="multiplayer-error" role="alert">{error}</p>}
      {deleteError && <p className="multiplayer-error" role="alert">{deleteError}</p>}
      <section className="community-section mode-players-section">
        <h3>Joueurs en {GAMEPLAY_MODE_LABELS[selectedMode]} <span>{modePlayers.length}</span></h3>
        <div className="mode-player-list" aria-label={`Joueurs connectés en ${GAMEPLAY_MODE_LABELS[selectedMode]}`}>
          {modePlayers.map((player) => <div className="mode-player-entry" key={player.playerId}><strong>{player.name}</strong><small>{player.room}</small></div>)}
          {modePlayers.length === 0 && <p>Aucun joueur connecté dans ce mode pour le moment.</p>}
        </div>
      </section>
      <section className="community-section">
        <h3>Mondes des autres joueurs <span>{others.length}</span></h3>
        <div className="world-library-list">
          {others.map((world) => (
            <button className="world-library-entry" key={world.id} data-world-id={world.id} data-owner-id={world.ownerId} data-mode={world.gameplayMode} onClick={() => join(world)} disabled={deleting || pending || status === 'connecting'}>
              <strong>{world.name}</strong>
              <small>{world.ownerName} · {GAMEPLAY_MODE_LABELS[world.gameplayMode]} · {world.players} joueur{world.players > 1 ? 's' : ''} en ligne</small>
            </button>
          ))}
          {others.length === 0 && <p>Aucun monde public en {GAMEPLAY_MODE_LABELS[selectedMode]} pour le moment.</p>}
        </div>
      </section>
      <section className="community-section">
        <h3>Mes mondes <span>{ownPublic.length + ownLocal.length}</span></h3>
        <div className="world-library-list">
          {ownPublic.map((world) => (
            <div className="world-library-item" key={world.id}>
              <button className="world-library-entry" data-world-id={world.id} data-owner-id={world.ownerId} data-mode={world.gameplayMode} onClick={() => join(world)} disabled={deleting || pending || status === 'connecting'}>
                <strong>{world.name}</strong>
                <small>Mon monde partagé · {world.players} joueur{world.players > 1 ? 's' : ''} en ligne</small>
              </button>
              <button type="button" className="world-delete" onClick={() => void remove(world)} disabled={deleting || pending || status === 'connecting'} aria-label={`Supprimer ${world.name}`}>Supprimer</button>
            </div>
          ))}
          {ownLocal.map((world) => (
            <div className="world-library-item" key={world.id}>
              <button className="world-library-entry" data-world-id={world.id} data-mode={world.gameplayMode ?? 'creative'} onClick={() => openLocal(world)} disabled={deleting || pending || status === 'connecting' || !enabled && isMultiplayerOnlyMode(world.gameplayMode ?? 'creative')} title={!enabled && isMultiplayerOnlyMode(world.gameplayMode ?? 'creative') ? 'Multijoueur requis' : undefined}>
                <strong>{world.name}</strong>
                <small>Ma sauvegarde · {GAMEPLAY_MODE_LABELS[world.gameplayMode ?? 'creative']} · {!enabled && isMultiplayerOnlyMode(world.gameplayMode ?? 'creative') ? 'Multijoueur requis' : world.updatedAt ? new Date(world.updatedAt).toLocaleDateString('fr-FR') : 'Ancienne sauvegarde'}</small>
              </button>
              <button type="button" className="world-delete" onClick={() => void remove(world)} disabled={deleting || pending || status === 'connecting'} aria-label={`Supprimer ${world.name}`}>Supprimer</button>
            </div>
          ))}
          {ownPublic.length + ownLocal.length === 0 && <p>Aucune sauvegarde en {GAMEPLAY_MODE_LABELS[selectedMode]} pour le moment.</p>}
        </div>
      </section>
    </section>
  );
}
