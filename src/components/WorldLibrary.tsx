import { useEffect, useState } from 'react';
import { listWorlds } from '../game/save';
import type { WorldMeta } from '../game/save';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';

import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';

const MODE_NAMES = GAMEPLAY_MODE_LABELS;

export function WorldLibrary({ onPlay }: { onPlay: () => void | Promise<void> }) {
  const [worlds, setWorlds] = useState<WorldMeta[]>([]);
  const [pending, setPending] = useState(false);
  const worldId = useGameStore((state) => state.worldId);
  const openWorld = useGameStore((state) => state.openWorld);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const server = useMultiplayerStore((state) => state.server);
  const configure = useMultiplayerStore((state) => state.configure);

  useEffect(() => setWorlds(listWorlds()), [worldId]);
  useEffect(() => {
    if (pending && status === 'online') {
      setPending(false);
      void onPlay();
    }
  }, [pending, status, onPlay]);

  const open = (world: WorldMeta) => {
    openWorld(world.id, world.name);
    if (enabled) {
      configure({ playerName, room: world.id, server });
      setPending(true);
    } else {
      window.setTimeout(onPlay, 120);
    }
  };

  return (
    <section id="mes-mondes" className="world-library">
      <div className="world-library-heading"><h2>Mes mondes</h2><span>{worlds.length}</span></div>
      <div className="world-library-list">
        {worlds.map((world) => (
          <button key={world.id} className="world-library-entry" onClick={() => open(world)} aria-label={`Ouvrir ${world.name}`}>
            <strong>{world.name}</strong>
            <small>{MODE_NAMES[world.gameplayMode ?? 'creative']} · {world.updatedAt ? new Date(world.updatedAt).toLocaleDateString('fr-FR') : 'Ancienne sauvegarde'}</small>
          </button>
        ))}
        {worlds.length === 0 && <p>Aucune partie enregistrée pour le moment.</p>}
      </div>
    </section>
  );
}
