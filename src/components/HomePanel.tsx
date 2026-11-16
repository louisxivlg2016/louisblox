import { useEffect, useState } from 'react';
import { MenuDialog } from './MenuDialog';
import { MAX_HOMES, NO_HOMES, useHomeStore } from '../game/homes';
import type { Home } from '../game/homes';
import { useGameStore } from '../game/store';
import { Player, PlayerPosition, PlayerState } from '../game/traits';
import { world } from '../game/world';
import { teleportToHome } from '../game/teleport';
import { requestPlay } from '../game/input';
import { translate } from '../game/language';

export function HomePanel() {
  const open = useHomeStore((state) => state.open);
  const setOpen = useHomeStore((state) => state.setOpen);
  const createHome = useHomeStore((state) => state.createHome);
  const renameHome = useHomeStore((state) => state.renameHome);
  const deleteHome = useHomeStore((state) => state.deleteHome);
  const worldId = useGameStore((state) => state.worldId);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
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

  if (!open || gameplayMode === 'pirates') return null;

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
      setMessage(translate('Impossible de trouver ta position actuelle.', 'Unable to find your current position.'));
      return;
    }
    const result = createHome(worldId, name, { x: position.x, y: position.y, z: position.z, yaw: state.yaw, pitch: state.pitch });
    if (!result.home) {
      setMessage(result.error);
      return;
    }
    setMessage(translate(`Maison « ${result.home.name} » créée à cette position.`, `Home “${result.home.name}” created at this position.`));
    setName(`Maison ${Math.min(homes.length + 2, MAX_HOMES)}`);
  };
  const travel = (home: Home) => {
    if (!teleportToHome(world, home)) {
      setMessage(translate('Cette destination est indisponible.', 'This destination is unavailable.'));
      return;
    }
    useGameStore.getState().setTeleportOpen(false);
    close();
  };
  const rename = (event: React.FormEvent, home: Home) => {
    event.preventDefault();
    if (renameHome(worldId, home.id, editName)) {
      setMessage(translate(`Maison renommée « ${editName.trim()} ».`, `Home renamed “${editName.trim()}”.`));
      setEditing(null);
    } else {
      setMessage(translate('Choisis un nom valide pour cette maison.', 'Choose a valid name for this home.'));
    }
  };

  return (
    <MenuDialog title={translate('Mes maisons', 'My Homes')} onClose={close} className="home-panel">
      <div className="home-heading">
        <div><p className="eyebrow">{translate('TES REPÈRES', 'YOUR LANDMARKS')}</p><h2>{translate('Mes maisons', 'My Homes')}</h2></div>
        <span className="home-count" aria-label={`${homes.length} homes out of ${MAX_HOMES}`}>{homes.length} / {MAX_HOMES}</span>
      </div>
      <form className="home-create-form" onSubmit={create}>
        <label htmlFor="home-name">{translate('Nom de la nouvelle maison', 'New home name')}</label>
        <div className="home-create-row">
          <input id="home-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={translate('Nom de ta maison', 'Your home name')} maxLength={32} required autoFocus disabled={homes.length >= MAX_HOMES} />
          <button
            className="primary-button"
            type="submit"
            disabled={homes.length >= MAX_HOMES}
            onPointerDown={(event) => {
              if (event.pointerType === 'mouse') return;
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.form?.requestSubmit();
            }}
            onClick={(event) => {
              if (event.detail > 0 && event.nativeEvent instanceof PointerEvent && event.nativeEvent.pointerType !== 'mouse') event.preventDefault();
            }}
          >{translate('Créer ici', 'Create here')}</button>
        </div>
      </form>
      {homes.length >= MAX_HOMES && <p className="home-limit">{translate('Tu as atteint la limite de 5 maisons. Supprimes-en une pour en créer une autre.', 'You reached the 5-home limit. Delete one to create another.')}</p>}
      {message && <p className="home-message" role="status">{message}</p>}
      <div className="home-list">
        {homes.length === 0 ? <p className="home-empty">{translate('Crée ta première maison ici. Tu pourras ensuite t’y téléporter.', 'Create your first home here. You can teleport to it later.')}</p> : homes.map((home) => (
          <article className="home-row" key={home.id}>
            {editing === home.id ? (
              <form className="home-rename-form" onSubmit={(event) => rename(event, home)}>
                <label htmlFor={`rename-${home.id}`}>New name
                  <input id={`rename-${home.id}`} value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={32} required autoFocus />
                </label>
                <div className="home-actions">
                  <button className="primary-button" type="submit">{translate('Enregistrer', 'Save')}</button>
                  <button className="secondary-button" type="button" onClick={() => setEditing(null)}>{translate('Annuler', 'Cancel')}</button>
                </div>
              </form>
            ) : (
              <>
                <div className="home-details"><strong>{home.name}</strong><small>X {Math.round(home.x)} · Y {Math.round(home.y)} · Z {Math.round(home.z)}</small></div>
                <div className="home-actions">
                  <button className="primary-button" onClick={() => travel(home)}>{translate('Y aller', 'Go')}</button>
                  <button className="secondary-button" onClick={() => { setEditing(home.id); setEditName(home.name); }}>{translate('Renommer', 'Rename')}</button>
                  <button className="home-delete-button" onClick={() => {
                    if (!window.confirm(translate(`Supprimer la maison « ${home.name} » ?`, `Delete home “${home.name}”?`))) return;
                    deleteHome(worldId, home.id);
                    setMessage(translate(`Maison « ${home.name} » supprimée.`, `Home “${home.name}” deleted.`));
                  }}>{translate('Supprimer', 'Delete')}</button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </MenuDialog>
  );
}
