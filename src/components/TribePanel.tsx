import { useState } from 'react';
import { requestPlay } from '../game/input';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { playerIdentity } from '../game/playerIdentity';
import { dismissTribeInvitation, sendTribe, useTribeStore } from '../game/tribes';

export function TribePanel() {
  const open = useTribeStore((state) => state.panelOpen);
  const tribes = useTribeStore((state) => state.tribes);
  const invitations = useTribeStore((state) => state.invitations);
  const error = useTribeStore((state) => state.error);
  const notice = useTribeStore((state) => state.notice);
  const players = useMultiplayerStore((state) => state.players);
  const online = useMultiplayerStore((state) => state.status === 'online');
  const selfId = playerIdentity();
  const tribe = tribes.find((candidate) => candidate.members.some((member) => member.playerId === selfId));
  const [name, setName] = useState('Ma tribu');
  if (!open) return null;

  const close = () => {
    useTribeStore.getState().setPanelOpen(false);
    void requestPlay();
  };
  const answer = (tribeId: string, accepted: boolean) => {
    if (sendTribe(accepted ? 'tribe-accept' : 'tribe-decline', { tribeId })) dismissTribeInvitation(tribeId);
  };

  return (
    <div className="menu-backdrop tribe-backdrop">
      <section className="menu-panel tribe-panel" role="dialog" aria-modal="true" aria-label="Ma tribu">
        <div className="tribe-heading"><h2>{tribe ? tribe.name : 'Ma tribu'}</h2><button type="button" className="tribe-close" onClick={close} aria-label="Fermer la tribu">Fermer ×</button></div>
        {!online && <p>Connexion au salon en cours…</p>}
        {invitations.length > 0 && <section className="tribe-invitations"><h3>Invitations</h3>{invitations.map((invitation) => (
          <div className="tribe-invitation" key={invitation.id}>
            <p><strong>{invitation.name}</strong><small>{invitation.ownerName} t’invite à rejoindre cette tribu.</small></p>
            <div className="tribe-invitation-actions"><button type="button" className="primary-button" aria-label={`Rejoindre la tribu ${invitation.name}`} onClick={() => answer(invitation.id, true)}>Rejoindre</button><button type="button" className="secondary-button" aria-label={`Refuser la tribu ${invitation.name}`} onClick={() => answer(invitation.id, false)}>Refuser</button></div>
          </div>
        ))}</section>}
        {tribe ? (
          <>
            <p>{tribe.members.length} membre{tribe.members.length > 1 ? 's' : ''}{tribe.ownerId === selfId ? ' · Tu es le chef' : ''}</p>
            <ul className="tribe-members" aria-label="Membres de la tribu">{tribe.members.map((member) => <li key={member.playerId} data-player-id={member.playerId}><strong>{member.name}{member.playerId === selfId ? ' (toi)' : ''}</strong><small>{member.playerId === tribe.ownerId ? 'Chef · ' : ''}{players.some((player) => player.playerId === member.playerId) ? 'En ligne' : 'Hors ligne'}</small></li>)}</ul>
            {tribe.ownerId === selfId && <section className="tribe-invite-list"><h3>Inviter un joueur du salon</h3>{players.filter((player) => !player.self).length === 0 ? <p>Un autre joueur doit être connecté dans ce salon.</p> : players.filter((player) => !player.self).map((player) => {
              const alreadyMember = tribes.some((candidate) => candidate.members.some((member) => member.playerId === player.playerId));
              return <button type="button" key={player.playerId} aria-label={`Inviter ${player.name} dans la tribu`} disabled={!online || alreadyMember} onClick={() => sendTribe('tribe-invite', { targetId: player.playerId })}>{alreadyMember ? `${player.name} a déjà une tribu` : `Inviter ${player.name}`}</button>;
            })}</section>}
            <button type="button" className="secondary-button tribe-leave" onClick={() => sendTribe('tribe-leave')}>{tribe.ownerId === selfId ? 'Dissoudre la tribu' : 'Quitter la tribu'}</button>
          </>
        ) : (
          <form className="tribe-create-form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) sendTribe('tribe-create', { name }); }}>
            <label htmlFor="tribe-name">Nom de ta tribu<input id="tribe-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={24} required /></label>
            <button className="primary-button" type="submit" disabled={!online || !name.trim()}>Créer ma tribu</button>
          </form>
        )}
        {notice && <p className="tribe-notice" role="status">{notice}</p>}
        {error && <p className="multiplayer-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
