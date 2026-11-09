import { useEffect, useState } from 'react';
import { listWorlds } from '../game/save';
import type { WorldMeta } from '../game/save';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { downloadWorldBackup, importWorldBackup } from '../game/worldBackup';

import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';

const MODE_NAMES = GAMEPLAY_MODE_LABELS;

export function WorldLibrary({ onPlay }: { onPlay: () => void | Promise<void> }) {
  const [worlds, setWorlds] = useState<WorldMeta[]>([]);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const worldId = useGameStore((state) => state.worldId);
  const openWorld = useGameStore((state) => state.openWorld);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const worldReady = useMultiplayerStore((state) => state.worldReady);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const server = useMultiplayerStore((state) => state.server);
  const configure = useMultiplayerStore((state) => state.configure);

  useEffect(() => setWorlds(listWorlds()), [worldId]);
  useEffect(() => {
    if (pending && status === 'online' && worldReady) {
      setPending(false);
      void onPlay();
    }
  }, [pending, status, worldReady, onPlay]);

  const open = (world: WorldMeta) => {
    openWorld(world.id, world.name);
    if (enabled) {
      configure({ playerName, room: world.id, server });
      setPending(true);
    } else {
      window.setTimeout(onPlay, 120);
    }
  };
  const exportBackup = () => {
    try {
      const count = downloadWorldBackup();
      setMessage(`${count} monde${count > 1 ? 's' : ''} exporté${count > 1 ? 's' : ''}. Garde bien ce fichier pour retrouver tes mondes.`);
    } catch {
      setMessage('Impossible d’exporter les mondes sur cet appareil.');
    }
  };
  const importBackup = async (file: File) => {
    setBusy(true);
    setMessage('Importation de la sauvegarde…');
    try {
      const result = importWorldBackup(JSON.parse(await file.text()));
      setWorlds(listWorlds());
      setMessage(`${result.imported.length} monde${result.imported.length > 1 ? 's' : ''} importé${result.imported.length > 1 ? 's' : ''}.${result.skipped > 0 ? ` ${result.skipped} entrée${result.skipped > 1 ? 's' : ''} ignorée${result.skipped > 1 ? 's' : ''}.` : ''} Tes mondes existants sont conservés.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de lire cette sauvegarde.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="mes-mondes" className="world-library">
      <div className="world-library-heading"><h2>Mes mondes</h2><span>{worlds.length}</span></div>
      <div className="world-backup">
        <button type="button" className="secondary-button" onClick={exportBackup} disabled={busy}>Exporter mes mondes</button>
        <label className="world-backup-import" role="button" tabIndex={0} onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.currentTarget.querySelector('input')?.click();
        }}>
          Importer une sauvegarde
          <input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importBackup(file);
            event.currentTarget.value = '';
          }} />
        </label>
      </div>
      <p className="world-backup-hint">Le fichier contient tes mondes et leurs maisons. Garde-le pour les retrouver sur un autre appareil ou après un effacement du navigateur.</p>
      {message && <p className="world-backup-message" role="status">{message}</p>}
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
