import { useEffect, useState } from 'react';
import { useCharacterStore } from '../game/characterStore';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { acceptFriendRequest, listOnlinePlayers, sendFriendRequest, useFriendStore } from '../game/friends';
import type { FriendPlayer, FriendRequest } from '../game/friends';
import { PixelAvatar } from './PixelAvatar';

function PlayerRow({ player, action, online = true }: { player: FriendPlayer; action?: React.ReactNode; online?: boolean }) {
  return (
    <div className="friend-row">
      <PixelAvatar character={player.character} outfit={player.outfit} wig={player.wig} appearance={player.appearance} size={42} />
      <span className="friend-info"><strong>{player.name}</strong><small>{online ? 'En ligne' : 'Hors ligne'} · {player.room}</small></span>
      {action}
    </div>
  );
}

export function FriendsPanel() {
  const playerName = useMultiplayerStore((state) => state.playerName);
  const status = useMultiplayerStore((state) => state.status);
  const server = useMultiplayerStore((state) => state.server);
  const players = useMultiplayerStore((state) => state.players);
  const configure = useMultiplayerStore((state) => state.configure);
  const setPlayerName = useMultiplayerStore((state) => state.setPlayerName);
  const character = useCharacterStore((state) => state.character);
  const outfit = useCharacterStore((state) => state.outfit);
  const wig = useCharacterStore((state) => state.wig);
  const appearance = useCharacterStore((state) => state.appearance);
  const onlinePlayers = useFriendStore((state) => state.onlinePlayers);
  const friends = useFriendStore((state) => state.friends);
  const requests = useFriendStore((state) => state.requests);
  const setOnlinePlayers = useFriendStore((state) => state.setOnlinePlayers);
  const addFriend = useFriendStore((state) => state.addFriend);
  const removeRequest = useFriendStore((state) => state.removeRequest);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(playerName);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<string[]>([]);
  const selfId = players.find((player) => player.self)?.playerId;

  useEffect(() => setName(playerName), [playerName]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const directory = await listOnlinePlayers();
        if (active) setOnlinePlayers(directory);
      } catch {
        if (active) setMessage('Annuaire indisponible pour le moment.');
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [setOnlinePlayers]);

  const propose = async (player: FriendPlayer) => {
    try {
      await sendFriendRequest(player);
      setPending((current) => [...current, player.playerId]);
      setMessage(`Invitation envoyée à ${player.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invitation impossible.');
    }
  };
  const accept = async (request: FriendRequest) => {
    try {
      await acceptFriendRequest(request);
      addFriend(request.from);
      removeRequest(request.requestId);
      configure({ playerName, room: request.from.room, server });
      const url = new URL(window.location.href);
      url.searchParams.set('room', request.from.room);
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      setMessage(`${request.from.name} est maintenant ton ami.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invitation impossible.');
    }
  };
  const online = new Map(onlinePlayers.map((player) => [player.playerId, player]));
  const savedFriends = friends.map((friend) => online.get(friend.playerId) ? { player: online.get(friend.playerId)!, online: true } : { player: friend, online: false });
  const filteredPlayers = onlinePlayers.filter((player) => player.playerId !== selfId && player.name.toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <div className="friends-panel">
      <div className="profile-card">
        <button className="profile-avatar-button" onClick={() => setEditing((value) => !value)} aria-label="Modifier mon pseudo">
          <PixelAvatar character={character} outfit={outfit} wig={wig} appearance={appearance} size={58} />
        </button>
        {editing ? (
          <form className="profile-name-form" onSubmit={(event) => { event.preventDefault(); setPlayerName(name); setEditing(false); }}>
            <input aria-label="Mon pseudo" value={name} maxLength={24} onChange={(event) => setName(event.target.value)} autoFocus />
            <button type="submit">OK</button>
          </form>
        ) : (
          <button className="profile-name" onClick={() => setEditing(true)}><strong>{playerName}</strong><small>{status === 'online' ? 'En ligne' : 'Modifier mon pseudo'}</small></button>
        )}
      </div>

      {requests.length > 0 && (
        <div className="friend-requests">
          <h3>Invitations</h3>
          {requests.map((request) => (
            <div className="friend-request" key={request.requestId}>
              <PlayerRow player={request.from} />
              <div><button onClick={() => accept(request)}>Rejoindre</button><button onClick={() => removeRequest(request.requestId)}>Ignorer</button></div>
            </div>
          ))}
        </div>
      )}

      <div className="friends-heading"><h3>Amis <span>{friends.length}</span></h3><span className="online-dot" /></div>
      <div className="friends-list">
        {savedFriends.map(({ player, online: isOnline }) => <PlayerRow key={player.playerId} player={player} online={isOnline} />)}
        {savedFriends.length === 0 && <p className="friends-empty">Propose des amis parmi les joueurs en ligne.</p>}
      </div>
      <div className="friends-heading"><h3>Tous les joueurs <span>{filteredPlayers.length}</span></h3></div>
      <input className="friends-search" type="search" aria-label="Rechercher un joueur" placeholder="Rechercher…" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="friends-list directory-list">
        {filteredPlayers.map((player) => (
          <PlayerRow key={player.playerId} player={player} action={friends.some((friend) => friend.playerId === player.playerId)
            ? <span className="friend-added">Ami</span>
            : <button className="friend-add" disabled={pending.includes(player.playerId)} onClick={() => propose(player)}>{pending.includes(player.playerId) ? 'Envoyé' : 'Proposer'}</button>}
          />
        ))}
        {filteredPlayers.length === 0 && <p className="friends-empty">Aucun autre joueur trouvé.</p>}
      </div>
      {message && <p className="friends-message" role="status">{message}</p>}
    </div>
  );
}
