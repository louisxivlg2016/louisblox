import { useEffect, useRef, useState } from 'react';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { deleteRoom, fetchRoomInfo } from '../game/multiplayer';
import type { RoomInfo } from '../game/multiplayer';
import { useGameStore } from '../game/store';
import { GAMEPLAY_MODE_LABELS, isGameplayMode } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import { requestRoomMode } from './Multiplayer';

const MODE_ORDER: GameplayMode[] = ['battle', 'creative', 'survival', 'city-ancient', 'city-modern'];

function modeFromUrl(): GameplayMode | 'room' {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  if (isGameplayMode(mode)) return mode;
  return params.has('room') ? 'room' : 'creative';
}

const STATUS_NAMES = {
  offline: 'Non connecté',
  connecting: 'Connexion au salon…',
  online: 'Connecté',
  error: 'Connexion impossible',
} as const;

export function MultiplayerLobby({ onPlay }: { onPlay: () => void | Promise<void> }) {
  const enabled = useMultiplayerStore((state) => state.enabled);
  const savedName = useMultiplayerStore((state) => state.playerName);
  const savedRoom = useMultiplayerStore((state) => state.room);
  const savedServer = useMultiplayerStore((state) => state.server);
  const status = useMultiplayerStore((state) => state.status);
  const worldReady = useMultiplayerStore((state) => state.worldReady);
  const error = useMultiplayerStore((state) => state.error);
  const players = useMultiplayerStore((state) => state.players);
  const pendingJoin = useRef(false);
  const configure = useMultiplayerStore((state) => state.configure);
  const setServerEditing = useMultiplayerStore((state) => state.setServerEditing);
  const [playerName, setPlayerName] = useState(savedName);
  const [room, setRoom] = useState(savedRoom);
  const [server, setServer] = useState(savedServer);
  const [showServer, setShowServer] = useState(() => new URLSearchParams(window.location.search).has('server'));
  const [joinMode, setJoinMode] = useState<GameplayMode | 'room'>(modeFromUrl);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const currentMode = useGameStore((state) => state.gameplayMode);
  useEffect(() => setPlayerName(savedName), [savedName]);
  useEffect(() => {
    setServerEditing(showServer);
    return () => setServerEditing(false);
  }, [showServer, setServerEditing]);
  useEffect(() => {
    if (!enabled || !room.trim()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchRoomInfo(room.trim(), showServer ? server : '', controller.signal)
        .then(setRoomInfo)
        .catch(() => setRoomInfo(null));
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, room, server, showServer, status]);
  useEffect(() => {
    if (status !== 'online' || !worldReady || !pendingJoin.current) return;
    pendingJoin.current = false;
    void onPlay();
  }, [status, worldReady, onPlay]);

  const join = (nextRoom = room) => {
    pendingJoin.current = true;
    requestRoomMode(joinMode === 'room' ? null : joinMode);
    const settings = configure({ playerName, room: nextRoom, server: showServer ? server : '' });
    setPlayerName(settings.playerName);
    setRoom(settings.room);
    setServer(settings.server);
    const url = new URL(window.location.href);
    url.searchParams.set('room', settings.room);
    if (settings.server) url.searchParams.set('server', settings.server);
    else url.searchParams.delete('server');
    if (joinMode !== 'room') url.searchParams.set('mode', joinMode);
    else url.searchParams.delete('mode');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const createRoom = () => {
    const worldId = `salon-${crypto.randomUUID().slice(0, 8)}`;
    useGameStore.getState().regenerate(useGameStore.getState().gameplayMode, worldId, undefined, room.trim().slice(0, 48) || worldId);
    join(worldId);
  };

  const removeRoom = async () => {
    if (!window.confirm(`Supprimer le salon « ${savedRoom} » ? Le monde et toutes ses constructions seront effacés pour tout le monde.`)) return;
    try {
      await deleteRoom(savedRoom);
    } catch {
      useMultiplayerStore.getState().setStatus('error', 'Impossible de supprimer le salon.');
    }
  };

  const invitation = new URL(window.location.href);
  invitation.searchParams.set('room', savedRoom);
  if (savedServer) invitation.searchParams.set('server', savedServer);
  else invitation.searchParams.delete('server');
  invitation.searchParams.set('mode', status === 'online' ? currentMode : joinMode === 'room' ? roomInfo?.gameplayMode ?? currentMode : joinMode);
  const roomModeText = roomInfo
    ? roomInfo.gameplayMode
      ? `Salon actuel : ${GAMEPLAY_MODE_LABELS[roomInfo.gameplayMode]} · ${roomInfo.players} joueur${roomInfo.players > 1 ? 's' : ''}`
      : 'Nouveau salon (vide)'
    : 'Mode du salon inconnu';
  const joinTarget = joinMode === 'room' ? roomInfo?.gameplayMode ?? null : joinMode;
  const switchesRoom = joinMode !== 'room' && roomInfo?.gameplayMode && roomInfo.gameplayMode !== joinMode;

  return (
    <>
      {enabled && (
        <form className="multiplayer-lobby" onSubmit={(event) => { event.preventDefault(); join(); }}>
          <div className="multiplayer-fields">
            <label htmlFor="multiplayer-name">Pseudo
              <input id="multiplayer-name" value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={24} autoComplete="nickname" required />
            </label>
            <label htmlFor="multiplayer-room">Nom du salon
              <input id="multiplayer-room" value={room} onChange={(event) => setRoom(event.target.value)} maxLength={48} autoCapitalize="none" autoCorrect="off" required />
            </label>
          </div>
          <p className="multiplayer-hint">Le même nom de salon suffit pour jouer ensemble. Chaque joueur doit avoir un pseudo unique.</p>
          <button type="button" className="multiplayer-server-toggle" onClick={() => setShowServer((visible) => !visible)}>
            {showServer ? 'Masquer le serveur personnalisé' : 'Serveur personnalisé (optionnel)'}
          </button>
          {showServer && (
            <>
              <label htmlFor="multiplayer-server">Serveur personnalisé <span>(optionnel)</span>
                <input id="multiplayer-server" value={server} onChange={(event) => setServer(event.target.value)} placeholder="wss://…workers.dev/ws" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              </label>
              <p className="multiplayer-hint">Laisse le serveur vide pour utiliser la connexion automatique. En local, il utilise le port 8787 de cet appareil.</p>
            </>
          )}
          <div className="multiplayer-mode">
            <label htmlFor="multiplayer-mode">Mode
              <select id="multiplayer-mode" value={joinMode} onChange={(event) => setJoinMode(event.target.value as GameplayMode | 'room')}>
                <option value="room">Garder le mode du salon</option>
                {MODE_ORDER.map((mode) => <option key={mode} value={mode}>{GAMEPLAY_MODE_LABELS[mode]}</option>)}
              </select>
            </label>
            <p className="multiplayer-hint">
              {roomModeText}
              {switchesRoom && ` → passera en ${GAMEPLAY_MODE_LABELS[joinMode as GameplayMode]} pour tout le monde`}
            </p>
          </div>
          <div className="multiplayer-actions">
            <button type="submit" className="multiplayer-join">Rejoindre{joinTarget ? ` en ${GAMEPLAY_MODE_LABELS[joinTarget]}` : ''}</button>
            <button type="button" className="multiplayer-new-room" onClick={createRoom}>Nouveau salon</button>
            <button type="button" className="multiplayer-delete-room" onClick={removeRoom}>Supprimer le salon</button>
          </div>
          <div className={`multiplayer-status ${status}`} role="status" aria-live="polite">
            <span className="multiplayer-status-dot" />
            <span>{status === 'online' && !worldReady ? 'Chargement du monde…' : STATUS_NAMES[status]}{status === 'online' && worldReady ? ` · ${players.length} joueur${players.length > 1 ? 's' : ''}` : ''}</span>
          </div>
          {error && <p className="multiplayer-error" role="alert">{error}</p>}
          {players.length > 0 && (
            <ul className="multiplayer-roster" aria-label="Joueurs dans le salon">
              {players.map((player) => <li key={player.playerId}>{player.name}{player.self ? ' (toi)' : ''}</li>)}
            </ul>
          )}
          <label htmlFor="multiplayer-invitation">Lien d’invitation
            <input id="multiplayer-invitation" className="multiplayer-share" readOnly value={invitation.toString()} onFocus={(event) => event.currentTarget.select()} />
          </label>
        </form>
      )}
    </>
  );
}
