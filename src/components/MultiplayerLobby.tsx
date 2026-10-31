import { useEffect, useState } from 'react';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useCharacterStore } from '../game/characterStore';

const STATUS_NAMES = {
  offline: 'Non connecté',
  connecting: 'Connexion au salon…',
  online: 'Connecté',
  error: 'Connexion impossible',
} as const;

export function MultiplayerLobby() {
  const enabled = useMultiplayerStore((state) => state.enabled);
  const savedName = useMultiplayerStore((state) => state.playerName);
  const savedRoom = useMultiplayerStore((state) => state.room);
  const savedServer = useMultiplayerStore((state) => state.server);
  const status = useMultiplayerStore((state) => state.status);
  const error = useMultiplayerStore((state) => state.error);
  const players = useMultiplayerStore((state) => state.players);
  const character = useCharacterStore((state) => state.character);
  const setCharacter = useCharacterStore((state) => state.setCharacter);
  const setEnabled = useMultiplayerStore((state) => state.setEnabled);
  const configure = useMultiplayerStore((state) => state.configure);
  const [playerName, setPlayerName] = useState(savedName);
  const [room, setRoom] = useState(savedRoom);
  const [server, setServer] = useState(savedServer);
  const [showServer, setShowServer] = useState(() => new URLSearchParams(window.location.search).has('server'));
  useEffect(() => setPlayerName(savedName), [savedName]);

  const join = (nextRoom = room) => {
    const settings = configure({ playerName, room: nextRoom, server: showServer ? server : '' });
    setPlayerName(settings.playerName);
    setRoom(settings.room);
    setServer(settings.server);
    const url = new URL(window.location.href);
    url.searchParams.set('room', settings.room);
    if (settings.server) url.searchParams.set('server', settings.server);
    else url.searchParams.delete('server');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const invitation = new URL(window.location.href);
  invitation.searchParams.set('room', savedRoom);
  if (savedServer) invitation.searchParams.set('server', savedServer);
  else invitation.searchParams.delete('server');

  return (
    <>
      <div className="multiplayer-tabs" role="group" aria-label="Mode de jeu">
        <button type="button" className={`multiplayer-tab ${!enabled ? 'active' : ''}`} aria-pressed={!enabled} onClick={() => setEnabled(false)}>Solo</button>
        <button type="button" className={`multiplayer-tab ${enabled ? 'active' : ''}`} aria-pressed={enabled} onClick={() => setEnabled(true)}>Multijoueur</button>
      </div>
      <div className="character-selector">
        <span>Personnage</span>
        <div className="character-choice" role="group" aria-label="Choisir le personnage">
          <button type="button" className={character === 'boy' ? 'active' : ''} aria-pressed={character === 'boy'} onClick={() => setCharacter('boy')}>Garçon</button>
          <button type="button" className={character === 'girl' ? 'active' : ''} aria-pressed={character === 'girl'} onClick={() => setCharacter('girl')}>Fille</button>
        </div>
      </div>
      {enabled && (
        <form className="multiplayer-lobby" onSubmit={(event) => { event.preventDefault(); join(); }}>
          <div className="multiplayer-fields">
            <label htmlFor="multiplayer-name">Pseudo
              <input id="multiplayer-name" value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={24} autoComplete="nickname" required />
            </label>
            <label htmlFor="multiplayer-room">Nom du salon
              <input id="multiplayer-room" value={room} onChange={(event) => setRoom(event.target.value)} maxLength={48} autoCapitalize="none" autoCorrect="off" required />
            </label>
          </div>
          <p className="multiplayer-hint">Le même nom de salon suffit pour jouer ensemble, même avec le même pseudo.</p>
          <button type="button" className="multiplayer-server-toggle" onClick={() => setShowServer((visible) => !visible)}>
            {showServer ? 'Masquer le serveur personnalisé' : 'Serveur personnalisé (optionnel)'}
          </button>
          {showServer && (
            <>
              <label htmlFor="multiplayer-server">Serveur personnalisé <span>(optionnel)</span>
                <input id="multiplayer-server" value={server} onChange={(event) => setServer(event.target.value)} placeholder="wss://…workers.dev/ws" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              </label>
              <p className="multiplayer-hint">Laisse le serveur vide pour utiliser la connexion automatique. En local, il utilise le port 8787 de cet appareil.</p>
            </>
          )}
          <div className="multiplayer-actions">
            <button type="submit" className="multiplayer-join">Rejoindre</button>
            <button type="button" className="multiplayer-new-room" onClick={() => join(`salon-${crypto.randomUUID().slice(0, 8)}`)}>Nouveau salon</button>
          </div>
          <div className={`multiplayer-status ${status}`} role="status" aria-live="polite">
            <span className="multiplayer-status-dot" />
            <span>{STATUS_NAMES[status]}{status === 'online' ? ` · ${players.length} joueur${players.length > 1 ? 's' : ''}` : ''}</span>
          </div>
          {error && <p className="multiplayer-error">{error}</p>}
          {players.length > 0 && (
            <ul className="multiplayer-roster" aria-label="Joueurs dans le salon">
              {players.map((player) => <li key={player.playerId}>{player.name}{player.self ? ' (toi)' : ''}</li>)}
            </ul>
          )}
          <label htmlFor="multiplayer-invitation">Lien d’invitation
            <input id="multiplayer-invitation" className="multiplayer-share" readOnly value={invitation.toString()} onFocus={(event) => event.currentTarget.select()} />
          </label>
        </form>
      )}
    </>
  );
}
