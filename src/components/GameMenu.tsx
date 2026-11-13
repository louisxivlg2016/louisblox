import { useEffect, useState } from 'react';
import { useGameStore } from '../game/store';
import { newProtection, useProtectionStore } from '../game/protection';
import { canCreateWorld, MAX_WORLDS, readWorldSave } from '../game/save';
import { normalizeRoomId, useMultiplayerStore } from '../game/multiplayerStore';
import { isMinigameMode, isMultiplayerOnlyMode } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import piratesUrl from '../../assets/menu/pirates.webp';
import footballUrl from '../../assets/menu/football.webp';
import mazeUrl from '../../assets/menu/maze.webp';
import { MenuActionBar } from './MenuActionBar';
import { countPlayersByMode, listPublicWorlds } from '../game/publicWorlds';
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
import gameIconUrl from '../../assets/icons/louisblox-icon3.jpeg';

const MODE_CARDS: Array<{
  mode: GameplayMode;
  image: string;
  alt: string;
  name: string;
  className?: string;
  tagClass?: string;
  multiplayer?: boolean;
  description: (enabled: boolean) => string;
  tag: (enabled: boolean) => string;
}> = [
  { mode: 'survival', image: survivalUrl, alt: 'Zombie du mode Survie', name: 'Survie', description: (enabled) => enabled ? 'Monde public avec tous les joueurs' : 'Nouveau monde solo à mains nues', tag: (enabled) => enabled ? 'Multijoueur' : 'Solo' },
  { mode: 'creative', image: creativeUrl, alt: 'Monde du mode Créatif', name: 'Créatif', tagClass: 'creative', description: (enabled) => enabled ? 'Monde public avec tous les joueurs' : 'Nouveau monde solo avec tous les objets', tag: (enabled) => enabled ? 'Multijoueur' : 'Solo' },
  { mode: 'battle', image: battleUrl, alt: 'Monde Combat du mode Bataille', name: 'Bataille', className: 'battle-card', multiplayer: true, description: () => 'Arène limitée · Rouge, Bleu ou chacun son équipe', tag: () => '1 joueur = 1 équipe possible' },
  { mode: 'pirates', image: piratesUrl, alt: 'Bataille navale du mode Pirates', name: 'Pirates', className: 'battle-card pirates-card', multiplayer: true, description: () => 'Deux navires, un trésor à détruire et des abordages en équipe', tag: () => 'Combat naval' },
  { mode: 'football', image: footballUrl, alt: 'Stade et ballon du mode Football', name: 'Football', className: 'battle-card football-card', multiplayer: true, description: () => 'Match de 5 minutes, cartons, corners, penaltys et hors-jeu', tag: () => 'Rouge contre Bleu' },
  { mode: 'maze', image: mazeUrl, alt: 'Labyrinthe du mode Course Labyrinthe', name: 'Course Labyrinthe', className: 'battle-card maze-card', description: (enabled) => enabled ? 'Trouve la sortie après le coup de sifflet de l’arbitre' : 'Course en solo dans le labyrinthe', tag: (enabled) => enabled ? 'Course chronométrée' : 'Solo' },
  { mode: 'city-ancient', image: citiesUrl, alt: 'Ville ancienne et ses bâtiments parisiens', name: 'Ville ancienne', className: 'city-card', description: () => 'Bâtiments parisiens · 10 km × 10 km', tag: (enabled) => enabled ? 'Multijoueur' : 'Solo' },
  { mode: 'city-modern', image: citiesUrl, alt: 'Ville moderne, villas et immeubles de verre', name: 'Ville moderne', className: 'city-card', description: () => 'Villas et petits gratte-ciel · 10 km × 10 km', tag: (enabled) => enabled ? 'Multijoueur' : 'Solo' },
];

