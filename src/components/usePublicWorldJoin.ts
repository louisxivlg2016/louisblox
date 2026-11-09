import { useCallback, useEffect, useState } from 'react';
import { busiestPublicWorld, listPublicWorlds } from '../game/publicWorlds';
import type { PublicWorld } from '../game/publicWorlds';
import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { requestRoomMode } from './Multiplayer';

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
      setError('Connexion impossible. Réessaie dans un instant.');
    }
  }, [pendingRoom, room, status, worldReady, onPlay]);

  const join = useCallback((world: PublicWorld) => {
    setError('');
    requestRoomMode(world.gameplayMode, false);
    useGameStore.getState().openWorld(world.id, world.name);
    useGameStore.setState({ worldTemplate: world.template ?? 'nature' });
    setEnabled(true);
    setPendingRoom(world.id);
    configure({ playerName, room: world.id, server });
  }, [playerName, server, configure, setEnabled]);

  const joinBusiest = useCallback(async (mode: GameplayMode) => {
    setError('');
    setLoading(true);
    try {
      const world = busiestPublicWorld(await listPublicWorlds(), mode);
      if (!world) {
        setError(`Aucun joueur en ligne en ${GAMEPLAY_MODE_LABELS[mode]} pour le moment. Choisis un monde dans la liste ou crée le tien.`);
        return false;
      }
      join(world);
      return true;
    } catch {
      setError('Impossible de récupérer les mondes en ligne. Réessaie dans un instant.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [join]);

  return { join, joinBusiest, pending: pendingRoom !== null || loading || status === 'connecting', error };
}
