import { useState } from 'react';
import { WorldStats } from './WorldStats';
import { ProtectionPanel } from './ProtectionPanel';
import { sendTribe, useTribeStore } from '../game/tribes';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { playerIdentity } from '../game/playerIdentity';
import { usePlaneTitleStore } from '../game/planeTitle';
import { translate } from '../game/language';

export function SettingsPanel() {
  const [name, setName] = useState(translate('Ma tribu', 'My Tribe'));
  const planeTitle = usePlaneTitleStore((state) => state.title);
  const setPlaneTitle = usePlaneTitleStore((state) => state.setTitle);
  const online = useMultiplayerStore((state) => state.status === 'online');
  const tribes = useTribeStore((state) => state.tribes);
  const invitations = useTribeStore((state) => state.invitations);
  const error = useTribeStore((state) => state.error);
  const notice = useTribeStore((state) => state.notice);
  const tribe = tribes.find((candidate) => candidate.members.some((member) => member.playerId === playerIdentity()));
  const manageTribe = () => useTribeStore.getState().setPanelOpen(true);
  return (
    <div className="settings-panel">
      <div className="settings-heading">
        <p className="eyebrow">{translate('INFORMATIONS ET COMMANDES', 'INFORMATION AND CONTROLS')}</p>
        <h2>{translate('Réglages', 'Settings')}</h2>
        <p>{translate('Retrouve ici les informations du monde et les touches de jeu.', 'Find world information and game controls here.')}</p>
      </div>
      <WorldStats />
      <section className="settings-tribe" aria-label={translate('Titre de l’avion', 'Airplane Title')}>
        <h3>{translate('Titre de l’avion', 'Airplane Title')}</h3>
        <label htmlFor="plane-title">{translate('Texte doré sur la carlingue', 'Gold text on the fuselage')}</label>
        <input id="plane-title" aria-label={translate('Titre de l’avion', 'Airplane Title')} value={planeTitle} onChange={(event) => setPlaneTitle(event.target.value)} maxLength={24} />
      </section>
      <section className="settings-tribe" aria-label={translate('Ma tribu', 'My Tribe')}>
        <h3>{translate('Tribu', 'Tribe')}</h3>
        {tribe ? <><p>You are in tribe <strong>{tribe.name}</strong>.</p><button type="button" className="secondary-button" onClick={manageTribe}>{translate('Gérer ma tribu', 'Manage my tribe')}</button></> : (
          <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) sendTribe('tribe-create', { name }); }}>
            <label htmlFor="settings-tribe-name">{translate('Nom de ta tribu', 'Your tribe name')}</label>
            <input id="settings-tribe-name" aria-label={translate('Nom de la tribu', 'Tribe name')} value={name} onChange={(event) => setName(event.target.value)} maxLength={24} required />
            <button type="submit" className="primary-button" disabled={!online || !name.trim()}>{translate('Créer ma tribu', 'Create my tribe')}</button>
          </form>
        )}
        {!online && <p>{translate('La création nécessite une connexion à un salon multijoueur.', 'Creating a tribe requires a multiplayer room connection.')}</p>}
        {invitations.length > 0 && <button type="button" className="secondary-button" onClick={manageTribe}>View invitations ({invitations.length})</button>}
        {notice && <p role="status">{notice}</p>}
        {error && <p className="multiplayer-error" role="alert">{error}</p>}
      </section>
      <ProtectionPanel />
      <div className="controls-hint">
        <span><strong>{translate('WASD / FLÈCHES', 'WASD / ARROWS')}</strong> move / drive</span>
        <span><strong>ESPACE</strong> jump / ascend / fly</span>
        <span><strong>2× ESPACE</strong> enable / stop flying</span>
        <span><strong>MAJ</strong> sprint</span>
        <span><strong>C</strong> dive / descend</span>
        <span><strong>B</strong> shop</span>
        <span><strong>P / F5</strong> change camera</span>
      </div>
    </div>
  );
}
