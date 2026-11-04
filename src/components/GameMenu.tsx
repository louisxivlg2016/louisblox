import { useEffect, useState } from 'react';
import { useGameStore } from '../game/store';
import { newProtection, useProtectionStore } from '../game/protection';
import { readWorldSave } from '../game/save';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { isMinigameMode } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import piratesUrl from '../../assets/menu/pirates.webp';
import footballUrl from '../../assets/menu/football.webp';
import mazeUrl from '../../assets/menu/maze.webp';
import { MultiplayerLobby } from './MultiplayerLobby';
import { MenuActionBar } from './MenuActionBar';
import { CreateWorldDialog } from './CreateWorldDialog';
import { ProfileDialog } from './ProfileDialog';
import { WorldLibrary } from './WorldLibrary';
import { FriendsPanel } from './FriendsPanel';
import { CommunityWorlds } from './CommunityWorlds';
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
  const setEnabled = useMultiplayerStore((state) => state.setEnabled);
  const serverEditing = useMultiplayerStore((state) => state.serverEditing);
  const [pendingWorld, setPendingWorld] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
  const create = (gameplayMode: GameplayMode, sharedOverride?: boolean, options?: import('./CreateWorldDialog').CreateWorldOptions) => {
    if (enabled && isMinigameMode(gameplayMode)) {
      requestRoomMode(gameplayMode);
      if (status === 'online' && useGameStore.getState().gameplayMode === gameplayMode) {
        requestRoomMode(null);
        void onPlay();
        return;
      }
      const minigameRoom = `salon-${crypto.randomUUID().slice(0, 8)}`;
      setPendingWorld(minigameRoom);
      regenerate(gameplayMode, minigameRoom);
      configure({ playerName, room: minigameRoom, server });
      return;
    }
    const shared = sharedOverride ?? (enabled && gameplayMode !== 'battle');
    const template = options?.template ?? (gameplayMode === 'city-ancient' || gameplayMode === 'city-modern' ? gameplayMode : 'nature');
    const worldId = `monde-${crypto.randomUUID().slice(0, 8)}`;
    const names: Record<GameplayMode, string> = { survival: 'Survie avec tous les joueurs', creative: 'Créatif avec tous les joueurs', battle: worldId, 'city-ancient': 'Ville ancienne · 10 km', 'city-modern': 'Ville moderne · 10 km', pirates: 'Pirates en équipe', football: 'Match de football', maze: 'Course Labyrinthe' };
    const worldName = options?.name.trim().slice(0, 48) || names[gameplayMode];
    if (options) useProtectionStore.getState().setProtection({ ...newProtection(), canBreak: options.canBreak, canPlace: options.canPlace });
    if (shared && readWorldSave(worldId)) useGameStore.getState().openWorld(worldId, worldName);
    else regenerate(gameplayMode, worldId, template, worldName);
    if (shared) useGameStore.setState({ worldName });
    if (shared) {
      setEnabled(true);
      setPendingWorld(worldId);
      configure({ playerName, room: worldId, server });
    } else {
      setEnabled(false);
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
          <div className="world-browser-header"><div><p className="eyebrow">TON AVENTURE</p><h1>{paused ? 'PARTIE EN PAUSE' : 'Choisis ton monde'}<span className="creator-label">JEU DU CRÉATEUR</span></h1></div>{paused && <button className="primary-button resume-button" onClick={onPlay}>Reprendre</button>}</div>
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
            <button className="world-card battle-card" onClick={() => create('battle')} disabled={!enabled || serverEditing || pendingWorld !== null} title={serverEditing ? "Serveur personnalisé ouvert : choisis le mode puis clique sur Rejoindre" : undefined}>
              <img src={battleUrl} alt="Monde Combat du mode Bataille" />
              <span className="world-card-label"><strong>Bataille</strong><small>Arène limitée · Rouge, Bleu ou chacun son équipe</small></span>
              <span className="world-mode-tag">1 joueur = 1 équipe possible</span>
            </button>
            <button className="world-card battle-card pirates-card" onClick={() => create('pirates')} disabled={!enabled || serverEditing || pendingWorld !== null} title={serverEditing ? "Serveur personnalisé ouvert : choisis le mode puis clique sur Rejoindre" : undefined}>
              <img src={piratesUrl} alt="Bataille navale du mode Pirates" />
              <span className="world-card-label"><strong>Pirates</strong><small>Deux navires, un trésor à détruire et des abordages en équipe</small></span>
              <span className="world-mode-tag">Combat naval</span>
            </button>
            <button className="world-card battle-card football-card" onClick={() => create('football')} disabled={!enabled || serverEditing || pendingWorld !== null} title={serverEditing ? "Serveur personnalisé ouvert : choisis le mode puis clique sur Rejoindre" : undefined}>
              <img src={footballUrl} alt="Stade et ballon du mode Football" />
              <span className="world-card-label"><strong>Football</strong><small>Match de 5 minutes, cartons, corners, penaltys et hors-jeu</small></span>
              <span className="world-mode-tag">Rouge contre Bleu</span>
            </button>
            <button className="world-card battle-card maze-card" onClick={() => create('maze')} disabled={!enabled || serverEditing || pendingWorld !== null} title={serverEditing ? "Serveur personnalisé ouvert : choisis le mode puis clique sur Rejoindre" : undefined}>
              <img src={mazeUrl} alt="Labyrinthe du mode Course Labyrinthe" />
              <span className="world-card-label"><strong>Course Labyrinthe</strong><small>Trouve la sortie après le coup de sifflet de l’arbitre</small></span>
              <span className="world-mode-tag">Course chronométrée</span>
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
          <MenuActionBar multiplayer={enabled} onSolo={() => setEnabled(false)} onMultiplayer={() => setEnabled(true)} onCreate={() => setCreateOpen(true)} onProfile={() => setProfileOpen(true)} />
          {enabled && <section className="lobby-section"><MultiplayerLobby onPlay={onPlay} /></section>}
          <CommunityWorlds onPlay={onPlay} />
          {createOpen && <CreateWorldDialog onClose={() => setCreateOpen(false)} onCreate={(options) => { setCreateOpen(false); create(options.mode, options.multiplayer, options); }} />}
          {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
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
