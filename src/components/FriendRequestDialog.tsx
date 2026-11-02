import { useEffect, useState } from 'react';
import { acceptFriendRequest, useFriendStore } from '../game/friends';
import { clearInput, requestPlay } from '../game/input';
import { useGameStore } from '../game/store';
import { ProfileAvatar } from './ProfileAvatar';

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
      useGameStore.getState().setNotice(`${player.name} est maintenant ton ami.`);
      void requestPlay();
    } catch (error) {
      useGameStore.getState().setNotice(error instanceof Error ? error.message : 'Invitation impossible.');
    } finally {
      setPending(false);
    }
  };
  const refuse = () => {
    removeRequest(request.requestId);
    useGameStore.getState().setNotice(`Invitation de ${player.name} refusée.`);
    void requestPlay();
  };

  return (
    <div className="menu-backdrop friend-request-backdrop">
      <section className="menu-panel friend-request-panel" role="dialog" aria-modal="true" aria-labelledby="friend-request-title">
        <p className="eyebrow">DEMANDE D’AMI</p>
        <ProfileAvatar kind={player.outfit === 'default' ? 'pixel' : player.outfit} character={player.character} outfit={player.outfit} wig={player.wig} appearance={player.appearance} size={76} />
        <h2 id="friend-request-title">{player.name}</h2>
        <p>souhaite devenir ton ami.</p>
        <div className="teleport-request-actions">
          <button className="primary-button" disabled={pending} aria-label={`Accepter ${player.name}`} onClick={accept}>{pending ? 'Acceptation…' : 'Accepter'}</button>
          <button className="secondary-button" disabled={pending} aria-label={`Refuser ${player.name}`} onClick={refuse}>Refuser</button>
        </div>
      </section>
    </div>
  );
}
