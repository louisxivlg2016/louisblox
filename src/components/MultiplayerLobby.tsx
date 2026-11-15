import { useEffect, useRef, useState } from 'react';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { deleteRoom, fetchRoomInfo } from '../game/multiplayer';
import type { RoomInfo } from '../game/multiplayer';
import { useGameStore } from '../game/store';
import { canCreateWorld } from '../game/save';
import { findPublicWorldByName, listPublicWorlds } from '../game/publicWorlds';
import type { PublicWorld } from '../game/publicWorlds';
import { GAMEPLAY_MODE_LABELS, isGameplayMode } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import { requestRoomMode } from './Multiplayer';

const MODE_ORDER: GameplayMode[] = ['creative', 'survival', 'battle', 'pirates', 'football', 'maze', 'city-ancient', 'city-modern'];

function modeFromUrl(): GameplayMode | 'room' {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  if (isGameplayMode(mode)) return mode;
  return params.has('room') ? 'room' : 'creative';
}

const STATUS_NAMES = {
  offline: 'Not connected',
  connecting: 'Connecting to room…',
  online: 'Connected',
  error: 'Connection failed',
} as const;

export function MultiplayerLobby({ onPlay, onCreateRoom, createLabel = 'New room', showWhenDisabled = false, idPrefix = 'multiplayer' }: { onPlay: () => void | Promise<void>; onCreateRoom?: (room: string, mode: import('../game/worldMode').GameplayMode | null) => void; createLabel?: string; showWhenDisabled?: boolean; idPrefix?: string }) {
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
  const fieldId = (name: string) => `${idPrefix}-${name}`;
  useEffect(() => setPlayerName(savedName), [savedName]);
  useEffect(() => {
    setServerEditing(showServer);
    return () => setServerEditing(false);
  }, [showServer, setServerEditing]);
  useEffect(() => {
    if ((!enabled && !showWhenDisabled) || !room.trim()) return;
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

  const [resolving, setResolving] = useState(false);
  const limitReached = !canCreateWorld();
  const connect = (nextRoom: string, mode: GameplayMode | null, joinOnly = false) => {
    pendingJoin.current = true;
    requestRoomMode(joinOnly ? null : mode);
    const settings = configure({ playerName, room: nextRoom, server: showServer ? server : '' }, joinOnly);
    setPlayerName(settings.playerName);
    setRoom(settings.room);
    setServer(settings.server);
    const url = new URL(window.location.href);
    url.searchParams.set('room', settings.room);
    if (settings.server) url.searchParams.set('server', settings.server);
    else url.searchParams.delete('server');
    if (mode) url.searchParams.set('mode', mode);
    else url.searchParams.delete('mode');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };
  const joinExisting = (world: PublicWorld) => {
    setJoinMode('room');
    useGameStore.setState({ worldTemplate: world.template ?? 'nature' });
    connect(world.id, null, true);
  };
  const findAndJoin = async (name: string) => {
    const existing = findPublicWorldByName(await listPublicWorlds(), name);
    if (!existing) return false;
    joinExisting(existing);
    return true;
  };
  const join = async () => {
    if (resolving) return;
    setResolving(true);
    try {
      if (await findAndJoin(room)) return;
      connect(room, joinMode === 'room' ? null : joinMode, true);
    } catch {
      useMultiplayerStore.getState().setStatus('error', 'Unable to verify the room name. Try again in a moment.');
    } finally {
      setResolving(false);
    }
  };

  const createRoom = async () => {
    if (resolving) return;
    setResolving(true);
    try {
      if (!canCreateWorld()) {
        useMultiplayerStore.getState().setStatus('error', 'You already have 20 worlds. Delete one in My Worlds before creating a room.');
        return;
      }
      if (onCreateRoom) {
        onCreateRoom(room.trim(), joinMode === 'room' ? null : joinMode);
        return;
      }
      const worldId = `salon-${crypto.randomUUID().slice(0, 8)}`;
      useGameStore.getState().regenerate(useGameStore.getState().gameplayMode, worldId, undefined, room.trim().slice(0, 48) || worldId);
      connect(worldId, joinMode === 'room' ? null : joinMode);
    } catch {
      useMultiplayerStore.getState().setStatus('error', 'Unable to verify the room name. Try again in a moment.');
    } finally {
      setResolving(false);
    }
  };

  const removeRoom = async () => {
    if (!window.confirm(`Delete room “${savedRoom}”? The world and every construction will be erased for everyone.`)) return;
    try {
      await deleteRoom(savedRoom);
    } catch {
      useMultiplayerStore.getState().setStatus('error', 'Unable to delete the room.');
    }
  };

  const invitation = new URL(window.location.href);
  invitation.searchParams.set('room', savedRoom);
  if (savedServer) invitation.searchParams.set('server', savedServer);
  else invitation.searchParams.delete('server');
  invitation.searchParams.set('mode', status === 'online' ? currentMode : joinMode === 'room' ? roomInfo?.gameplayMode ?? currentMode : joinMode);
  const roomModeText = roomInfo
    ? roomInfo.gameplayMode
      ? `Current room: ${GAMEPLAY_MODE_LABELS[roomInfo.gameplayMode]} · ${roomInfo.players} player${roomInfo.players > 1 ? 's' : ''}`
      : 'New room (empty)'
    : 'Unknown room mode';
  const joinTarget = roomInfo?.gameplayMode ?? null;
  const switchesRoom = joinMode !== 'room' && roomInfo?.gameplayMode && roomInfo.gameplayMode !== joinMode;

  return (
    <>
      {(enabled || showWhenDisabled) && (
        <form className="multiplayer-lobby" onSubmit={(event) => { event.preventDefault(); void join(); }}>
          <div className="multiplayer-fields">
            <label htmlFor={fieldId('name')}>Username
              <input id={fieldId('name')} value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={24} autoComplete="nickname" required />
            </label>
            <label htmlFor={fieldId('room')}>Room name
              <input id={fieldId('room')} value={room} onChange={(event) => setRoom(event.target.value)} maxLength={48} autoCapitalize="none" autoCorrect="off" required />
            </label>
          </div>
          <p className="multiplayer-hint">The same room name is all you need to play together. Each player must have a unique username.</p>
          <button type="button" className="multiplayer-server-toggle" onClick={() => setShowServer((visible) => !visible)}>
            {showServer ? 'Hide custom server' : 'Custom server (optional)'}
          </button>
          {showServer && (
            <>
              <label htmlFor={fieldId('server')}>Custom server <span>(optional)</span>
                <input id={fieldId('server')} value={server} onChange={(event) => setServer(event.target.value)} placeholder="wss://…workers.dev/ws" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              </label>
              <p className="multiplayer-hint">Leave the server empty to use automatic connection. Locally, it uses port 8787 on this device.</p>
            </>
          )}
          <div className="multiplayer-mode">
            <label htmlFor={fieldId('mode')}>Mode
              <select id={fieldId('mode')} value={joinMode} onChange={(event) => setJoinMode(event.target.value as GameplayMode | 'room')}>
                <option value="room">Keep room mode</option>
                {MODE_ORDER.map((mode) => <option key={mode} value={mode}>{GAMEPLAY_MODE_LABELS[mode]}</option>)}
              </select>
            </label>
            <p className="multiplayer-hint">
              {roomModeText}
              {switchesRoom && ` → join without changing the room mode`}
            </p>
          </div>
          <div className="multiplayer-actions">
            <button type="submit" className="multiplayer-join" disabled={resolving}>Join{joinTarget ? ` in ${GAMEPLAY_MODE_LABELS[joinTarget]}` : ''}</button>
            <button type="button" className="multiplayer-new-room" onClick={() => void createRoom()} disabled={resolving || limitReached}>{createLabel}</button>
            <button type="button" className="multiplayer-delete-room" onClick={removeRoom}>Delete room</button>
          </div>
          {limitReached && <p className="multiplayer-error" role="alert">You already have 20 worlds. Delete one in My Worlds to free a slot.</p>}
          <div className={`multiplayer-status ${status}`} role="status" aria-live="polite">
            <span className="multiplayer-status-dot" />
            <span>{status === 'online' && !worldReady ? 'Loading world…' : STATUS_NAMES[status]}{status === 'online' && worldReady ? ` · ${players.length} player${players.length > 1 ? 's' : ''}` : ''}</span>
          </div>
          {error && <p className="multiplayer-error" role="alert">{error}</p>}
          {players.length > 0 && (
            <ul className="multiplayer-roster" aria-label="Players in room">
              {players.map((player) => <li key={player.playerId}>{player.name}{player.self ? ' (you)' : ''}</li>)}
            </ul>
          )}
          <label htmlFor={fieldId('invitation')}>Invitation link
            <input id={fieldId('invitation')} className="multiplayer-share" readOnly value={invitation.toString()} onFocus={(event) => event.currentTarget.select()} />
          </label>
        </form>
      )}
    </>
  );
}
