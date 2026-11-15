import { useEffect, useState } from 'react';
import { listWorlds, MAX_WORLDS } from '../game/save';
import type { WorldMeta } from '../game/save';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { downloadWorldBackup, importWorldBackup } from '../game/worldBackup';
import { removeWorld } from '../game/deleteWorld';

import { GAMEPLAY_MODE_LABELS, isMultiplayerOnlyMode } from '../game/worldMode';

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
      setMessage('Pirates and Football require multiplayer. Choose “Play multiplayer” to open this save.');
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
    if (!window.confirm(`Delete “${world.name}”?\n\nThe save on this device will be permanently deleted. If you own the online room, it will be deleted for everyone.`)) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await removeWorld(world.id);
      setWorlds(listWorlds());
      setMessage(result.warning || `“${world.name}” has been deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete this world.');
    } finally {
      setBusy(false);
    }
  };
  const exportBackup = () => {
    try {
      const count = downloadWorldBackup();
      setMessage(`${count} world${count > 1 ? 's' : ''} exported. Keep this file to restore your worlds.`);
    } catch {
      setMessage('Unable to export worlds on this device.');
    }
  };
  const importBackup = async (file: File) => {
    setBusy(true);
    setMessage('Importing backup…');
    try {
      const result = importWorldBackup(JSON.parse(await file.text()));
      setWorlds(listWorlds());
      setMessage(`${result.imported.length} world${result.imported.length > 1 ? 's' : ''} imported.${result.skipped > 0 ? ` ${result.skipped} entr${result.skipped > 1 ? 'ies' : 'y'} skipped.` : ''} Your existing worlds were kept.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read this backup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="mes-mondes" className="world-library">
      <div className="world-library-heading"><h2>My Worlds</h2><span>{worlds.length} / {MAX_WORLDS}</span></div>
      <div className="world-backup">
        <button type="button" className="secondary-button" onClick={exportBackup} disabled={busy}>Export my worlds</button>
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
      <p className="world-backup-hint">This file contains your worlds and homes. Keep it to restore them on another device or after clearing the browser.</p>
      {worlds.length >= MAX_WORLDS && <p className="world-backup-hint" role="alert">You reached {MAX_WORLDS} worlds. Delete one to free a slot.</p>}
      {message && <p className="world-backup-message" role="status">{message}</p>}
      <div className="world-library-list">
        {worlds.map((world) => (
          <div className="world-library-item" key={world.id}>
            <button className="world-library-entry" onClick={() => open(world)} aria-label={`Open ${world.name}`} disabled={busy || pending}>
              <strong>{world.name}</strong>
              <small>{MODE_NAMES[world.gameplayMode ?? 'creative']} · {world.updatedAt ? new Date(world.updatedAt).toLocaleDateString('en-US') : 'Old save'}</small>
            </button>
            <button type="button" className="world-delete" onClick={() => void remove(world)} disabled={busy || pending} aria-label={`Delete ${world.name}`}>Delete</button>
          </div>
        ))}
        {worlds.length === 0 && <p>No saved games yet.</p>}
      </div>
    </section>
  );
}
