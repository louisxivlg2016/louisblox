import { useState } from 'react';
import { WorldStats } from './WorldStats';
import { ProtectionPanel } from './ProtectionPanel';
import { sendTribe, useTribeStore } from '../game/tribes';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { playerIdentity } from '../game/playerIdentity';
import { translate } from '../game/language';
import { LanguagePanel } from './LanguagePanel';
import { setAudioPreference, useAudioSettings } from '../game/audio';

export function SettingsPanel() {
  const audioSettings = useAudioSettings();
  const [name, setName] = useState(translate('Ma tribu', 'My Tribe'));
  const online = useMultiplayerStore((state) => state.status === 'online');
  const tribes = useTribeStore((state) => state.tribes);
  const invitations = useTribeStore((state) => state.invitations);
  const error = useTribeStore((state) => state.error);
  const notice = useTribeStore((state) => state.notice);
  const tribe = tribes.find((candidate) => candidate.members.some((member) => member.playerId === playerIdentity()));
  const manageTribe = () => useTribeStore.getState().setPanelOpen(true);
  return (
    <div className="settings-panel">
      <LanguagePanel />
      <div className="settings-heading">
        <p className="eyebrow">{translate('INFORMATIONS ET COMMANDES', 'INFORMATION AND CONTROLS')}</p>
        <h2>{translate('Réglages', 'Settings')}</h2>
        <p>{translate('Retrouve ici les informations du monde et les touches de jeu.', 'Find world information and game controls here.')}</p>
      </div>
      <WorldStats />
      <section className="settings-tribe" aria-label={translate('Audio', 'Audio', 'Audio')}>
        <h3>{translate('Audio', 'Audio', 'Audio')}</h3>
        <label className="protection-option"><input type="checkbox" checked={audioSettings.music} onChange={(event) => setAudioPreference('music', event.target.checked)} /> {translate('Musique et radio', 'Music and radio', 'Música y radio')}</label>
        <label className="protection-option"><input type="checkbox" checked={audioSettings.sounds} onChange={(event) => setAudioPreference('sounds', event.target.checked)} /> {translate('Bruits du jeu et des véhicules', 'Game and vehicle sounds', 'Sonidos del juego y de los vehículos')}</label>
      </section>
      <section className="settings-tribe" aria-label={translate('Ma tribu', 'My Tribe')}>
        <h3>{translate('Tribu', 'Tribe')}</h3>
        {tribe ? <><p>{translate('Tu es dans la tribu', 'You are in tribe', 'Estás en la tribu')} <strong>{tribe.name}</strong>.</p><button type="button" className="secondary-button" onClick={manageTribe}>{translate('Gérer ma tribu', 'Manage my tribe')}</button></> : (
          <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) sendTribe('tribe-create', { name }); }}>
            <label htmlFor="settings-tribe-name">{translate('Nom de ta tribu', 'Your tribe name')}</label>
            <input id="settings-tribe-name" aria-label={translate('Nom de la tribu', 'Tribe name')} value={name} onChange={(event) => setName(event.target.value)} maxLength={24} required />
            <button type="submit" className="primary-button" disabled={!online || !name.trim()}>{translate('Créer ma tribu', 'Create my tribe')}</button>
          </form>
        )}
        {!online && <p>{translate('La création nécessite une connexion à un salon multijoueur.', 'Creating a tribe requires a multiplayer room connection.')}</p>}
        {invitations.length > 0 && <button type="button" className="secondary-button" onClick={manageTribe}>{translate(`Voir les invitations (${invitations.length})`, `View invitations (${invitations.length})`, `Ver invitaciones (${invitations.length})`)}</button>}
        {notice && <p role="status">{notice}</p>}
        {error && <p className="multiplayer-error" role="alert">{error}</p>}
      </section>
      <ProtectionPanel />
      <div className="controls-hint">
        <span><strong>{translate('WASD / FLÈCHES', 'WASD / ARROWS')}</strong> {translate('marcher / conduire', 'move / drive', 'mover / conducir')}</span>
        <span><strong>{translate('ESPACE', 'SPACE', 'ESPACIO')}</strong> {translate('sauter / monter / voler', 'jump / ascend / fly', 'saltar / ascender / volar')}</span>
        <span><strong>2× {translate('ESPACE', 'SPACE', 'ESPACIO')}</strong> {translate('activer / arrêter le vol', 'enable / stop flying', 'activar / detener el vuelo')}</span>
        <span><strong>{translate('MAJ', 'SHIFT', 'MAYÚS')}</strong> {translate('courir', 'sprint', 'correr')}</span>
        <span><strong>C</strong> {translate('plonger / descendre', 'dive / descend', 'bucear / descender')}</span>
        <span><strong>B</strong> {translate('boutique', 'shop', 'tienda')}</span>
        <span><strong>P / F5</strong> {translate('changer de caméra', 'change camera', 'cambiar de cámara')}</span>
      </div>
    </div>
  );
}
