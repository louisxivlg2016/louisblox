import { useEffect, useState } from 'react';
import { listPublicWorlds } from '../game/publicWorlds';
import type { PublicWorld } from '../game/publicWorlds';
import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';
import { playerIdentity } from '../game/playerIdentity';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';

export function CommunityWorlds({ onPlay }: { onPlay: () => void | Promise<void> }) {
  const [worlds, setWorlds] = useState<PublicWorld[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const room = useMultiplayerStore((state) => state.room);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const server = useMultiplayerStore((state) => state.server);
  const setEnabled = useMultiplayerStore((state) => state.setEnabled);
  const configure = useMultiplayerStore((state) => state.configure);
  useEffect(() => {
    let active = true;
    const load = () => listPublicWorlds().then((items) => { if (active) setWorlds(items); }).catch(() => { if (active) setWorlds([]); });
    void load();
    const timer = window.setInterval(load, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [status]);
  useEffect(() => {
    if (pending !== room || status !== 'online') return;
    setPending(null);
    void onPlay();
  }, [pending, room, status, onPlay]);
  const open = (world: PublicWorld) => {
    useGameStore.getState().openWorld(world.id, world.name);
    useGameStore.setState({ worldTemplate: world.template ?? 'nature' });
    setEnabled(true);
    setPending(world.id);
    configure({ playerName, room: world.id, server });
  };
  return (
    <section className="community-worlds">
      <div className="world-library-heading"><h2>Mondes des joueurs</h2><span>{worlds.length}</span></div>
      <div className="world-library-list">
        {worlds.map((world) => (
          <button className="world-library-entry" key={world.id} onClick={() => open(world)} disabled={pending !== null}>
            <strong>{world.name}{world.ownerId === playerIdentity() ? ' · À moi' : ''}</strong>
            <small>{world.ownerName} · {GAMEPLAY_MODE_LABELS[world.gameplayMode]} · {world.players} joueur{world.players > 1 ? 's' : ''}</small>
          </button>
        ))}
        {worlds.length === 0 && <p>Les mondes partagés par les joueurs apparaîtront ici.</p>}
      </div>
      {!enabled && <p>Choisis un monde pour rejoindre automatiquement le multijoueur.</p>}
    </section>
  );
}
