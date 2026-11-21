import { useEffect, useState } from 'react';
import { listWorlds } from '../game/save';
import type { WorldMeta } from '../game/save';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { downloadWorldBackup, importWorldBackup } from '../game/worldBackup';
import { removeWorld } from '../game/deleteWorld';

import { GAMEPLAY_MODE_LABELS, isMultiplayerOnlyMode } from '../game/worldMode';
import { translate } from '../game/language';

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
    if (!enabled && isMultiplayerOnlyMode(world.gameplayMode ?? 'creative')) {
      setMessage(translate('Les modes Pirates et Football nécessitent le multijoueur. Choisis « Jouer en multijoueur » pour ouvrir cette sauvegarde.', 'Pirates and Football require multiplayer. Choose “Play multiplayer” to open this save.'));
      return;
    }
    setMessage('');
    openWorld(world.id, world.name);
    if (enabled) {
      configure({ playerName, room: world.id, server });
      setPending(true);
    } else {
      window.setTimeout(onPlay, 120);
    }
  };
  const remove = async (world: WorldMeta) => {
    if (!window.confirm(translate(`Supprimer « ${world.name} » ?\n\nLa sauvegarde sur cet appareil sera définitivement effacée. Si tu possèdes le salon en ligne, il sera supprimé pour tout le monde.`, `Delete “${world.name}”?\n\nThe save on this device will be permanently deleted. If you own the online room, it will be deleted for everyone.`, `¿Eliminar “${world.name}”?\n\nLa partida guardada en este dispositivo se eliminará permanentemente. Si eres propietario de la sala en línea, se eliminará para todos.`))) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await removeWorld(world.id);
      setWorlds(listWorlds());
      setMessage(result.warning || translate(`« ${world.name} » a été supprimé.`, `“${world.name}” has been deleted.`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : translate('Impossible de supprimer ce monde.', 'Unable to delete this world.'));
    } finally {
      setBusy(false);
    }
  };
  const exportBackup = () => {
    try {
      const count = downloadWorldBackup();
      setMessage(translate(`${count} monde${count > 1 ? 's' : ''} exporté${count > 1 ? 's' : ''}. Garde bien ce fichier pour retrouver tes mondes.`, `${count} world${count > 1 ? 's' : ''} exported. Keep this file to restore your worlds.`));
    } catch {
      setMessage(translate('Impossible d’exporter les mondes sur cet appareil.', 'Unable to export worlds on this device.'));
    }
  };
  const importBackup = async (file: File) => {
    setBusy(true);
    setMessage(translate('Importation de la sauvegarde…', 'Importing backup…'));
    try {
      const result = importWorldBackup(JSON.parse(await file.text()));
      setWorlds(listWorlds());
      setMessage(translate(`${result.imported.length} monde${result.imported.length > 1 ? 's' : ''} importé${result.imported.length > 1 ? 's' : ''}.${result.skipped > 0 ? ` ${result.skipped} entrée ignorée.` : ''} Tes mondes existants sont conservés.`, `${result.imported.length} world${result.imported.length > 1 ? 's' : ''} imported.${result.skipped > 0 ? ` ${result.skipped} entry skipped.` : ''} Your existing worlds were kept.`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : translate('Impossible de lire cette sauvegarde.', 'Unable to read this backup.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="mes-mondes" className="world-library">
      <div className="world-library-heading"><h2>{translate('Mes mondes', 'My Worlds')}</h2><span>{worlds.length}</span></div>
      <div className="world-backup">
        <button type="button" className="secondary-button" onClick={exportBackup} disabled={busy}>{translate('Exporter mes mondes', 'Export my worlds')}</button>
        <label className="world-backup-import" role="button" tabIndex={0} onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.currentTarget.querySelector('input')?.click();
        }}>
          {translate('Importer une sauvegarde', 'Import a backup', 'Importar una copia de seguridad')}
          <input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importBackup(file);
            event.currentTarget.value = '';
          }} />
        </label>
      </div>
      <p className="world-backup-hint">{translate('Le fichier contient tes mondes et leurs maisons. Garde-le pour les retrouver sur un autre appareil ou après un effacement du navigateur.', 'This file contains your worlds and homes. Keep it to restore them on another device or after clearing the browser.')}</p>
      {message && <p className="world-backup-message" role="status">{message}</p>}
      <div className="world-library-list">
        {worlds.map((world) => (
          <div className="world-library-item" key={world.id}>
            <button className="world-library-entry" onClick={() => open(world)} aria-label={translate(`Ouvrir ${world.name}`, `Open ${world.name}`, `Abrir ${world.name}`)} disabled={busy || pending}>
              <strong>{world.name}</strong>
              <small>{MODE_NAMES()[world.gameplayMode ?? 'creative']} · {world.updatedAt ? new Date(world.updatedAt).toLocaleDateString(translate('fr-FR', 'en-US', 'es-ES')) : translate('Ancienne sauvegarde', 'Old save')}</small>
            </button>
            <button type="button" className="world-delete" onClick={() => void remove(world)} disabled={busy || pending} aria-label={translate(`Supprimer ${world.name}`, `Delete ${world.name}`, `Eliminar ${world.name}`)}>{translate('Supprimer', 'Delete')}</button>
          </div>
        ))}
        {worlds.length === 0 && <p>{translate('Aucune partie enregistrée pour le moment.', 'No saved games yet.')}</p>}
      </div>
    </section>
  );
}
