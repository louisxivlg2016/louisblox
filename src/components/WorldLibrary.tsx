import { useEffect, useState } from 'react';
import { isMultiplayerWorld, listWorlds } from '../game/save';
import type { WorldMeta } from '../game/save';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { removeWorld } from '../game/deleteWorld';

import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';
import { translate } from '../game/language';

const MODE_NAMES = GAMEPLAY_MODE_LABELS;

export function WorldLibrary({ onPlay, onCreateSolo }: { onPlay: () => void | Promise<void>; onCreateSolo: () => void }) {
  const [worlds, setWorlds] = useState<WorldMeta[]>([]);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'solo' | 'multiplayer' | null>(null);
  const worldId = useGameStore((state) => state.worldId);
  const openWorld = useGameStore((state) => state.openWorld);
  const status = useMultiplayerStore((state) => state.status);
  const worldReady = useMultiplayerStore((state) => state.worldReady);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const server = useMultiplayerStore((state) => state.server);
  const configure = useMultiplayerStore((state) => state.configure);
  const setEnabled = useMultiplayerStore((state) => state.setEnabled);

  useEffect(() => setWorlds(listWorlds()), [worldId]);
  useEffect(() => {
    if (pending && status === 'online' && worldReady) {
      setPending(false);
      void onPlay();
    }
  }, [pending, status, worldReady, onPlay]);

  const open = (world: WorldMeta) => {
    const multiplayer = isMultiplayerWorld(world);
    setMessage('');
    setEnabled(multiplayer);
    openWorld(world.id, world.name);
    if (multiplayer) {
      configure({ playerName, room: world.id, server });
      setPending(true);
    } else {
      setPending(false);
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
  const filteredWorlds = worlds.filter((world) => isMultiplayerWorld(world) === (category === 'multiplayer'));
  const soloCount = worlds.filter((world) => !isMultiplayerWorld(world)).length;
  const multiplayerCount = worlds.length - soloCount;

  if (category === null) return (
    <section id="mes-mondes" className="world-library world-library-start">
      <div className="world-library-heading"><h2>{translate('Mes mondes', 'My Worlds')}</h2></div>
      <p>{translate('Choisis les mondes que tu veux voir.', 'Choose which worlds you want to see.')}</p>
      <div className="world-library-mode-choices">
        <button type="button" className="world-library-mode-choice" onClick={() => setCategory('solo')}><strong>Solo</strong><span>{soloCount} {translate('monde', 'world')}{soloCount > 1 ? 's' : ''}</span></button>
        <button type="button" className="world-library-mode-choice" onClick={() => setCategory('multiplayer')}><strong>{translate('Multijoueur', 'Multiplayer')}</strong><span>{multiplayerCount} {translate('monde', 'world')}{multiplayerCount > 1 ? 's' : ''}</span></button>
      </div>
    </section>
  );

  return (
    <section id="mes-mondes" className="world-library">
      <button type="button" className="secondary-button world-library-back" onClick={() => setCategory(null)}>{translate('← Changer de catégorie', '← Change category')}</button>
      <div className="world-library-heading"><h2>{category === 'solo' ? translate('Tes mondes solos', 'Your solo worlds') : translate('Tes mondes multijoueurs', 'Your multiplayer worlds')}</h2><span>{filteredWorlds.length}</span></div>
      {category === 'solo' && <button type="button" className="primary-button world-create-solo" onClick={onCreateSolo}>{translate('Créer un monde solo', 'Create a solo world')}</button>}
      {message && <p className="world-backup-message" role="status">{message}</p>}
      <div className="world-library-list">
        {filteredWorlds.map((world) => (
          <div className="world-library-item" key={world.id}>
            <button className="world-library-entry" onClick={() => open(world)} aria-label={translate(`Ouvrir ${world.name}`, `Open ${world.name}`, `Abrir ${world.name}`)} disabled={busy || pending}>
              <strong>{world.name}</strong>
              <small>{MODE_NAMES()[world.gameplayMode ?? 'creative']} · {world.updatedAt ? new Date(world.updatedAt).toLocaleDateString(translate('fr-FR', 'en-US', 'es-ES')) : translate('Ancienne sauvegarde', 'Old save')}</small>
            </button>
            <button type="button" className="world-delete" onClick={() => void remove(world)} disabled={busy || pending} aria-label={translate(`Supprimer ${world.name}`, `Delete ${world.name}`, `Eliminar ${world.name}`)}>{translate('Supprimer', 'Delete')}</button>
          </div>
        ))}
        {filteredWorlds.length === 0 && <p>{category === 'solo' ? translate('Aucun monde solo enregistré pour le moment.', 'No solo worlds saved yet.') : translate('Aucun monde multijoueur enregistré pour le moment.', 'No multiplayer worlds saved yet.')}</p>}
      </div>
    </section>
  );
}
