import { useState } from 'react';
import { WorldStats } from './WorldStats';
import { ProtectionPanel } from './ProtectionPanel';
import { sendTribe, useTribeStore } from '../game/tribes';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { playerIdentity } from '../game/playerIdentity';
import { usePlaneTitleStore } from '../game/planeTitle';

export function SettingsPanel() {
  const [name, setName] = useState('My Tribe');
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
        <p className="eyebrow">INFORMATION AND CONTROLS</p>
        <h2>Settings</h2>
        <p>Find world information and game controls here.</p>
      </div>
      <WorldStats />
      <section className="settings-tribe" aria-label="Airplane Title">
        <h3>Airplane Title</h3>
        <label htmlFor="plane-title">Gold text on the fuselage</label>
        <input id="plane-title" aria-label="Airplane Title" value={planeTitle} onChange={(event) => setPlaneTitle(event.target.value)} maxLength={24} />
      </section>
      <section className="settings-tribe" aria-label="My Tribe">
        <h3>Tribe</h3>
        {tribe ? <><p>You are in tribe <strong>{tribe.name}</strong>.</p><button type="button" className="secondary-button" onClick={manageTribe}>Manage my tribe</button></> : (
          <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) sendTribe('tribe-create', { name }); }}>
            <label htmlFor="settings-tribe-name">Your tribe name</label>
            <input id="settings-tribe-name" aria-label="Tribe name" value={name} onChange={(event) => setName(event.target.value)} maxLength={24} required />
            <button type="submit" className="primary-button" disabled={!online || !name.trim()}>Create my tribe</button>
          </form>
        )}
        {!online && <p>Creating a tribe requires a multiplayer room connection.</p>}
        {invitations.length > 0 && <button type="button" className="secondary-button" onClick={manageTribe}>View invitations ({invitations.length})</button>}
        {notice && <p role="status">{notice}</p>}
        {error && <p className="multiplayer-error" role="alert">{error}</p>}
      </section>
      <ProtectionPanel />
      <div className="controls-hint">
        <span><strong>WASD / ARROWS</strong> move / drive</span>
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
