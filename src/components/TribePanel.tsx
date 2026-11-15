import { useState } from 'react';
import { requestPlay } from '../game/input';
import { useMultiplayerStore, useRemotePlayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { playerIdentity } from '../game/playerIdentity';
import { dismissTribeInvitation, sendTribe, useTribeStore } from '../game/tribes';

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
  const [name, setName] = useState('My Tribe');
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
      <section className="menu-panel tribe-panel" role="dialog" aria-modal="true" aria-label="My Tribe">
        <div className="tribe-heading"><h2>{tribe ? tribe.name : 'My Tribe'}</h2><button type="button" className="tribe-close" onClick={close} aria-label="Close tribe">Close ×</button></div>
        {!online && <p>Connecting to room…</p>}
        {invitations.length > 0 && <section className="tribe-invitations"><h3>Invitations</h3>{invitations.map((invitation) => (
          <div className="tribe-invitation" key={invitation.id}>
            <p><strong>{invitation.name}</strong><small>{invitation.ownerName} invites you to join this tribe.</small></p>
            <div className="tribe-invitation-actions"><button type="button" className="primary-button" aria-label={`Join tribe ${invitation.name}`} onClick={() => answer(invitation.id, true)}>Join</button><button type="button" className="secondary-button" aria-label={`Decline tribe ${invitation.name}`} onClick={() => answer(invitation.id, false)}>Decline</button></div>
          </div>
        ))}</section>}
        {tribe ? (
          <>
            <p>{tribe.members.length} member{tribe.members.length > 1 ? 's' : ''}{tribe.ownerId === selfId ? ' · You are the leader' : ''}</p>
            <ul className="tribe-members" aria-label="Tribe members">{tribe.members.map((member) => <li key={member.playerId} data-player-id={member.playerId}><strong>{member.name}{member.playerId === selfId ? ' (you)' : ''}</strong><small>{member.playerId === tribe.ownerId ? 'Leader · ' : ''}{players.some((player) => player.playerId === member.playerId) ? 'Online' : 'Offline'}</small></li>)}</ul>
            <section className="tribe-home">
              <h3>Tribe home</h3>
              {tribe.home ? <>
                <p>Shared home · X {Math.round(tribe.home.x)} · Y {Math.round(tribe.home.y)} · Z {Math.round(tribe.home.z)}</p>
                <button type="button" className="primary-button" disabled={!online} onClick={() => { if (sendTribe('tribe-home-teleport')) close(); }}>Teleport home</button>
              </> : tribe.ownerId === selfId ? <>
                <p>Build a home with a bed at your position. Every member will spawn there.</p>
                <button type="button" className="primary-button" disabled={!online} onClick={() => { if (sendTribe('tribe-home-create')) close(); }}>Create home here</button>
              </> : <p>The tribe leader has not built the shared home yet.</p>}
            </section>
            {tribe.ownerId === selfId && <section className="tribe-invite-list"><h3>Invite a player from the room</h3>{players.filter((player) => !player.self).length === 0 ? <p>Another player must be connected to this room.</p> : players.filter((player) => !player.self).map((player) => {
              const alreadyMember = tribes.some((candidate) => candidate.members.some((member) => member.playerId === player.playerId));
              const remote = remotePlayers[player.playerId];
              const distance = remote ? Math.round(Math.hypot(coordinates.x - remote.x, coordinates.z - remote.z)) : null;
              return <button type="button" key={player.playerId} aria-label={`Invite ${player.name} to the tribe`} disabled={!online || alreadyMember} onClick={() => sendTribe('tribe-invite', { targetId: player.playerId })}><span>{alreadyMember ? `${player.name} already has a tribe` : `Invite ${player.name}`}</span><small>{distance === null ? alreadyMember ? 'Member of a tribe' : 'Online' : `${distance} m`}</small></button>;
            })}</section>}
            <button type="button" className="secondary-button tribe-leave" onClick={() => sendTribe('tribe-leave')}>{tribe.ownerId === selfId ? 'Disband tribe' : 'Leave tribe'}</button>
          </>
        ) : (
          <form className="tribe-create-form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) sendTribe('tribe-create', { name }); }}>
            <label htmlFor="tribe-name">Your tribe name<input id="tribe-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={24} required /></label>
            <button className="primary-button" type="submit" disabled={!online || !name.trim()}>Create my tribe</button>
          </form>
        )}
        {notice && <p className="tribe-notice" role="status">{notice}</p>}
        {error && <p className="multiplayer-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
