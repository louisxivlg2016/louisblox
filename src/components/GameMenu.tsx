import { useEffect, useState } from 'react';
import { useGameStore } from '../game/store';
import { readWorldSave } from '../game/save';
import { useMultiplayerStore } from '../game/multiplayerStore';
import type { GameplayMode } from '../game/worldMode';
import { MultiplayerLobby } from './MultiplayerLobby';
import { WorldLibrary } from './WorldLibrary';
import { FriendsPanel } from './FriendsPanel';
import { requestRoomMode } from './Multiplayer';
import myWorldsUrl from '../../assets/menu/my-worlds.webp';
import survivalUrl from '../../assets/menu/survival.webp';
import creativeUrl from '../../assets/menu/creative.webp';
import shopUrl from '../../assets/menu/shop.webp';
import battleUrl from '../../assets/menu/battle.webp';
import citiesUrl from '../../assets/menu/cities.webp';

export function GameMenu({ paused, onPlay, onShop }: { paused: boolean; onPlay: () => void | Promise<void>; onShop: () => void }) {
  const regenerate = useGameStore((state) => state.regenerate);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const room = useMultiplayerStore((state) => state.room);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const server = useMultiplayerStore((state) => state.server);
  const configure = useMultiplayerStore((state) => state.configure);
  const [pendingWorld, setPendingWorld] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  useEffect(() => {
    if (!libraryOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setLibraryOpen(false);
    };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [libraryOpen]);
  useEffect(() => {
    if (pendingWorld !== room || status !== 'online') return;
    setPendingWorld(null);
    void onPlay();
  }, [pendingWorld, room, status, onPlay]);
  const create = (gameplayMode: GameplayMode) => {
    if (enabled && gameplayMode === 'battle') {
      requestRoomMode('battle');
      if (status === 'online' && useGameStore.getState().gameplayMode === 'battle') {
        requestRoomMode(null);
        void onPlay();
        return;
      }
      if (status === 'online') {
        regenerate('battle', room);
        void onPlay();
        return;
      }
      setPendingWorld(room);
      configure({ playerName, room, server });
      return;
    }
    const shared = enabled && gameplayMode !== 'battle';
    const publicId = gameplayMode === 'survival' ? 'survie-public-v1' : gameplayMode === 'creative' ? 'creatif-public-v1' : `${gameplayMode}-public-v1`;
    const worldId = shared ? publicId : `monde-${crypto.randomUUID().slice(0, 8)}`;
    const names: Record<GameplayMode, string> = { survival: 'Survie avec tous les joueurs', creative: 'Créatif avec tous les joueurs', battle: worldId, 'city-ancient': 'Ville ancienne · 10 km', 'city-modern': 'Ville moderne · 10 km' };
    const worldName = names[gameplayMode];
    if (shared && readWorldSave(worldId)) useGameStore.getState().openWorld(worldId, worldName);
    else regenerate(gameplayMode, worldId);
    if (shared) useGameStore.setState({ worldName });
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
          <FriendsPanel onPlay={onPlay} />
          <button className="sidebar-shop" onClick={onShop}><img src={shopUrl} alt="" /><span>Ouvrir la boutique</span></button>
        </aside>
        <main className="world-browser">
          <div className="world-browser-header"><div><p className="eyebrow">TON AVENTURE</p><h1>{paused ? 'PARTIE EN PAUSE' : 'Choisis ton monde'}</h1></div>{paused && <button className="primary-button resume-button" onClick={onPlay}>Reprendre</button>}</div>
          <div className="world-cards">
            <button className="world-card featured" aria-controls="mes-mondes" aria-expanded={libraryOpen} aria-haspopup="dialog" onClick={() => setLibraryOpen(true)}>
              <img src={myWorldsUrl} alt="Mes mondes" />
              <span className="world-card-label"><strong>Mes mondes</strong><small>Retrouve toutes tes sauvegardes</small></span>
            </button>
            <button className="world-card" onClick={() => create('survival')} disabled={pendingWorld !== null}>
              <img src={survivalUrl} alt="Zombie du mode Survie" />
              <span className="world-card-label"><strong>Survie</strong><small>{enabled ? 'Monde public avec tous les joueurs' : 'Nouveau monde solo à mains nues'}</small></span>
              <span className="world-mode-tag">{enabled ? 'Multijoueur' : 'Solo'}</span>
            </button>
            <button className="world-card" onClick={() => create('creative')} disabled={pendingWorld !== null}>
              <img src={creativeUrl} alt="Monde du mode Créatif" />
              <span className="world-card-label"><strong>Créatif</strong><small>{enabled ? 'Monde public avec tous les joueurs' : 'Nouveau monde solo avec tous les objets'}</small></span>
              <span className="world-mode-tag creative">{enabled ? 'Multijoueur' : 'Solo'}</span>
            </button>
            <button className="world-card battle-card" onClick={() => create('battle')} disabled={!enabled || pendingWorld !== null}>
              <img src={battleUrl} alt="Monde Combat du mode Bataille" />
              <span className="world-card-label"><strong>Bataille</strong><small>Arène limitée · Équipes rouge et bleue</small></span>
              <span className="world-mode-tag">2 contre 1 possible</span>
            </button>
            <button className="world-card city-card" data-world-mode="city-ancient" onClick={() => create('city-ancient')} disabled={pendingWorld !== null}>
              <img src={citiesUrl} alt="Ville ancienne et ses bâtiments parisiens" />
              <span className="world-card-label"><strong>Ville ancienne</strong><small>Bâtiments parisiens · 10 km × 10 km</small></span>
              <span className="world-mode-tag">{enabled ? 'Multijoueur' : 'Solo'}</span>
            </button>
            <button className="world-card city-card" data-world-mode="city-modern" onClick={() => create('city-modern')} disabled={pendingWorld !== null}>
              <img src={citiesUrl} alt="Ville moderne, villas et immeubles de verre" />
              <span className="world-card-label"><strong>Ville moderne</strong><small>Villas et petits gratte-ciel · 10 km × 10 km</small></span>
              <span className="world-mode-tag">{enabled ? 'Multijoueur' : 'Solo'}</span>
            </button>
          </div>
          <section className="lobby-section">
            <div className="lobby-heading"><h2>Jouer ensemble</h2><p>Crée un salon ou rejoins tes amis avec le même nom de salon.</p></div>
            <MultiplayerLobby onPlay={onPlay} />
          </section>
          {libraryOpen && (
            <div className="world-library-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setLibraryOpen(false); }}>
              <section className="world-library-modal" role="dialog" aria-modal="true" aria-label="Mes mondes">
                <button className="world-library-close" aria-label="Fermer mes mondes" onClick={() => setLibraryOpen(false)} autoFocus>×</button>
                <WorldLibrary onPlay={() => { setLibraryOpen(false); return onPlay(); }} />
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
