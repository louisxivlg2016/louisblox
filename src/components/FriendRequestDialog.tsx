import { useEffect, useState } from 'react';
import { acceptFriendRequest, useFriendStore } from '../game/friends';
import { clearInput, requestPlay } from '../game/input';
import { useGameStore } from '../game/store';
import { ProfileAvatar } from './ProfileAvatar';
import { translate } from '../game/language';

export function FriendRequestDialog() {
  const request = useFriendStore((state) => state.requests[0]);
  const removeRequest = useFriendStore((state) => state.removeRequest);
  const addFriend = useFriendStore((state) => state.addFriend);
  const mode = useGameStore((state) => state.mode);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
    if (!request || mode === 'menu') return;
    clearInput();
    if (document.pointerLockElement) document.exitPointerLock();
    useGameStore.getState().setMode('pause');
  }, [request?.requestId, mode]);

  if (!request || mode === 'menu') return null;
  const player = request.from;
  const accept = async () => {
    setPending(true);
    try {
      await acceptFriendRequest(request);
      addFriend(player);
      removeRequest(request.requestId);
      useGameStore.getState().setNotice(translate(`${player.name} est maintenant ton ami.`, `${player.name} is now your friend.`, `${player.name} ahora es tu amigo.`));
      void requestPlay();
    } catch (error) {
      useGameStore.getState().setNotice(error instanceof Error ? error.message : translate('Invitation impossible.', 'Unable to send invitation.', 'No se pudo enviar la invitación.'));
    } finally {
      setPending(false);
    }
  };
  const refuse = () => {
    removeRequest(request.requestId);
    useGameStore.getState().setNotice(translate(`Invitation de ${player.name} refusée.`, `Invitation from ${player.name} declined.`, `Invitación de ${player.name} rechazada.`));
    void requestPlay();
  };

  return (
    <div className="menu-backdrop friend-request-backdrop">
      <section className="menu-panel friend-request-panel" role="dialog" aria-modal="true" aria-labelledby="friend-request-title">
        <p className="eyebrow">{translate('DEMANDE D’AMI', 'FRIEND REQUEST', 'SOLICITUD DE AMISTAD')}</p>
        <ProfileAvatar kind={player.outfit === 'default' ? 'pixel' : player.outfit} character={player.character} outfit={player.outfit} wig={player.wig} appearance={player.appearance} size={76} />
        <h2 id="friend-request-title">{player.name}</h2>
        <p>{translate('veut être ton ami.', 'wants to be your friend.', 'quiere ser tu amigo.')}</p>
        <div className="teleport-request-actions">
          <button className="primary-button" disabled={pending} aria-label={translate(`Accepter ${player.name}`, `Accept ${player.name}`, `Aceptar a ${player.name}`)} onClick={accept}>{pending ? translate('Acceptation…', 'Accepting…', 'Aceptando…') : translate('Accepter', 'Accept')}</button>
          <button className="secondary-button" disabled={pending} aria-label={translate(`Refuser ${player.name}`, `Decline ${player.name}`, `Rechazar a ${player.name}`)} onClick={refuse}>{translate('Refuser', 'Decline')}</button>
        </div>
      </section>
    </div>
  );
}
