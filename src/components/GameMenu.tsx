import { useEffect, useState } from 'react';
import { useGameStore } from '../game/store';
import { useMultiplayerStore } from '../game/multiplayerStore';
import type { GameplayMode } from '../game/worldMode';
import { MultiplayerLobby } from './MultiplayerLobby';
import { WorldLibrary } from './WorldLibrary';
import { FriendsPanel } from './FriendsPanel';
import myWorldsUrl from '../../assets/menu/my-worlds.webp';
import survivalUrl from '../../assets/menu/survival.webp';
import creativeUrl from '../../assets/menu/creative.webp';
import shopUrl from '../../assets/menu/shop.webp';

export function GameMenu({ paused, onPlay, onShop }: { paused: boolean; onPlay: () => void | Promise<void>; onShop: () => void }) {
  const regenerate = useGameStore((state) => state.regenerate);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const room = useMultiplayerStore((state) => state.room);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const server = useMultiplayerStore((state) => state.server);
  const configure = useMultiplayerStore((state) => state.configure);
  const [pendingWorld, setPendingWorld] = useState<string | null>(null);
  useEffect(() => {
    if (pendingWorld !== room || status !== 'online') return;
    setPendingWorld(null);
    void onPlay();
  }, [pendingWorld, room, status, onPlay]);
  const create = (gameplayMode: GameplayMode) => {
    const worldId = `monde-${crypto.randomUUID().slice(0, 8)}`;
    regenerate(gameplayMode, worldId);
    if (enabled) {
      setPendingWorld(worldId);
      configure({ playerName, room: worldId, server });
    } else {
      void onPlay();
    }
  };
  return (
    <div className="menu-screen">
      <div className="menu-layout">
        <aside className="menu-sidebar">
          <div className="menu-brand"><span className="menu-brand-cube">L</span><div><strong>LOUISBLOX</strong><small>Joue, construis, partage.</small></div></div>
          <FriendsPanel />
          <button className="sidebar-shop" onClick={onShop}><img src={shopUrl} alt="" /><span>Ouvrir la boutique</span></button>
        </aside>
        <main className="world-browser">
          <div className="world-browser-header"><div><p className="eyebrow">TON AVENTURE</p><h1>{paused ? 'PARTIE EN PAUSE' : 'Choisis ton monde'}</h1></div>{paused && <button className="primary-button resume-button" onClick={onPlay}>Reprendre</button>}</div>
          <div className="world-cards">
            <button className="world-card featured" aria-controls="mes-mondes" onClick={() => document.getElementById('mes-mondes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <img src={myWorldsUrl} alt="Mes mondes" />
              <span className="world-card-label"><strong>Mes mondes</strong><small>Retrouve toutes tes sauvegardes</small></span>
            </button>
            <button className="world-card" onClick={() => create('survival')} disabled={pendingWorld !== null}>
              <img src={survivalUrl} alt="Zombie du mode Survie" />
              <span className="world-card-label"><strong>Survie</strong><small>Récolte, fabrique et résiste aux zombies</small></span>
              <span className="world-mode-tag">À mains nues</span>
            </button>
            <button className="world-card" onClick={() => create('creative')} disabled={pendingWorld !== null}>
              <img src={creativeUrl} alt="Monde du mode Créatif" />
              <span className="world-card-label"><strong>Créatif</strong><small>Tous les blocs et objets, sans limite</small></span>
              <span className="world-mode-tag creative">Tout est permis</span>
            </button>
            <button className="world-card battle-card" onClick={() => create('battle')} disabled={!enabled || pendingWorld !== null}>
              <img src={survivalUrl} alt="Arène du mode Bataille" />
              <span className="world-card-label"><strong>Bataille</strong><small>Arène limitée · Équipes rouge et bleue</small></span>
              <span className="world-mode-tag">2 contre 1 possible</span>
            </button>
          </div>
          <section className="lobby-section">
            <div className="lobby-heading"><h2>Jouer ensemble</h2><p>Crée un salon ou rejoins tes amis avec le même nom de salon.</p></div>
            <MultiplayerLobby onPlay={onPlay} />
          </section>
          <WorldLibrary onPlay={onPlay} />
        </main>
      </div>
    </div>
  );
}
