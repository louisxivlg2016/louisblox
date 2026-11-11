import { useEffect, useState } from 'react';
import { useCharacterStore } from '../game/characterStore';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { acceptFriendRequest, fetchFriendRequests, giveApple, listOnlinePlayers, registerSelfProfile, searchPlayers, sendFriendRequest, useFriendStore, validatePlayerName } from '../game/friends';
import { playerIdentity } from '../game/playerIdentity';
import { useAvatarStore } from '../game/avatar';
import type { FriendPlayer, FriendRequest } from '../game/friends';
import { ProfileAvatar, ProfilePhotoPicker } from './ProfileAvatar';
import { useGameStore } from '../game/store';
import { requestRoomMode } from './Multiplayer';

function PlayerRow({ player, action, online = true }: { player: FriendPlayer; action?: React.ReactNode; online?: boolean }) {
  return (
    <div className="friend-row">
      <ProfileAvatar kind={player.avatar ?? 'pixel'} character={player.character} outfit={player.outfit} wig={player.wig} appearance={player.appearance} size={42} />
      <span className="friend-info"><strong>{player.name}</strong><small>{online ? 'En ligne' : 'Hors ligne'} · {player.room}</small></span>
      {action}
    </div>
  );
}

export function FriendsPanel({ onPlay }: { onPlay: () => void | Promise<void> }) {
  const playerName = useMultiplayerStore((state) => state.playerName);
  const status = useMultiplayerStore((state) => state.status);
  const worldReady = useMultiplayerStore((state) => state.worldReady);
  const room = useMultiplayerStore((state) => state.room);
  const server = useMultiplayerStore((state) => state.server);
  const configure = useMultiplayerStore((state) => state.configure);
  const setPlayerName = useMultiplayerStore((state) => state.setPlayerName);
  const character = useCharacterStore((state) => state.character);
  const outfit = useCharacterStore((state) => state.outfit);
  const wig = useCharacterStore((state) => state.wig);
  const appearance = useCharacterStore((state) => state.appearance);
  const avatar = useAvatarStore((state) => state.kind);
  const onlinePlayers = useFriendStore((state) => state.onlinePlayers);
  const friends = useFriendStore((state) => state.friends);
  const requests = useFriendStore((state) => state.requests);
  const setOnlinePlayers = useFriendStore((state) => state.setOnlinePlayers);
  const addFriend = useFriendStore((state) => state.addFriend);
  const removeRequest = useFriendStore((state) => state.removeRequest);
  const [editing, setEditing] = useState(false);
  const [choosingPhoto, setChoosingPhoto] = useState(false);
  const [name, setName] = useState(playerName);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<FriendPlayer[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<string[]>([]);
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);
  const [giving, setGiving] = useState<string[]>([]);
  const apples = useGameStore((state) => state.apples);
  const selfId = playerIdentity();

  useEffect(() => setName(playerName), [playerName]);
  useEffect(() => {
    if (pendingJoin !== room) return;
    if (status === 'online' && worldReady) {
      setPendingJoin(null);
      void onPlay();
    } else if (status === 'error') {
      setPendingJoin(null);
      setMessage(useMultiplayerStore.getState().error || 'Connexion au monde de ton ami impossible.');
    }
  }, [pendingJoin, room, status, worldReady, onPlay]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        await registerSelfProfile();
        const directory = await listOnlinePlayers();
        if (!active) return;
        setOnlinePlayers(directory);
        await fetchFriendRequests();
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Annuaire indisponible pour le moment.');
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [setOnlinePlayers, playerName, room, character, outfit, wig, appearance, avatar]);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void searchPlayers(query).then((players) => {
        if (active) setSearchResults(players);
      }).catch(() => {
        if (active) setMessage('Recherche indisponible pour le moment.');
      });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  const propose = async (player: FriendPlayer) => {
    try {
      const delivered = await sendFriendRequest(player);
      setPending((current) => [...current, player.playerId]);
      setMessage(delivered ? `Invitation envoyée à ${player.name}.` : `Invitation enregistrée. ${player.name} la recevra à sa prochaine connexion.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invitation impossible.');
    }
  };
  const accept = async (request: FriendRequest) => {
    try {
      await acceptFriendRequest(request);
      addFriend(request.from);
      removeRequest(request.requestId);
      setMessage(`${request.from.name} est maintenant ton ami.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invitation impossible.');
    }
  };
  const joinFriend = (player: FriendPlayer) => {
    requestRoomMode(null);
    setPendingJoin(player.room);
    setMessage(`Connexion au monde de ${player.name}…`);
    configure({ playerName, room: player.room, server }, true);
    const url = new URL(window.location.href);
    url.searchParams.set('room', player.room);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };
  const offerApple = async (player: FriendPlayer) => {
    setGiving((current) => [...current, player.playerId]);
    try {
      await giveApple(player);
      setMessage(`Une pomme a été offerte à ${player.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Don impossible pour le moment.');
    } finally {
      setGiving((current) => current.filter((id) => id !== player.playerId));
    }
  };
  const online = new Map(onlinePlayers.map((player) => [player.playerId, player]));
  const savedFriends = friends.map((friend) => online.get(friend.playerId) ? { player: online.get(friend.playerId)!, online: true } : { player: friend, online: false });
  const filteredPlayers = (search.trim() ? searchResults : onlinePlayers).filter((player) => player.playerId !== selfId);
  const visiblePlayers = filteredPlayers.map((player) => ({ player, online: online.has(player.playerId) }));

  return (
    <div className="friends-panel">
      <div className="profile-card">
        <button className="profile-avatar-button" onClick={() => { setChoosingPhoto((value) => !value); setEditing(false); }} aria-label="Choisir ma photo">
          <ProfileAvatar character={character} outfit={outfit} wig={wig} appearance={appearance} size={58} />
        </button>
        {editing ? (
          <form className="profile-name-form" onSubmit={(event) => {
            event.preventDefault();
            void validatePlayerName(name).then(() => {
              setPlayerName(name);
              setEditing(false);
              setMessage(`Ton pseudo est maintenant ${name.trim()}.`);
            }).catch((error) => setMessage(error instanceof Error ? error.message : 'Ce pseudo est indisponible.'));
          }}>
            <input aria-label="Mon pseudo" value={name} maxLength={24} onChange={(event) => setName(event.target.value)} autoFocus />
            <button type="submit">OK</button>
          </form>
        ) : (
          <button className="profile-name" onClick={() => { setEditing(true); setChoosingPhoto(false); }}><strong>{playerName}</strong><small>{status === 'online' ? 'En ligne' : 'Modifier mon pseudo'}</small></button>
        )}
      </div>
      {choosingPhoto && <ProfilePhotoPicker onClose={() => setChoosingPhoto(false)} />}

      {requests.length > 0 && (
        <div className="friend-requests">
          <h3>Invitations</h3>
          {requests.map((request) => (
            <div className="friend-request" key={request.requestId}>
              <PlayerRow player={request.from} />
              <div><button aria-label={`Accepter ${request.from.name}`} onClick={() => accept(request)}>Accepter</button><button aria-label={`Refuser ${request.from.name}`} onClick={() => { removeRequest(request.requestId); setMessage(`Invitation de ${request.from.name} refusée.`); }}>Refuser</button></div>
            </div>
          ))}
        </div>
      )}

      <div className="friends-heading"><h3>Amis <span>{friends.length}</span></h3><span className="online-dot" /></div>
      <div className="friends-list">
        {savedFriends.map(({ player, online: isOnline }) => <PlayerRow key={player.playerId} player={player} online={isOnline} action={<span className="friend-actions"><button className="friend-add" disabled={!isOnline} aria-label={`Rejoindre ${player.name}`} onClick={() => joinFriend(player)}>{isOnline ? 'Rejoindre' : 'Hors ligne'}</button><button className="friend-add friend-gift" disabled={!isOnline || apples < 1 || giving.includes(player.playerId)} aria-label={`Offrir une pomme à ${player.name}`} onClick={() => offerApple(player)}>{giving.includes(player.playerId) ? 'Envoi…' : `Pomme ×${apples}`}</button></span>} />)}
        {savedFriends.length === 0 && <p className="friends-empty">Propose des amis parmi les joueurs en ligne.</p>}
      </div>
      <div className="friends-heading"><h3>Tous les joueurs <span>{filteredPlayers.length}</span></h3></div>
      <input className="friends-search" type="search" aria-label="Rechercher un joueur" placeholder="Rechercher…" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="friends-list directory-list">
        {visiblePlayers.map(({ player, online: isOnline }) => (
          <PlayerRow key={player.playerId} player={player} online={isOnline} action={friends.some((friend) => friend.playerId === player.playerId)
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
