import { useEffect, useState } from 'react';
import { listModePlayers, listPublicWorlds } from '../game/publicWorlds';
import type { ModePlayer, PublicWorld } from '../game/publicWorlds';
import { GAMEPLAY_MODE_LABELS, isMultiplayerOnlyMode } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import { playerIdentity } from '../game/playerIdentity';
import { listWorlds } from '../game/save';
import type { WorldMeta } from '../game/save';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { usePublicWorldJoin } from './usePublicWorldJoin';
import { removeWorld } from '../game/deleteWorld';
import { translate } from '../game/language';

export function CommunityWorlds({ onPlay, mode, onModeChange }: {
  onPlay: () => void | Promise<void>;
  mode?: GameplayMode;
  onModeChange?: (mode: GameplayMode) => void;
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
      setDeleteError(translate('Les modes Pirates et Football nécessitent le multijoueur.', 'Pirates and Football require multiplayer.'));
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
    if (!window.confirm(translate(`Supprimer « ${world.name} » ?\n\nLa sauvegarde sur cet appareil sera définitivement effacée. Si tu possèdes le salon en ligne, il sera supprimé pour tout le monde.`, `Delete “${world.name}”?\n\nThe save on this device will be permanently deleted. If you own the online room, it will be deleted for everyone.`, `¿Eliminar “${world.name}”?\n\nLa partida guardada en este dispositivo se eliminará permanentemente. Si eres propietario de la sala en línea, se eliminará para todos.`))) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const result = await removeWorld(world.id);
      setLocalWorlds(listWorlds());
      setWorlds(await listPublicWorlds());
      if (result.warning) setDeleteError(result.warning);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : translate('Impossible de supprimer ce monde.', 'Unable to delete this world.'));
    } finally {
      setDeleting(false);
    }
  };
  return (
    <section className="community-worlds">
      <div className="community-heading">
        <div><h2>{translate('Rejoindre un monde', 'Join a World')}</h2><p>{translate('Un monde en ligne chez un autre joueur, ou l’une de tes sauvegardes.', 'An online world hosted by another player, or one of your saves.')}</p></div>
        <label>{translate('Mode', 'Mode')}
          <select value={selectedMode} onChange={(event) => setMode(event.target.value as GameplayMode)} aria-label={translate('Mode des mondes proposés', 'Suggested world mode')}>
            {Object.entries(GAMEPLAY_MODE_LABELS()).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="community-actions">
        <button className="multiplayer-join community-random" onClick={() => void joinBusiest(selectedMode)} disabled={pending || status === 'connecting'}>{translate('Rejoindre', 'Join')}</button>
      </div>
      <p className="community-random-hint">{translate(`Rejoins le monde ${GAMEPLAY_MODE_LABELS()[selectedMode]} avec le plus de joueurs. Si aucun monde n’est disponible, un nouveau monde s’ouvre pour toi.`, `Join the ${GAMEPLAY_MODE_LABELS()[selectedMode]} world with the most players. If no world is available, a new world opens for you.`)}</p>
      {error && <p className="multiplayer-error" role="alert">{error}</p>}
      {deleteError && <p className="multiplayer-error" role="alert">{deleteError}</p>}
      <section className="community-section mode-players-section">
        <h3>{translate('Joueurs en', 'Players in')} {GAMEPLAY_MODE_LABELS()[selectedMode]} <span>{modePlayers.length}</span></h3>
        <div className="mode-player-list" aria-label={translate(`Joueurs connectés en ${GAMEPLAY_MODE_LABELS()[selectedMode]}`, `Players connected in ${GAMEPLAY_MODE_LABELS()[selectedMode]}`, `Jugadores conectados en ${GAMEPLAY_MODE_LABELS()[selectedMode]}`)}>
          {modePlayers.map((player) => <div className="mode-player-entry" key={player.playerId}><strong>{player.name}</strong><small>{player.room}</small></div>)}
          {modePlayers.length === 0 && <p>{translate('Aucun joueur connecté dans ce mode pour le moment.', 'No players connected in this mode right now.')}</p>}
        </div>
      </section>
      <section className="community-section">
        <h3>{translate('Mondes des autres joueurs', 'Other players’ worlds')} <span>{others.length}</span></h3>
        <div className="world-library-list">
          {others.map((world) => (
            <button className="world-library-entry" key={world.id} data-world-id={world.id} data-owner-id={world.ownerId} data-mode={world.gameplayMode} onClick={() => join(world)} disabled={deleting || pending || status === 'connecting'}>
              <strong>{world.name}</strong>
              <small>{world.ownerName} · {GAMEPLAY_MODE_LABELS()[world.gameplayMode]} · {world.players} player{world.players > 1 ? 's' : ''} online</small>
            </button>
          ))}
          {others.length === 0 && <p>No public worlds in {GAMEPLAY_MODE_LABELS()[selectedMode]} right now.</p>}
        </div>
      </section>
      <section className="community-section">
        <h3>{translate('Mes mondes', 'My Worlds')} <span>{ownPublic.length + ownLocal.length}</span></h3>
        <div className="world-library-list">
          {ownPublic.map((world) => (
            <div className="world-library-item" key={world.id}>
              <button className="world-library-entry" data-world-id={world.id} data-owner-id={world.ownerId} data-mode={world.gameplayMode} onClick={() => join(world)} disabled={deleting || pending || status === 'connecting'}>
                <strong>{world.name}</strong>
                <small>{translate('Mon monde partagé', 'My shared world')} · {world.players} {translate('joueur', 'player')}{world.players > 1 ? 's' : ''} {translate('en ligne', 'online')}</small>
              </button>
              <button type="button" className="world-delete" onClick={() => void remove(world)} disabled={deleting || pending || status === 'connecting'} aria-label={translate(`Supprimer ${world.name}`, `Delete ${world.name}`, `Eliminar ${world.name}`)}>{translate('Supprimer', 'Delete')}</button>
            </div>
          ))}
          {ownLocal.map((world) => (
            <div className="world-library-item" key={world.id}>
              <button className="world-library-entry" data-world-id={world.id} data-mode={world.gameplayMode ?? 'creative'} onClick={() => openLocal(world)} disabled={deleting || pending || status === 'connecting' || !enabled && isMultiplayerOnlyMode(world.gameplayMode ?? 'creative')} title={!enabled && isMultiplayerOnlyMode(world.gameplayMode ?? 'creative') ? translate('Multijoueur requis', 'Multiplayer required') : undefined}>
                <strong>{world.name}</strong>
                <small>{translate('Ma sauvegarde', 'My save', 'Mi partida guardada')} · {GAMEPLAY_MODE_LABELS()[world.gameplayMode ?? 'creative']} · {!enabled && isMultiplayerOnlyMode(world.gameplayMode ?? 'creative') ? translate('Multijoueur requis', 'Multiplayer required') : world.updatedAt ? new Date(world.updatedAt).toLocaleDateString(translate('fr-FR', 'en-US', 'es-ES')) : translate('Ancienne sauvegarde', 'Old save')}</small>
              </button>
              <button type="button" className="world-delete" onClick={() => void remove(world)} disabled={deleting || pending || status === 'connecting'} aria-label={translate(`Supprimer ${world.name}`, `Delete ${world.name}`, `Eliminar ${world.name}`)}>{translate('Supprimer', 'Delete')}</button>
            </div>
          ))}
          {ownPublic.length + ownLocal.length === 0 && <p>{translate(`Aucune sauvegarde en ${GAMEPLAY_MODE_LABELS()[selectedMode]} pour le moment.`, `No saves in ${GAMEPLAY_MODE_LABELS()[selectedMode]} right now.`, `No hay partidas guardadas en ${GAMEPLAY_MODE_LABELS()[selectedMode]} en este momento.`)}</p>}
        </div>
      </section>
    </section>
  );
}
