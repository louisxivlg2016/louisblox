import { useEffect, useState } from 'react';
import { listPublicWorlds } from '../game/publicWorlds';
import type { PublicWorld } from '../game/publicWorlds';
import { playerIdentity } from '../game/playerIdentity';
import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { usePublicWorldJoin } from './usePublicWorldJoin';
import { translate } from '../game/language';

export function PlayerWorlds({ onPlay }: { onPlay: () => void | Promise<void> }) {
  const [worlds, setWorlds] = useState<PublicWorld[]>([]);
  const status = useMultiplayerStore((state) => state.status);
  const { join, pending, error } = usePublicWorldJoin(onPlay);
  const selfId = playerIdentity();

  useEffect(() => {
    let active = true;
    const load = () => listPublicWorlds().then((items) => { if (active) setWorlds(items); }).catch(() => { if (active) setWorlds([]); });
    void load();
    const timer = window.setInterval(load, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [status]);

  const playersWorlds = worlds.slice(0, 12);
  return (
    <section className="community-worlds player-worlds" aria-label={translate('Jeux des joueurs', 'Player games')}>
      <div className="community-heading"><div><h2>{translate('Jeux des joueurs', 'Player games')}</h2><p>{translate('Retrouve tes mondes et ceux créés par les autres joueurs.', 'Find your worlds and worlds created by other players.')}</p></div></div>
      <div className="world-library-list">
        {playersWorlds.map((world) => <button className="world-library-entry" key={world.id} data-world-id={world.id} data-mode={world.gameplayMode} onClick={() => join(world)} disabled={pending}>
          {world.thumbnail && <img className="world-library-thumbnail" src={world.thumbnail} alt="" />}
          <span className="world-library-details"><strong>{world.name}</strong><small>{world.ownerId === selfId ? translate('Toi', 'You') : world.ownerName} · {GAMEPLAY_MODE_LABELS()[world.gameplayMode]} · {world.players} {translate('joueur', 'player')}{world.players > 1 ? 's' : ''} {translate('en ligne', 'online')}</small></span>
        </button>)}
        {playersWorlds.length === 0 && <p>{translate('Aucun jeu de joueur en ligne pour le moment.', 'No player games online right now.')}</p>}
      </div>
      {error && <p className="multiplayer-error" role="alert">{error}</p>}
    </section>
  );
}
