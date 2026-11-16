import { useEffect, useState } from 'react';
import { useGameStore } from '../game/store';
import { newProtection, useProtectionStore } from '../game/protection';
import { canCreateWorld, MAX_WORLDS, readWorldSave } from '../game/save';
import { normalizeRoomId, useMultiplayerStore } from '../game/multiplayerStore';
import { isMinigameMode, isMultiplayerOnlyMode } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import piratesUrl from '../../assets/menu/pirates.webp';
import footballFrUrl from '../../assets/menu/football.webp';
import footballEnUrl from '../../assets/menu/english/football-mode.webp';
import mazeFrUrl from '../../assets/menu/maze.webp';
import mazeEnUrl from '../../assets/menu/english/maze-mode.webp';
import { MenuActionBar } from './MenuActionBar';
import { countPlayersByMode, listPublicWorlds } from '../game/publicWorlds';
import { CreateWorldDialog } from './CreateWorldDialog';
import { ProfileDialog } from './ProfileDialog';
import { WorldLibrary } from './WorldLibrary';
import { FriendsPanel } from './FriendsPanel';
import { CommunityWorlds } from './CommunityWorlds';
import { requestRoomMode } from './Multiplayer';
import myWorldsFrUrl from '../../assets/menu/my-worlds.webp';
import myWorldsEnUrl from '../../assets/menu/english/my-worlds.webp';
import survivalFrUrl from '../../assets/menu/survival.webp';
import survivalEnUrl from '../../assets/menu/english/sirvival-world.webp';
import creativeFrUrl from '../../assets/menu/creative.webp';
import creativeEnUrl from '../../assets/menu/english/creative-world.webp';
import shopFrUrl from '../../assets/menu/shop.webp';
import shopEnUrl from '../../assets/menu/english/shop.webp';
import battleFrUrl from '../../assets/menu/battle.webp';
import battleEnUrl from '../../assets/menu/english/combat-mode.webp';
import citiesFrUrl from '../../assets/menu/cities.webp';
import citiesEnUrl from '../../assets/menu/english/built-city.webp';
import gameIconUrl from '../../assets/icons/louisblox-icon3.jpeg';
import { useLanguageStore, translate } from '../game/language';

type ModeCard = {
  mode: GameplayMode;
  image: string;
  alt: string;
  name: string;
  className?: string;
  tagClass?: string;
  multiplayer?: boolean;
  description: (enabled: boolean) => string;
  tag: (enabled: boolean) => string;
};
const MODE_CARDS = (): ModeCard[] => [
  { mode: 'survival', image: translate(survivalFrUrl, survivalEnUrl), alt: translate('Zombie du mode Survie', 'Survival mode zombie'), name: translate('Survie', 'Survival'), description: (enabled) => enabled ? translate('Monde public avec tous les joueurs', 'Public world with every player') : translate('Nouveau monde solo à mains nues', 'New solo world with bare hands'), tag: (enabled) => enabled ? translate('Multijoueur', 'Multiplayer') : 'Solo' },
  { mode: 'creative', image: translate(creativeFrUrl, creativeEnUrl), alt: translate('Monde du mode Créatif', 'Creative mode world'), name: translate('Créatif', 'Creative'), tagClass: 'creative', description: (enabled) => enabled ? translate('Monde public avec tous les joueurs', 'Public world with every player') : translate('Nouveau monde solo avec tous les objets', 'New solo world with every item'), tag: (enabled) => enabled ? translate('Multijoueur', 'Multiplayer') : 'Solo' },
  { mode: 'battle', image: translate(battleFrUrl, battleEnUrl), alt: translate('Monde Combat du mode Bataille', 'Combat mode arena'), name: translate('Bataille', 'Combat'), className: 'battle-card', multiplayer: true, description: () => translate('Arène limitée · Rouge, Bleu ou chacun son équipe', 'Limited arena · Red, Blue, or free-for-all'), tag: () => translate('1 joueur = 1 équipe possible', 'One player can be a team') },
  { mode: 'pirates', image: piratesUrl, alt: translate('Bataille navale du mode Pirates', 'Pirate naval battle'), name: 'Pirates', className: 'battle-card pirates-card', multiplayer: true, description: () => translate('Deux navires, un trésor à détruire et des abordages en équipe', 'Two ships, a treasure to destroy, and team boarding'), tag: () => translate('Combat naval', 'Naval combat') },
  { mode: 'football', image: translate(footballFrUrl, footballEnUrl), alt: translate('Stade et ballon du mode Football', 'Football stadium and ball'), name: 'Football', className: 'battle-card football-card', multiplayer: true, description: () => translate('Match de 5 minutes, cartons, corners, penaltys et hors-jeu', 'Five-minute match, cards, corners, penalties, and offside'), tag: () => translate('Rouge contre Bleu', 'Red versus Blue') },
  { mode: 'maze', image: translate(mazeFrUrl, mazeEnUrl), alt: translate('Labyrinthe du mode Course Labyrinthe', 'Maze race'), name: translate('Course Labyrinthe', 'Maze Race'), className: 'battle-card maze-card', description: (enabled) => enabled ? translate('Trouve la sortie après le coup de sifflet de l’arbitre', 'Find the exit after the referee’s whistle') : translate('Course en solo dans le labyrinthe', 'Solo race through the maze'), tag: (enabled) => enabled ? translate('Course chronométrée', 'Timed race') : 'Solo' },
  { mode: 'city-ancient', image: translate(citiesFrUrl, citiesEnUrl), alt: translate('Ville ancienne et ses bâtiments parisiens', 'Historic city with Parisian buildings'), name: translate('Ville ancienne', 'Historic City'), className: 'city-card', description: () => translate('Bâtiments parisiens · 10 km × 10 km', 'Parisian buildings · 10 km × 10 km'), tag: (enabled) => enabled ? translate('Multijoueur', 'Multiplayer') : 'Solo' },
  { mode: 'city-modern', image: translate(citiesFrUrl, citiesEnUrl), alt: translate('Ville moderne, villas et immeubles de verre', 'Modern city with villas and glass buildings'), name: translate('Ville moderne', 'Modern City'), className: 'city-card', description: () => translate('Villas et petits gratte-ciel · 10 km × 10 km', 'Villas and small skyscrapers · 10 km × 10 km'), tag: (enabled) => enabled ? translate('Multijoueur', 'Multiplayer') : 'Solo' },
];

