import { useEffect, useState } from 'react';
import { listPublicWorlds } from '../game/publicWorlds';
import type { PublicWorld } from '../game/publicWorlds';
import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import { playerIdentity } from '../game/playerIdentity';
import { listWorlds } from '../game/save';
import type { WorldMeta } from '../game/save';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { usePublicWorldJoin } from './usePublicWorldJoin';

export function CommunityWorlds({ onPlay, mode, onModeChange }: {
  onPlay: () => void | Promise<void>;
  mode?: GameplayMode;
  onModeChange?: (mode: GameplayMode) => void;
}) {
  const [worlds, setWorlds] = useState<PublicWorld[]>([]);
  const [localWorlds, setLocalWorlds] = useState<WorldMeta[]>([]);
  const [internalMode, setInternalMode] = useState<GameplayMode>(() => useGameStore.getState().gameplayMode);
  const selectedMode = mode ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const worldId = useGameStore((state) => state.worldId);
  const { join, joinRandom, pending, error } = usePublicWorldJoin(onPlay);
  const selfId = playerIdentity();
  const others = worlds.filter((world) => world.ownerId !== selfId && world.gameplayMode === selectedMode);
  const localIds = new Set(localWorlds.map((world) => world.id));
  const ownPublic = worlds.filter((world) => world.ownerId === selfId && world.gameplayMode === selectedMode && !localIds.has(world.id));
  const ownLocal = localWorlds.filter((world) => (world.gameplayMode ?? 'creative') === selectedMode);

  useEffect(() => {
    let active = true;
    const load = () => listPublicWorlds().then((items) => { if (active) setWorlds(items); }).catch(() => { if (active) setWorlds([]); });
    void load();
    const timer = window.setInterval(load, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [status]);
  useEffect(() => setLocalWorlds(listWorlds()), [worldId]);

  const openLocal = (world: WorldMeta) => {
    if (!enabled) {
      useGameStore.getState().openWorld(world.id, world.name);
      window.setTimeout(onPlay, 120);
      return;
    }
    const gameplayMode = world.gameplayMode ?? selectedMode;
    join({ id: world.id, name: world.name, ownerId: selfId, ownerName: playerName, gameplayMode, template: gameplayMode === 'city-ancient' || gameplayMode === 'city-modern' ? gameplayMode : 'nature', players: 0, updatedAt: world.updatedAt });
  };
  return (
    <section className="community-worlds">
      <div className="community-heading">
        <div><h2>Rejoindre un monde</h2><p>Un monde en ligne chez un autre joueur, ou l’une de tes sauvegardes.</p></div>
        <label>Mode
          <select value={selectedMode} onChange={(event) => setMode(event.target.value as GameplayMode)} aria-label="Mode des mondes proposés">
            {Object.entries(GAMEPLAY_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <button className="multiplayer-join community-random" onClick={() => void joinRandom(selectedMode)} disabled={pending || status === 'connecting'}>Rejoindre</button>
      <p className="community-random-hint">Choix au hasard parmi les mondes {GAMEPLAY_MODE_LABELS[selectedMode]} avec d’autres joueurs en ligne.</p>
      {error && <p className="multiplayer-error" role="alert">{error}</p>}
      <section className="community-section">
        <h3>Mondes des autres joueurs <span>{others.length}</span></h3>
        <div className="world-library-list">
          {others.map((world) => (
            <button className="world-library-entry" key={world.id} data-world-id={world.id} data-owner-id={world.ownerId} data-mode={world.gameplayMode} onClick={() => join(world)} disabled={pending || status === 'connecting'}>
              <strong>{world.name}</strong>
              <small>{world.ownerName} · {GAMEPLAY_MODE_LABELS[world.gameplayMode]} · {world.players} joueur{world.players > 1 ? 's' : ''} en ligne</small>
            </button>
          ))}
          {others.length === 0 && <p>Aucun monde public en {GAMEPLAY_MODE_LABELS[selectedMode]} pour le moment.</p>}
        </div>
      </section>
      <section className="community-section">
        <h3>Mes mondes <span>{ownPublic.length + ownLocal.length}</span></h3>
        <div className="world-library-list">
          {ownPublic.map((world) => (
            <button className="world-library-entry" key={world.id} data-world-id={world.id} data-owner-id={world.ownerId} data-mode={world.gameplayMode} onClick={() => join(world)} disabled={pending || status === 'connecting'}>
              <strong>{world.name}</strong>
              <small>Mon monde partagé · {world.players} joueur{world.players > 1 ? 's' : ''} en ligne</small>
            </button>
          ))}
          {ownLocal.map((world) => (
            <button className="world-library-entry" key={world.id} data-world-id={world.id} data-mode={world.gameplayMode ?? 'creative'} onClick={() => openLocal(world)} disabled={pending || status === 'connecting'}>
              <strong>{world.name}</strong>
              <small>Ma sauvegarde · {GAMEPLAY_MODE_LABELS[world.gameplayMode ?? 'creative']} · {world.updatedAt ? new Date(world.updatedAt).toLocaleDateString('fr-FR') : 'Ancienne sauvegarde'}</small>
            </button>
          ))}
          {ownPublic.length + ownLocal.length === 0 && <p>Aucune sauvegarde en {GAMEPLAY_MODE_LABELS[selectedMode]} pour le moment.</p>}
        </div>
      </section>
    </section>
  );
}
