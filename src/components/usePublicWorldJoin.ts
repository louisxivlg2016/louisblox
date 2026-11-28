import { useCallback, useEffect, useState } from 'react';
import { busiestPublicWorld, listPublicWorlds } from '../game/publicWorlds';
import type { PublicWorld } from '../game/publicWorlds';
import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { requestRoomMode } from './Multiplayer';
import { translate } from '../game/language';

export function usePublicWorldJoin(onPlay: () => void | Promise<void>) {
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const status = useMultiplayerStore((state) => state.status);
  const room = useMultiplayerStore((state) => state.room);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const server = useMultiplayerStore((state) => state.server);
  const configure = useMultiplayerStore((state) => state.configure);
  const setEnabled = useMultiplayerStore((state) => state.setEnabled);
  const worldReady = useMultiplayerStore((state) => state.worldReady);

  useEffect(() => {
    if (!pendingRoom) return;
    if (status === 'online' && worldReady && pendingRoom === room) {
      setPendingRoom(null);
      void onPlay();
    } else if (status === 'error') {
      setPendingRoom(null);
      setError(translate('Connexion impossible. Réessaie dans un instant.', 'Connection failed. Try again in a moment.'));
    }
  }, [pendingRoom, room, status, worldReady, onPlay]);

  const join = useCallback((world: PublicWorld) => {
    setError('');
    requestRoomMode(null, false);
    useGameStore.setState({ worldTemplate: world.template ?? 'nature' });
    setEnabled(true);
    setPendingRoom(world.id);
    configure({ playerName, room: world.id, server }, false);
  }, [playerName, server, configure, setEnabled]);

  const joinBusiest = useCallback(async (mode: GameplayMode) => {
    setError('');
    setLoading(true);
    try {
      const candidates = (await listPublicWorlds()).filter((world) => world.id !== room);
      const world = busiestPublicWorld(candidates, mode);
      if (world) {
        join(world);
        return true;
      }
      const id = `salon-${crypto.randomUUID().slice(0, 8)}`;
      const template = mode === 'city-ancient' || mode === 'city-modern' ? mode : mode === 'pirates' && useGameStore.getState().worldTemplate === 'fortress' ? 'fortress' : 'nature';
      const name = translate(`Monde ${GAMEPLAY_MODE_LABELS()[mode]}`, `${GAMEPLAY_MODE_LABELS()[mode]} world`);
      requestRoomMode(mode);
      useGameStore.getState().regenerate(mode, id, template, name);
      setEnabled(true);
      setPendingRoom(id);
      configure({ playerName, room: id, server });
      return true;
    } catch {
      setError(translate('Impossible de récupérer les mondes en ligne. Réessaie dans un instant.', 'Unable to fetch online worlds. Try again in a moment.'));
      return false;
    } finally {
      setLoading(false);
    }
  }, [configure, join, playerName, room, server, setEnabled]);

  return { join, joinBusiest, pending: pendingRoom !== null || loading || status === 'connecting', error };
}