export function GameMenu({ paused, onPlay, onShop }: { paused: boolean; onPlay: () => void | Promise<void>; onShop: () => void }) {
  const language = useLanguageStore((state) => state.language);
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
      const entries = MODE_CARDS().map((card) => [card.mode, countPlayersByMode(worlds, card.mode, { ids: [], players: 0 })] as const);
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
    const names: Record<GameplayMode, string> = { survival: translate('Survie avec tous les joueurs', 'Survival with every player'), creative: translate('Créatif avec tous les joueurs', 'Creative with every player'), battle: translate('Bataille', 'Combat'), 'city-ancient': translate('Ville ancienne · 10 km', 'Historic City · 10 km'), 'city-modern': translate('Ville moderne · 10 km', 'Modern City · 10 km'), pirates: translate('Pirates en équipe', 'Team Pirates'), football: translate('Match de football', 'Football Match'), maze: translate('Course Labyrinthe', 'Maze Race') };
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
          <div className="menu-brand"><img className="menu-brand-icon" src={gameIconUrl} alt="LouisBlox" /><div><strong>LOUISBLOX</strong><small>{translate('Joue, construis, partage.', 'Play, build, share.')}</small></div></div>
          <FriendsPanel onPlay={onPlay} />
          {!['pirates', 'football', 'maze', 'battle'].includes(currentMode) && <button className="sidebar-shop" onClick={onShop}><img src={language === 'fr' ? shopFrUrl : shopEnUrl} alt="" /><span>{translate('Ouvrir la boutique', 'Open shop')}</span></button>}
        </aside>
        <main className="world-browser">
          <div className="world-browser-header"><div><p className="eyebrow">{translate('TON AVENTURE', 'YOUR ADVENTURE')}</p><h1>{paused ? translate('PARTIE EN PAUSE', 'GAME PAUSED') : translate('Choisis ton monde', 'Choose your world')}<span className="creator-label">{translate('JEU DU CRÉATEUR', 'CREATOR GAME')}</span></h1></div><div className="world-entry-actions">{enabled && <button className="secondary-button join-world-button" onClick={() => setJoinOpen(true)} disabled={pendingWorld !== null}>{translate('Rejoindre', 'Join')}</button>}{paused && <button className="primary-button resume-button" onClick={onPlay} disabled={soloModeBlocked} title={soloModeBlocked ? translate('Active le multijoueur pour reprendre cette partie', 'Enable multiplayer to resume this game') : undefined}>{translate('Reprendre', 'Resume')}</button>}</div></div>
          <div className="world-cards">
            <button className="world-card featured" aria-controls="mes-mondes" aria-expanded={libraryOpen} aria-haspopup="dialog" onClick={() => setLibraryOpen(true)}>
              <img src={language === 'fr' ? myWorldsFrUrl : myWorldsEnUrl} alt={translate('Mes mondes', 'My worlds')} />
              <span className="world-card-label"><strong>{translate('Mes mondes', 'My worlds')}</strong><small>{translate('Retrouve toutes tes sauvegardes', 'Find all your saved worlds')}</small></span>
            </button>
            {MODE_CARDS().map((card) => {
              const locked = !enabled && isMultiplayerOnlyMode(card.mode);
              const playerCount = modePlayerCounts[card.mode] ?? 0;
              return (
                <div className="world-card-shell" key={card.mode}>
                  <button className={['world-card', card.className].filter(Boolean).join(' ')} data-world-mode={card.mode} aria-haspopup="dialog" onClick={() => openJoinMode(card.mode)} disabled={pendingWorld !== null || locked} title={locked ? translate('Active « Jouer en multijoueur » pour choisir ce mode', 'Enable multiplayer to choose this mode') : undefined}>
                    <img src={card.image} alt={card.alt} />
                    <span className="world-card-label"><strong>{card.name}</strong><small>{locked ? translate('Active le multijoueur pour jouer', 'Enable multiplayer to play') : card.description(enabled)}</small></span>
                    <span className={['world-mode-tag', card.tagClass].filter(Boolean).join(' ')}>{locked ? translate('Multijoueur requis', 'Multiplayer required') : card.tag(enabled)}</span>
                    {enabled && <span className="world-mode-player-count" aria-label={`${playerCount} ${translate('joueur', 'player')}${playerCount > 1 ? 's' : ''} ${translate('en', 'in')} ${card.name}`}>{playerCount} {translate('joueur', 'player')}{playerCount > 1 ? 's' : ''}</span>}
                  </button>
                </div>
              );
            })}
          </div>
          <MenuActionBar multiplayer={enabled} onSolo={() => setEnabled(false)} onMultiplayer={() => setEnabled(true)} onCreate={() => setCreateOpen(true)} onProfile={() => setProfileOpen(true)} createDisabled={full} />
          {soloModeBlocked && <p className="multiplayer-error" role="status">{translate('Les modes Pirates et Football sont réservés au multijoueur.', 'Pirates and Football require multiplayer.')}</p>}
          {full && <div className="world-limit-notice" role="alert"><strong>{translate(`Limite de ${MAX_WORLDS} mondes atteinte`, `${MAX_WORLDS}-world limit reached`)}</strong><span>{translate('Ouvre « Mes mondes » et supprimes-en un avant de créer ou de rejouer une partie.', 'Open “My worlds” and delete one before creating or replaying a game.')}</span></div>}
          {createOpen && <CreateWorldDialog onClose={() => setCreateOpen(false)} onCreate={(options) => { setCreateOpen(false); create(options.mode, options.multiplayer, options); }} onPlay={onPlay} />}
          {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
          {enabled && joinOpen && (
            <div className="world-library-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setJoinOpen(false); }}>
              <section className="world-library-modal" role="dialog" aria-modal="true" aria-label={translate('Rejoindre un monde', 'Join a world')}>
                <button className="world-library-close" aria-label={translate('Fermer la liste des mondes', 'Close world list')} onClick={() => setJoinOpen(false)} autoFocus>×</button>
                <div className="lobby-heading"><h2>{translate('Rejoindre un monde', 'Join a world')}</h2><p>{translate('Rejoins le monde le plus peuplé avec le bouton Rejoindre, ou choisis toi-même un monde dans les listes.', 'Join the busiest world with the Join button, or choose a world from the lists.')}</p></div>
                <CommunityWorlds onPlay={() => { setJoinOpen(false); return onPlay(); }} mode={browseMode} onModeChange={setBrowseMode} onCreate={() => { setJoinOpen(false); create(browseMode, enabled); }} />
              </section>
            </div>
          )}
          {libraryOpen && (
            <div className="world-library-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setLibraryOpen(false); }}>
              <section className="world-library-modal" role="dialog" aria-modal="true" aria-label={translate('Mes mondes', 'My worlds')}>
                <button className="world-library-close" aria-label={translate('Fermer mes mondes', 'Close my worlds')} onClick={() => setLibraryOpen(false)} autoFocus>×</button>
                <WorldLibrary onPlay={() => { setLibraryOpen(false); return onPlay(); }} />
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
