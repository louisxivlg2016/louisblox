import { useState } from 'react';
import { WorldStats } from './WorldStats';
import { ProtectionPanel } from './ProtectionPanel';
import { sendTribe, useTribeStore } from '../game/tribes';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { playerIdentity } from '../game/playerIdentity';

export function SettingsPanel() {
  const [name, setName] = useState('Ma tribu');
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
        <p className="eyebrow">INFORMATIONS ET COMMANDES</p>
        <h2>Réglages</h2>
        <p>Retrouve ici les informations du monde et les touches de jeu.</p>
      </div>
      <WorldStats />
      <section className="settings-tribe" aria-label="Ma tribu">
        <h3>Tribu</h3>
        {tribe ? <><p>Tu es dans la tribu <strong>{tribe.name}</strong>.</p><button type="button" className="secondary-button" onClick={manageTribe}>Gérer ma tribu</button></> : (
          <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) sendTribe('tribe-create', { name }); }}>
            <label htmlFor="settings-tribe-name">Nom de ta tribu</label>
            <input id="settings-tribe-name" aria-label="Nom de la tribu" value={name} onChange={(event) => setName(event.target.value)} maxLength={24} required />
            <button type="submit" className="primary-button" disabled={!online || !name.trim()}>Créer ma tribu</button>
          </form>
        )}
        {!online && <p>La création nécessite une connexion à un salon multijoueur.</p>}
        {invitations.length > 0 && <button type="button" className="secondary-button" onClick={manageTribe}>Voir les invitations ({invitations.length})</button>}
        {notice && <p role="status">{notice}</p>}
        {error && <p className="multiplayer-error" role="alert">{error}</p>}
      </section>
      <ProtectionPanel />
      <div className="controls-hint">
        <span><strong>WASD / FLÈCHES</strong> se déplacer / conduire</span>
        <span><strong>ESPACE</strong> sauter / remonter / voler</span>
        <span><strong>2× ESPACE</strong> activer / quitter le vol</span>
        <span><strong>MAJ</strong> accélérer</span>
        <span><strong>C</strong> plonger / descendre</span>
        <span><strong>B</strong> boutique</span>
        <span><strong>P / F5</strong> changer de caméra</span>
      </div>
    </div>
  );
}
