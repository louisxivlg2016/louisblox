import { useEffect, useState } from 'react';
import { MenuDialog } from './MenuDialog';
import { MAX_HOMES, NO_HOMES, useHomeStore } from '../game/homes';
import type { Home } from '../game/homes';
import { useGameStore } from '../game/store';
import { Player, PlayerPosition, PlayerState } from '../game/traits';
import { world } from '../game/world';
import { teleportToHome } from '../game/teleport';
import { requestPlay } from '../game/input';

export function HomePanel() {
  const open = useHomeStore((state) => state.open);
  const setOpen = useHomeStore((state) => state.setOpen);
  const createHome = useHomeStore((state) => state.createHome);
  const renameHome = useHomeStore((state) => state.renameHome);
  const deleteHome = useHomeStore((state) => state.deleteHome);
  const worldId = useGameStore((state) => state.worldId);
  const homes = useHomeStore((state) => state.homes[worldId] ?? NO_HOMES);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(`Maison ${Math.min(homes.length + 1, MAX_HOMES)}`);
    setEditing(null);
    setMessage('');
  }, [open, worldId]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    void requestPlay();
  };
  const create = (event: React.FormEvent) => {
    event.preventDefault();
    const player = world.queryFirst(Player);
    const position = player?.get(PlayerPosition);
    const state = player?.get(PlayerState);
    if (!position || !state) {
      setMessage('Impossible de trouver ta position actuelle.');
      return;
    }
    const result = createHome(worldId, name, { x: position.x, y: position.y, z: position.z, yaw: state.yaw, pitch: state.pitch });
    if (!result.home) {
      setMessage(result.error);
      return;
    }
    setMessage(`Maison « ${result.home.name} » créée à cette position.`);
    setName(`Maison ${Math.min(homes.length + 2, MAX_HOMES)}`);
  };
  const travel = (home: Home) => {
    if (!teleportToHome(world, home)) {
      setMessage('Cette destination est indisponible.');
      return;
    }
    useGameStore.getState().setTeleportOpen(false);
    close();
  };
  const rename = (event: React.FormEvent, home: Home) => {
    event.preventDefault();
    if (renameHome(worldId, home.id, editName)) {
      setMessage(`Maison renommée « ${editName.trim()} ».`);
      setEditing(null);
    } else {
      setMessage('Choisis un nom valide pour cette maison.');
    }
  };

  return (
    <MenuDialog title="Mes maisons" onClose={close} className="home-panel">
      <div className="home-heading">
        <div><p className="eyebrow">TES REPÈRES</p><h2>Mes maisons</h2></div>
        <span className="home-count" aria-label={`${homes.length} maisons sur ${MAX_HOMES}`}>{homes.length} / {MAX_HOMES}</span>
      </div>
      <form className="home-create-form" onSubmit={create}>
        <label htmlFor="home-name">Nom de la nouvelle maison</label>
        <div className="home-create-row">
          <input id="home-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nom de ta maison" maxLength={32} required autoFocus disabled={homes.length >= MAX_HOMES} />
          <button className="primary-button" type="submit" disabled={homes.length >= MAX_HOMES}>Créer ici</button>
        </div>
      </form>
      {homes.length >= MAX_HOMES && <p className="home-limit">Tu as atteint la limite de 5 maisons. Supprimes-en une pour en créer une autre.</p>}
      {message && <p className="home-message" role="status">{message}</p>}
      <div className="home-list">
        {homes.length === 0 ? <p className="home-empty">Crée ta première maison ici. Tu pourras ensuite t’y téléporter.</p> : homes.map((home) => (
          <article className="home-row" key={home.id}>
            {editing === home.id ? (
              <form className="home-rename-form" onSubmit={(event) => rename(event, home)}>
                <label htmlFor={`rename-${home.id}`}>Nouveau nom
                  <input id={`rename-${home.id}`} value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={32} required autoFocus />
                </label>
                <div className="home-actions">
                  <button className="primary-button" type="submit">Enregistrer</button>
                  <button className="secondary-button" type="button" onClick={() => setEditing(null)}>Annuler</button>
                </div>
              </form>
            ) : (
              <>
                <div className="home-details"><strong>{home.name}</strong><small>X {Math.round(home.x)} · Y {Math.round(home.y)} · Z {Math.round(home.z)}</small></div>
                <div className="home-actions">
                  <button className="primary-button" onClick={() => travel(home)}>Y aller</button>
                  <button className="secondary-button" onClick={() => { setEditing(home.id); setEditName(home.name); }}>Renommer</button>
                  <button className="home-delete-button" onClick={() => {
                    if (!window.confirm(`Supprimer la maison « ${home.name} » ?`)) return;
                    deleteHome(worldId, home.id);
                    setMessage(`Maison « ${home.name} » supprimée.`);
                  }}>Supprimer</button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </MenuDialog>
  );
}