export function GameMenu({ paused, onPlay, onShop }: { paused: boolean; onPlay: () => void | Promise<void>; onShop: () => void }) {
  const regenerate = useGameStore((state) => state.regenerate);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const worldReady = useMultiplayerStore((state) => state.worldReady);
  const room = useMultiplayerStore((state) => state.room);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const server = useMultiplayerStore((state) => state.server);
  const configure = useMultiplayerStore((state) => state.configure);
  const setEnabled = useMultiplayerStore((state) => state.setEnabled);
  const [pendingWorld, setPendingWorld] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const currentMode = useGameStore((state) => state.gameplayMode);
  const [browseMode, setBrowseMode] = useState<GameplayMode>(currentMode);
  useEffect(() => setBrowseMode(currentMode), [currentMode]);
  useEffect(() => {
    if (!libraryOpen && !joinOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setLibraryOpen(false);
      setJoinOpen(false);
    };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [libraryOpen, joinOpen]);
  useEffect(() => {
    if (pendingWorld !== room || status !== 'online' || !worldReady) return;
    setPendingWorld(null);
    void onPlay();
  }, [pendingWorld, room, status, worldReady, onPlay]);
  const [modePlayerCounts, setModePlayerCounts] = useState<Partial<Record<GameplayMode, number>>>({});
  useEffect(() => {
    let active = true;
    const load = async () => {
      const worlds = await listPublicWorlds().catch(() => []);
      const entries = MODE_CARDS.map((card) => [card.mode, countPlayersByMode(worlds, card.mode, { ids: [], players: 0 })] as const);
      if (active) setModePlayerCounts(Object.fromEntries(entries));
    };
    void load();
    const timer = window.setInterval(load, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [status]);
  const full = !canCreateWorld();
  const create = (gameplayMode: GameplayMode, sharedOverride?: boolean, options?: import('./CreateWorldDialog').CreateWorldOptions) => {
    if (!enabled && isMultiplayerOnlyMode(gameplayMode) && options?.multiplayer !== true) return;
    if (full) return;
    if (enabled && isMinigameMode(gameplayMode)) {
      requestRoomMode(gameplayMode);
      const minigameRoom = `salon-${crypto.randomUUID().slice(0, 8)}`;
      setPendingWorld(minigameRoom);
      regenerate(gameplayMode, minigameRoom);
      configure({ playerName, room: minigameRoom, server });
      return;
    }
    const shared = sharedOverride ?? (enabled && gameplayMode !== 'battle');
    const template = options?.template ?? (gameplayMode === 'city-ancient' || gameplayMode === 'city-modern' ? gameplayMode : 'nature');
    const names: Record<GameplayMode, string> = { survival: 'Survie avec tous les joueurs', creative: 'Créatif avec tous les joueurs', battle: 'Bataille', 'city-ancient': 'Ville ancienne · 10 km', 'city-modern': 'Ville moderne · 10 km', pirates: 'Pirates en équipe', football: 'Match de football', maze: 'Course Labyrinthe' };
    const worldName = options?.name.trim().slice(0, 48) || names[gameplayMode];
    const worldId = options?.multiplayer ? `salon-${crypto.randomUUID().slice(0, 8)}` : normalizeRoomId(worldName);
    if (options) useProtectionStore.getState().setProtection({ ...newProtection(), canBreak: options.canBreak, canPlace: options.canPlace });
    if (readWorldSave(worldId)) useGameStore.getState().openWorld(worldId, worldName);
    else regenerate(gameplayMode, worldId, template, worldName, options?.customWorld);
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
  const openJoinMode = (mode: GameplayMode) => {
    if (!enabled) {
      create(mode, false);
      return;
    }
    setBrowseMode(mode);
    setJoinOpen(true);
  };
  const soloModeBlocked = !enabled && isMultiplayerOnlyMode(currentMode);
  return (
    <div className="menu-screen">
      <div className="menu-layout">
        <aside className="menu-sidebar">
          <div className="menu-brand"><img className="menu-brand-icon" src={gameIconUrl} alt="LouisBlox" /><div><strong>LOUISBLOX</strong><small>Joue, construis, partage.</small></div></div>
          <FriendsPanel onPlay={onPlay} />
          {!['pirates', 'football', 'maze', 'battle'].includes(currentMode) && <button className="sidebar-shop" onClick={onShop}><img src={shopUrl} alt="" /><span>Ouvrir la boutique</span></button>}
        </aside>
        <main className="world-browser">
          <div className="world-browser-header"><div><p className="eyebrow">TON AVENTURE</p><h1>{paused ? 'PARTIE EN PAUSE' : 'Choisis ton monde'}<span className="creator-label">JEU DU CRÉATEUR</span></h1></div><div className="world-entry-actions">{enabled && <button className="secondary-button join-world-button" onClick={() => setJoinOpen(true)} disabled={pendingWorld !== null}>Rejoindre</button>}{paused && <button className="primary-button resume-button" onClick={onPlay} disabled={soloModeBlocked} title={soloModeBlocked ? 'Active le multijoueur pour reprendre cette partie' : undefined}>Reprendre</button>}</div></div>
          <div className="world-cards">
            <button className="world-card featured" aria-controls="mes-mondes" aria-expanded={libraryOpen} aria-haspopup="dialog" onClick={() => setLibraryOpen(true)}>
              <img src={myWorldsUrl} alt="Mes mondes" />
              <span className="world-card-label"><strong>Mes mondes</strong><small>Retrouve toutes tes sauvegardes</small></span>
            </button>
            {MODE_CARDS.map((card) => {
              const locked = !enabled && isMultiplayerOnlyMode(card.mode);
              const playerCount = modePlayerCounts[card.mode] ?? 0;
              return (
                <div className="world-card-shell" key={card.mode}>
                  <button className={['world-card', card.className].filter(Boolean).join(' ')} data-world-mode={card.mode} aria-haspopup="dialog" onClick={() => openJoinMode(card.mode)} disabled={pendingWorld !== null || locked} title={locked ? 'Active « Jouer en multijoueur » pour choisir ce mode' : undefined}>
                    <img src={card.image} alt={card.alt} />
                    <span className="world-card-label"><strong>{card.name}</strong><small>{locked ? 'Active le multijoueur pour jouer' : card.description(enabled)}</small></span>
                    <span className={['world-mode-tag', card.tagClass].filter(Boolean).join(' ')}>{locked ? 'Multijoueur requis' : card.tag(enabled)}</span>
                    <span className="world-mode-player-count" aria-label={`${playerCount} joueur${playerCount > 1 ? 's' : ''} en ${card.name}`}>{playerCount} joueur{playerCount > 1 ? 's' : ''}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <MenuActionBar multiplayer={enabled} onSolo={() => setEnabled(false)} onMultiplayer={() => setEnabled(true)} onCreate={() => setCreateOpen(true)} onProfile={() => setProfileOpen(true)} createDisabled={full} />
          {soloModeBlocked && <p className="multiplayer-error" role="status">Les modes Pirates et Football sont réservés au multijoueur.</p>}
          {full && <div className="world-limit-notice" role="alert"><strong>Limite de {MAX_WORLDS} mondes atteinte</strong><span>Ouvre « Mes mondes » et supprimes-en un avant de créer ou de rejouer une partie.</span></div>}
          {createOpen && <CreateWorldDialog onClose={() => setCreateOpen(false)} onCreate={(options) => { setCreateOpen(false); create(options.mode, options.multiplayer, options); }} onPlay={onPlay} />}
          {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
          {enabled && joinOpen && (
            <div className="world-library-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setJoinOpen(false); }}>
              <section className="world-library-modal" role="dialog" aria-modal="true" aria-label="Rejoindre un monde">
                <button className="world-library-close" aria-label="Fermer la liste des mondes" onClick={() => setJoinOpen(false)} autoFocus>×</button>
                <div className="lobby-heading"><h2>Rejoindre un monde</h2><p>Rejoins le monde le plus peuplé avec le bouton Rejoindre, ou choisis toi-même un monde dans les listes.</p></div>
                <CommunityWorlds onPlay={() => { setJoinOpen(false); return onPlay(); }} mode={browseMode} onModeChange={setBrowseMode} onCreate={() => { setJoinOpen(false); create(browseMode, enabled); }} />
              </section>
            </div>
          )}
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
