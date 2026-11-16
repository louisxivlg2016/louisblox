import { useState } from 'react';
import { requestPlay } from '../game/input';
import { useMultiplayerStore, useRemotePlayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { playerIdentity } from '../game/playerIdentity';
import { dismissTribeInvitation, sendTribe, useTribeStore } from '../game/tribes';
import { translate } from '../game/language';

export function TribePanel() {
  const open = useTribeStore((state) => state.panelOpen);
  const tribes = useTribeStore((state) => state.tribes);
  const invitations = useTribeStore((state) => state.invitations);
  const error = useTribeStore((state) => state.error);
  const notice = useTribeStore((state) => state.notice);
  const players = useMultiplayerStore((state) => state.players);
  const remotePlayers = useRemotePlayerStore((state) => state.players);
  const coordinates = useGameStore((state) => state.coordinates);
  const online = useMultiplayerStore((state) => state.status === 'online');
  const selfId = playerIdentity();
  const tribe = tribes.find((candidate) => candidate.members.some((member) => member.playerId === selfId));
  const [name, setName] = useState(translate('Ma tribu', 'My Tribe'));
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
      <section className="menu-panel tribe-panel" role="dialog" aria-modal="true" aria-label={translate('Ma tribu', 'My Tribe')}>
        <div className="tribe-heading"><h2>{tribe ? tribe.name : translate('Ma tribu', 'My Tribe')}</h2><button type="button" className="tribe-close" onClick={close} aria-label={translate('Fermer la tribu', 'Close tribe')}>{translate('Fermer ×', 'Close ×')}</button></div>
        {!online && <p>{translate('Connexion au salon en cours…', 'Connecting to room…')}</p>}
        {invitations.length > 0 && <section className="tribe-invitations"><h3>{translate('Invitations', 'Invitations', 'Invitaciones')}</h3>{invitations.map((invitation) => (
          <div className="tribe-invitation" key={invitation.id}>
            <p><strong>{invitation.name}</strong><small>{invitation.ownerName} invites you to join this tribe.</small></p>
            <div className="tribe-invitation-actions"><button type="button" className="primary-button" aria-label={`Join tribe ${invitation.name}`} onClick={() => answer(invitation.id, true)}>{translate('Rejoindre', 'Join')}</button><button type="button" className="secondary-button" aria-label={`Decline tribe ${invitation.name}`} onClick={() => answer(invitation.id, false)}>{translate('Refuser', 'Decline')}</button></div>
          </div>
        ))}</section>}
        {tribe ? (
          <>
            <p>{tribe.members.length} member{tribe.members.length > 1 ? 's' : ''}{tribe.ownerId === selfId ? ' · You are the leader' : ''}</p>
            <ul className="tribe-members" aria-label={translate('Membres de la tribu', 'Tribe members')}>{tribe.members.map((member) => <li key={member.playerId} data-player-id={member.playerId}><strong>{member.name}{member.playerId === selfId ? translate(' (toi)', ' (you)', ' (tú)') : ''}</strong><small>{member.playerId === tribe.ownerId ? translate('Chef · ', 'Leader · ', 'Líder · ') : ''}{players.some((player) => player.playerId === member.playerId) ? translate('En ligne', 'Online') : translate('Hors ligne', 'Offline')}</small></li>)}</ul>
            <section className="tribe-home">
              <h3>{translate('Maison de la tribu', 'Tribe home')}</h3>
              {tribe.home ? <>
                <p>{translate('Maison partagée', 'Shared home')} · X {Math.round(tribe.home.x)} · Y {Math.round(tribe.home.y)} · Z {Math.round(tribe.home.z)}</p>
                <button type="button" className="primary-button" disabled={!online} onClick={() => { if (sendTribe('tribe-home-teleport')) close(); }}>{translate('Se téléporter à la maison', 'Teleport home')}</button>
              </> : tribe.ownerId === selfId ? <>
                <p>{translate('Construis une maison avec un lit à ta position. Tous les membres y apparaîtront.', 'Build a home with a bed at your position. Every member will spawn there.')}</p>
                <button type="button" className="primary-button" disabled={!online} onClick={() => { if (sendTribe('tribe-home-create')) close(); }}>{translate('Créer la maison ici', 'Create home here')}</button>
              </> : <p>{translate('Le chef de la tribu n’a pas encore construit la maison partagée.', 'The tribe leader has not built the shared home yet.')}</p>}
            </section>
            {tribe.ownerId === selfId && <section className="tribe-invite-list"><h3>{translate('Inviter un joueur du salon', 'Invite a player from the room')}</h3>{players.filter((player) => !player.self).length === 0 ? <p>{translate('Un autre joueur doit être connecté dans ce salon.', 'Another player must be connected to this room.')}</p> : players.filter((player) => !player.self).map((player) => {
              const alreadyMember = tribes.some((candidate) => candidate.members.some((member) => member.playerId === player.playerId));
              const remote = remotePlayers[player.playerId];
              const distance = remote ? Math.round(Math.hypot(coordinates.x - remote.x, coordinates.z - remote.z)) : null;
              return <button type="button" key={player.playerId} aria-label={`Invite ${player.name} to the tribe`} disabled={!online || alreadyMember} onClick={() => sendTribe('tribe-invite', { targetId: player.playerId })}><span>{alreadyMember ? `${player.name} already has a tribe` : `Invite ${player.name}`}</span><small>{distance === null ? alreadyMember ? translate('Membre d’une tribu', 'Member of a tribe') : translate('En ligne', 'Online') : `${distance} m`}</small></button>;
            })}</section>}
            <button type="button" className="secondary-button tribe-leave" onClick={() => sendTribe('tribe-leave')}>{tribe.ownerId === selfId ? translate('Dissoudre la tribu', 'Disband tribe') : translate('Quitter la tribu', 'Leave tribe')}</button>
          </>
        ) : (
          <form className="tribe-create-form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) sendTribe('tribe-create', { name }); }}>
            <label htmlFor="tribe-name">{translate('Nom de ta tribu', 'Your tribe name')}<input id="tribe-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={24} required /></label>
            <button className="primary-button" type="submit" disabled={!online || !name.trim()}>{translate('Créer ma tribu', 'Create my tribe')}</button>
          </form>
        )}
        {notice && <p className="tribe-notice" role="status">{notice}</p>}
        {error && <p className="multiplayer-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
