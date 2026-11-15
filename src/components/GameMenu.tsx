import { useEffect, useState } from 'react';
import { useGameStore } from '../game/store';
import { newProtection, useProtectionStore } from '../game/protection';
import { canCreateWorld, MAX_WORLDS, readWorldSave } from '../game/save';
import { normalizeRoomId, useMultiplayerStore } from '../game/multiplayerStore';
import { isMinigameMode, isMultiplayerOnlyMode } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import piratesUrl from '../../assets/menu/pirates.webp';
import footballUrl from '../../assets/menu/english/football-mode.webp';
import mazeUrl from '../../assets/menu/english/maze-mode.webp';
import { MenuActionBar } from './MenuActionBar';
import { countPlayersByMode, listPublicWorlds } from '../game/publicWorlds';
import { CreateWorldDialog } from './CreateWorldDialog';
import { ProfileDialog } from './ProfileDialog';
import { WorldLibrary } from './WorldLibrary';
import { FriendsPanel } from './FriendsPanel';
import { CommunityWorlds } from './CommunityWorlds';
import { requestRoomMode } from './Multiplayer';
import myWorldsUrl from '../../assets/menu/english/my-worlds.webp';
import survivalUrl from '../../assets/menu/english/sirvival-world.webp';
import creativeUrl from '../../assets/menu/english/creative-world.webp';
import shopUrl from '../../assets/menu/english/shop.webp';
import battleUrl from '../../assets/menu/english/combat-mode.webp';
import citiesUrl from '../../assets/menu/english/built-city.webp';
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
  { mode: 'survival', image: survivalUrl, alt: 'Survival mode zombie', name: 'Survival', description: (enabled) => enabled ? 'Public world with every player' : 'New solo world with bare hands', tag: (enabled) => enabled ? 'Multiplayer' : 'Solo' },
  { mode: 'creative', image: creativeUrl, alt: 'Creative mode world', name: 'Creative', tagClass: 'creative', description: (enabled) => enabled ? 'Public world with every player' : 'New solo world with every item', tag: (enabled) => enabled ? 'Multiplayer' : 'Solo' },
  { mode: 'battle', image: battleUrl, alt: 'Combat mode arena', name: 'Combat', className: 'battle-card', multiplayer: true, description: () => 'Limited arena · Red, Blue, or free-for-all', tag: () => 'One player can be a team' },
  { mode: 'pirates', image: piratesUrl, alt: 'Pirate naval battle', name: 'Pirates', className: 'battle-card pirates-card', multiplayer: true, description: () => 'Two ships, a treasure to destroy, and team boarding', tag: () => 'Naval combat' },
  { mode: 'football', image: footballUrl, alt: 'Football stadium and ball', name: 'Football', className: 'battle-card football-card', multiplayer: true, description: () => 'Five-minute match, cards, corners, penalties, and offside', tag: () => 'Red versus Blue' },
  { mode: 'maze', image: mazeUrl, alt: 'Maze race', name: 'Maze Race', className: 'battle-card maze-card', description: (enabled) => enabled ? 'Find the exit after the referee’s whistle' : 'Solo race through the maze', tag: (enabled) => enabled ? 'Timed race' : 'Solo' },
  { mode: 'city-ancient', image: citiesUrl, alt: 'Historic city with Parisian buildings', name: 'Historic City', className: 'city-card', description: () => 'Parisian buildings · 10 km × 10 km', tag: (enabled) => enabled ? 'Multiplayer' : 'Solo' },
  { mode: 'city-modern', image: citiesUrl, alt: 'Modern city with villas and glass buildings', name: 'Modern City', className: 'city-card', description: () => 'Villas and small skyscrapers · 10 km × 10 km', tag: (enabled) => enabled ? 'Multiplayer' : 'Solo' },
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
    if (!enabled) {
      setModePlayerCounts({});
      return;
    }
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
  }, [enabled, status]);
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
    const names: Record<GameplayMode, string> = { survival: 'Survival with every player', creative: 'Creative with every player', battle: 'Combat', 'city-ancient': 'Historic City · 10 km', 'city-modern': 'Modern City · 10 km', pirates: 'Team Pirates', football: 'Football Match', maze: 'Maze Race' };
    const worldName = options?.name.trim().slice(0, 48) || names[gameplayMode];
    const worldId = options?.multiplayer ? `salon-${crypto.randomUUID().slice(0, 8)}` : normalizeRoomId(worldName);
    if (options) useProtectionStore.getState().setProtection({ ...newProtection(), canBreak: options.canBreak, canPlace: options.canPlace, allowDestructiveFire: options.allowDestructiveFire, allowCampfire: options.allowCampfire, allowFloodingWater: options.allowFloodingWater, allowCalmWater: options.allowCalmWater });
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
          <div className="menu-brand"><img className="menu-brand-icon" src={gameIconUrl} alt="LouisBlox" /><div><strong>LOUISBLOX</strong><small>Play, build, share.</small></div></div>
          <FriendsPanel onPlay={onPlay} />
          {!['pirates', 'football', 'maze', 'battle'].includes(currentMode) && <button className="sidebar-shop" onClick={onShop}><img src={shopUrl} alt="" /><span>Open shop</span></button>}
        </aside>
        <main className="world-browser">
          <div className="world-browser-header"><div><p className="eyebrow">YOUR ADVENTURE</p><h1>{paused ? 'GAME PAUSED' : 'Choose your world'}<span className="creator-label">CREATOR GAME</span></h1></div><div className="world-entry-actions">{enabled && <button className="secondary-button join-world-button" onClick={() => setJoinOpen(true)} disabled={pendingWorld !== null}>Join</button>}{paused && <button className="primary-button resume-button" onClick={onPlay} disabled={soloModeBlocked} title={soloModeBlocked ? 'Enable multiplayer to resume this game' : undefined}>Resume</button>}</div></div>
          <div className="world-cards">
            <button className="world-card featured" aria-controls="mes-mondes" aria-expanded={libraryOpen} aria-haspopup="dialog" onClick={() => setLibraryOpen(true)}>
              <img src={myWorldsUrl} alt="My worlds" />
              <span className="world-card-label"><strong>My worlds</strong><small>Find all your saved worlds</small></span>
            </button>
            {MODE_CARDS.map((card) => {
              const locked = !enabled && isMultiplayerOnlyMode(card.mode);
              const playerCount = modePlayerCounts[card.mode] ?? 0;
              return (
                <div className="world-card-shell" key={card.mode}>
                  <button className={['world-card', card.className].filter(Boolean).join(' ')} data-world-mode={card.mode} aria-haspopup="dialog" onClick={() => openJoinMode(card.mode)} disabled={pendingWorld !== null || locked} title={locked ? 'Enable multiplayer to choose this mode' : undefined}>
                    <img src={card.image} alt={card.alt} />
                    <span className="world-card-label"><strong>{card.name}</strong><small>{locked ? 'Enable multiplayer to play' : card.description(enabled)}</small></span>
                    <span className={['world-mode-tag', card.tagClass].filter(Boolean).join(' ')}>{locked ? 'Multiplayer required' : card.tag(enabled)}</span>
                    {enabled && <span className="world-mode-player-count" aria-label={`${playerCount} player${playerCount > 1 ? 's' : ''} in ${card.name}`}>{playerCount} player{playerCount > 1 ? 's' : ''}</span>}
                  </button>
                </div>
              );
            })}
          </div>
          <MenuActionBar multiplayer={enabled} onSolo={() => setEnabled(false)} onMultiplayer={() => setEnabled(true)} onCreate={() => setCreateOpen(true)} onProfile={() => setProfileOpen(true)} createDisabled={full} />
          {soloModeBlocked && <p className="multiplayer-error" role="status">Pirates and Football require multiplayer.</p>}
          {full && <div className="world-limit-notice" role="alert"><strong>{MAX_WORLDS}-world limit reached</strong><span>Open “My worlds” and delete one before creating or replaying a game.</span></div>}
          {createOpen && <CreateWorldDialog onClose={() => setCreateOpen(false)} onCreate={(options) => { setCreateOpen(false); create(options.mode, options.multiplayer, options); }} onPlay={onPlay} />}
          {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
          {enabled && joinOpen && (
            <div className="world-library-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setJoinOpen(false); }}>
              <section className="world-library-modal" role="dialog" aria-modal="true" aria-label="Join a world">
                <button className="world-library-close" aria-label="Close world list" onClick={() => setJoinOpen(false)} autoFocus>×</button>
                <div className="lobby-heading"><h2>Join a world</h2><p>Join the busiest world with the Join button, or choose a world from the lists.</p></div>
                <CommunityWorlds onPlay={() => { setJoinOpen(false); return onPlay(); }} mode={browseMode} onModeChange={setBrowseMode} onCreate={() => { setJoinOpen(false); create(browseMode, enabled); }} />
              </section>
            </div>
          )}
          {libraryOpen && (
            <div className="world-library-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setLibraryOpen(false); }}>
              <section className="world-library-modal" role="dialog" aria-modal="true" aria-label="My worlds">
                <button className="world-library-close" aria-label="Close my worlds" onClick={() => setLibraryOpen(false)} autoFocus>×</button>
                <WorldLibrary onPlay={() => { setLibraryOpen(false); return onPlay(); }} />
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
