import { useEffect, useState } from 'react';
import { useGameStore } from '../game/store';
import { newProtection, useProtectionStore } from '../game/protection';
import { canCreateWorld, MAX_WORLDS, readWorldSave } from '../game/save';
import { normalizeRoomId, useMultiplayerStore } from '../game/multiplayerStore';
import { isMinigameMode, isMultiplayerOnlyMode } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
import piratesUrl from '../../assets/menu/pirates.webp';
import piratesEsUrl from '../../assets/menu/spanish/modo-pirates.webp';
import footballFrUrl from '../../assets/menu/football.webp';
import footballEnUrl from '../../assets/menu/english/football-mode.webp';
import footballEsUrl from '../../assets/menu/spanish/modo-football.webp';
import mazeFrUrl from '../../assets/menu/maze.webp';
import mazeEnUrl from '../../assets/menu/english/maze-mode.webp';
import mazeEsUrl from '../../assets/menu/spanish/laberinto.webp';
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
import myWorldsEsUrl from '../../assets/menu/spanish/mis-mundos.webp';
import survivalFrUrl from '../../assets/menu/survival.webp';
import survivalEnUrl from '../../assets/menu/english/sirvival-world.webp';
import survivalEsUrl from '../../assets/menu/spanish/modo-survival.webp';
import creativeFrUrl from '../../assets/menu/creative.webp';
import creativeEnUrl from '../../assets/menu/english/creative-world.webp';
import creativeEsUrl from '../../assets/menu/spanish/modo-creativo.webp';
import shopFrUrl from '../../assets/menu/shop.webp';
import shopEnUrl from '../../assets/menu/english/shop.webp';
import shopEsUrl from '../../assets/menu/spanish/tienda.webp';
import battleFrUrl from '../../assets/menu/battle.webp';
import battleEnUrl from '../../assets/menu/english/combat-mode.webp';
import battleEsUrl from '../../assets/menu/spanish/modo-conbate.webp';
import citiesFrUrl from '../../assets/menu/cities.webp';
import citiesEnUrl from '../../assets/menu/english/built-city.webp';
import citiesEsUrl from '../../assets/menu/spanish/ciudad-contruida.webp';
import gameIconUrl from '../../assets/icons/louisblox-icon3.jpeg';
import { useLanguageStore, translate } from '../game/language';
import { LanguagePanel } from './LanguagePanel';
import { PlayerWorlds } from './PlayerWorlds';
import { fileToPixelDataUrl } from '../game/pixelImages';

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
const POPULAR_MODES = new Set<GameplayMode>(['survival', 'creative', 'battle', 'pirates', 'football', 'city-ancient', 'city-modern']);
const MODE_CARDS = (): ModeCard[] => [
  { mode: 'survival', image: translate(survivalFrUrl, survivalEnUrl, survivalEsUrl), alt: translate('Zombie du mode Survie', 'Survival mode zombie'), name: translate('Survie', 'Survival'), description: (enabled) => enabled ? translate('Monde public avec tous les joueurs', 'Public world with every player') : translate('Nouveau monde solo à mains nues', 'New solo world with bare hands'), tag: (enabled) => enabled ? translate('Multijoueur', 'Multiplayer') : 'Solo' },
  { mode: 'creative', image: translate(creativeFrUrl, creativeEnUrl, creativeEsUrl), alt: translate('Monde du mode Créatif', 'Creative mode world'), name: translate('Créatif', 'Creative'), tagClass: 'creative', description: (enabled) => enabled ? translate('Monde public avec tous les joueurs', 'Public world with every player') : translate('Nouveau monde solo avec tous les objets', 'New solo world with every item'), tag: (enabled) => enabled ? translate('Multijoueur', 'Multiplayer') : 'Solo' },
  { mode: 'battle', image: translate(battleFrUrl, battleEnUrl, battleEsUrl), alt: translate('Monde Combat du mode Bataille', 'Combat mode arena'), name: translate('Bataille', 'Combat'), className: 'battle-card', multiplayer: true, description: () => translate('Arène limitée · Rouge, Bleu ou chacun son équipe', 'Limited arena · Red, Blue, or free-for-all'), tag: () => translate('1 joueur = 1 équipe possible', 'One player can be a team') },
  { mode: 'pirates', image: translate(piratesUrl, piratesUrl, piratesEsUrl), alt: translate('Bataille navale du mode Pirates', 'Pirate naval battle'), name: translate('Pirates', 'Pirates', 'Piratas'), className: 'battle-card pirates-card', multiplayer: true, description: () => translate('Deux navires, un trésor à détruire et des abordages en équipe', 'Two ships, a treasure to destroy, and team boarding'), tag: () => translate('Combat naval', 'Naval combat') },
  { mode: 'football', image: translate(footballFrUrl, footballEnUrl, footballEsUrl), alt: translate('Stade et ballon du mode Football', 'Football stadium and ball'), name: 'Football', className: 'battle-card football-card', multiplayer: true, description: () => translate('Match de 5 minutes, cartons, corners, penaltys et hors-jeu', 'Five-minute match, cards, corners, penalties, and offside'), tag: () => translate('Rouge contre Bleu', 'Red versus Blue') },
  { mode: 'maze', image: translate(mazeFrUrl, mazeEnUrl, mazeEsUrl), alt: translate('Parcours d’obstacles du mode Labyrinthe', 'Maze obstacle courses'), name: translate('100 Parcours Labyrinthe', '100 Maze Courses'), className: 'battle-card maze-card', description: () => translate('100 parcours d’obstacles différents avec lave et labyrinthe', '100 different obstacle courses with lava and maze'), tag: () => translate('100 parcours', '100 courses') },
  { mode: 'city-ancient', image: translate(citiesFrUrl, citiesEnUrl, citiesEsUrl), alt: translate('Capitales européennes et leurs monuments', 'European capitals and their landmarks'), name: translate('Ville ancienne', 'Historic City'), className: 'city-card', description: () => translate('Paris, Londres, Berlin, Rome et 5 autres capitales · 10 km × 10 km', 'Paris, London, Berlin, Rome and 5 more capitals · 10 km × 10 km', 'París, Londres, Berlín, Roma y 5 capitales más · 10 km × 10 km'), tag: (enabled) => enabled ? translate('Multijoueur', 'Multiplayer') : 'Solo' },
  { mode: 'city-modern', image: translate(citiesFrUrl, citiesEnUrl, citiesEsUrl), alt: translate('Ville moderne, villas et immeubles de verre', 'Modern city with villas and glass buildings'), name: translate('Ville moderne', 'Modern City'), className: 'city-card', description: () => translate('Villas et petits gratte-ciel · 10 km × 10 km', 'Villas and small skyscrapers · 10 km × 10 km'), tag: (enabled) => enabled ? translate('Multijoueur', 'Multiplayer') : 'Solo' },
];

const MODE_IMAGES_KEY = 'louisblox-mode-images-v1';
type ModeImages = Partial<Record<GameplayMode, string>>;
function readModeImages(): ModeImages {
  try {
    const value = JSON.parse(localStorage.getItem(MODE_IMAGES_KEY) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(value).filter(([, url]) => typeof url === 'string' && url.startsWith('data:image/png;base64,'))) as ModeImages;
  } catch {
    return {};
  }
}

export function GameMenu({ paused, onPlay, onShop }: { paused: boolean; onPlay: () => void | Promise<void>; onShop: () => void }) {
  useLanguageStore((state) => state.language);
  const regenerate = useGameStore((state) => state.regenerate);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const error = useMultiplayerStore((state) => state.error);
  const worldReady = useMultiplayerStore((state) => state.worldReady);
  const room = useMultiplayerStore((state) => state.room);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const players = useMultiplayerStore((state) => state.players);
  const server = useMultiplayerStore((state) => state.server);
  const configure = useMultiplayerStore((state) => state.configure);
  const setEnabled = useMultiplayerStore((state) => state.setEnabled);
  const [pendingWorld, setPendingWorld] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [modeImages, setModeImages] = useState<ModeImages>(readModeImages);
  const [imageMessage, setImageMessage] = useState('');
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
    if (pendingWorld === null) return;
    if (status === 'error') {
      setPendingWorld(null);
      if (!isMultiplayerOnlyMode(currentMode)) {
        setCreateOpen(false);
        setEnabled(false);
        useGameStore.getState().setNotice(translate('Le serveur multijoueur est indisponible. Monde ouvert hors ligne ; tes constructions sont sauvegardées.', 'The multiplayer server is unavailable. World opened offline; your builds are saved.'));
        void onPlay();
      }
      return;
    }
    if (pendingWorld !== room || status !== 'online' || !worldReady) return;
    setPendingWorld(null);
    setCreateOpen(false);
    void onPlay();
  }, [pendingWorld, room, status, worldReady, currentMode, onPlay, setEnabled]);
  const [modePlayerCounts, setModePlayerCounts] = useState<Partial<Record<GameplayMode, number>>>({});
  useEffect(() => {
    if (!enabled) {
      setModePlayerCounts({});
      return;
    }
    let active = true;
    const load = async () => {
      const worlds = await listPublicWorlds().catch(() => []);
      const connectedPlayers = status === 'online' && worldReady ? Math.max(1, players.length) : 0;
      const entries = MODE_CARDS().map((card) => [card.mode, countPlayersByMode(worlds, card.mode, {
        ids: currentMode === card.mode && connectedPlayers > 0 ? [room] : [],
        players: currentMode === card.mode ? connectedPlayers : 0,
      })] as const);
      if (active) setModePlayerCounts(Object.fromEntries(entries));
    };
    void load();
    const timer = window.setInterval(load, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled, status, worldReady, currentMode, room, players.length]);
  const full = !canCreateWorld();
  const create = (gameplayMode: GameplayMode, sharedOverride?: boolean, options?: import('./CreateWorldDialog').CreateWorldOptions) => {
    if (pendingWorld !== null) return;
    if (!enabled && isMultiplayerOnlyMode(gameplayMode) && options?.multiplayer !== true) return;
    if (full) return;
    if (enabled && isMinigameMode(gameplayMode)) {
      requestRoomMode(gameplayMode);
      const minigameRoom = `salon-${crypto.randomUUID().slice(0, 8)}`;
      setPendingWorld(minigameRoom);
      regenerate(gameplayMode, minigameRoom);
      configure({ playerName: useMultiplayerStore.getState().playerName, room: minigameRoom, server: useMultiplayerStore.getState().server });
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
      configure({ playerName: useMultiplayerStore.getState().playerName, room: worldId, server: useMultiplayerStore.getState().server });
    } else {
      setEnabled(false);
      setCreateOpen(false);
      void onPlay();
    }
  };
  const changeModeImage = async (mode: GameplayMode, file: File) => {
    try {
      const url = await fileToPixelDataUrl(file);
      const next = { ...modeImages, [mode]: url };
      setModeImages(next);
      localStorage.setItem(MODE_IMAGES_KEY, JSON.stringify(next));
      setImageMessage(translate('Image du mode convertie en pixel art et sauvegardée.', 'Mode image converted to pixel art and saved.'));
    } catch {
      setImageMessage(translate('Choisis une image PNG, JPEG, GIF ou WebP de moins de 8 Mo.', 'Choose a PNG, JPEG, GIF, or WebP image smaller than 8 MB.'));
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
          {!['pirates', 'football', 'maze', 'battle'].includes(currentMode) && <button className="sidebar-shop" onClick={onShop}><img src={translate(shopFrUrl, shopEnUrl, shopEsUrl)} alt="" /><span>{translate('Ouvrir la boutique', 'Open shop')}</span></button>}
        </aside>
        <main className="world-browser">
          <div className="world-browser-header">
            <div>
              <h1>{!paused && translate('Choisis ton monde', 'Choose your world')}<span className="creator-label">{translate('JEU DU CRÉATEUR', 'CREATOR GAME')}</span></h1>
            </div>
            <div className="world-entry-actions">{!createOpen && <LanguagePanel inline />}{enabled && <button className="secondary-button join-world-button" onClick={() => setJoinOpen(true)} disabled={pendingWorld !== null}>{translate('Rejoindre', 'Join')}</button>}{paused && <button className="primary-button resume-button" onClick={onPlay} disabled={soloModeBlocked} title={soloModeBlocked ? translate('Active le multijoueur pour reprendre cette partie', 'Enable multiplayer to resume this game') : undefined}>{translate('Reprendre', 'Resume')}</button>}</div>
          </div>
          <div className="world-cards">
            <button className="world-card featured" aria-controls="mes-mondes" aria-expanded={libraryOpen} aria-haspopup="dialog" onClick={() => setLibraryOpen(true)}>
              <img src={translate(myWorldsFrUrl, myWorldsEnUrl, myWorldsEsUrl)} alt={translate('Mes mondes', 'My worlds')} />
              <span className="world-card-label"><strong>{translate('Mes mondes', 'My worlds')}</strong></span>
            </button>
            {MODE_CARDS().map((card) => {
              const locked = !enabled && isMultiplayerOnlyMode(card.mode);
              const playerCount = modePlayerCounts[card.mode] ?? 0;
              return (
                <div className="world-card-shell" key={card.mode}>
                  <button className={['world-card', card.className].filter(Boolean).join(' ')} data-world-mode={card.mode} aria-haspopup="dialog" onClick={() => openJoinMode(card.mode)} disabled={pendingWorld !== null || locked} title={locked ? translate('Active « Jouer en multijoueur » pour choisir ce mode', 'Enable multiplayer to choose this mode') : undefined}>
                    <img src={modeImages[card.mode] ?? card.image} alt={card.alt} />
                    <span className="world-card-label"><strong>{card.name}</strong></span>
                    <span className={['world-mode-tag', card.tagClass].filter(Boolean).join(' ')}>{locked ? translate('Multijoueur requis', 'Multiplayer required') : card.tag(enabled)}</span>
                    {enabled && <span className="world-mode-badges">
                      {POPULAR_MODES.has(card.mode) && <span className="world-mode-popular">{translate('Populaire', 'Popular')}</span>}
                      <span className="world-mode-player-count" aria-label={`${playerCount} ${translate('joueur', 'player')}${playerCount > 1 ? 's' : ''} ${translate('en', 'in')} ${card.name}`}>{playerCount} {translate('joueur', 'player')}{playerCount > 1 ? 's' : ''}</span>
                    </span>}
                  </button>
                  <label className="world-card-image-button" title={translate('Choisir une image pixelisée pour ce mode', 'Choose a pixelated image for this mode')} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>{translate('Image', 'Image')}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" aria-label={translate(`Choisir une image pour ${card.name}`, `Choose an image for ${card.name}`)} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void changeModeImage(card.mode, file); event.currentTarget.value = ''; }} /></label>
                </div>
              );
            })}
          </div>
          {imageMessage && <p className="world-image-message" role="status">{imageMessage}</p>}
          {enabled && <PlayerWorlds onPlay={onPlay} />}
          <MenuActionBar multiplayer={enabled} onSolo={() => setEnabled(false)} onMultiplayer={() => setEnabled(true)} onCreate={() => setCreateOpen(true)} onProfile={() => setProfileOpen(true)} createDisabled={full} />
          {soloModeBlocked && <p className="multiplayer-error" role="status">{translate('Les modes Pirates et Football sont réservés au multijoueur.', 'Pirates and Football require multiplayer.')}</p>}
          {enabled && error && <p className="multiplayer-error" role="alert">{error}</p>}
          {pendingWorld && <p className="multiplayer-hint" role="status">{translate('Création du monde et connexion au salon…', 'Creating the world and connecting to the room…')}</p>}
          {full && <div className="world-limit-notice" role="alert"><strong>{translate(`Limite de ${MAX_WORLDS} mondes atteinte`, `${MAX_WORLDS}-world limit reached`)}</strong><span>{translate('Ouvre « Mes mondes » et supprimes-en un avant de créer ou de rejouer une partie.', 'Open “My worlds” and delete one before creating or replaying a game.')}</span></div>}
          {createOpen && <CreateWorldDialog onClose={() => setCreateOpen(false)} onCreate={(options) => create(options.mode, options.multiplayer, options)} onPlay={onPlay} />}
          {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
          {enabled && joinOpen && (
            <div className="world-library-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setJoinOpen(false); }}>
              <section className="world-library-modal" role="dialog" aria-modal="true" aria-label={translate('Rejoindre un monde', 'Join a world')}>
                <button className="world-library-close" aria-label={translate('Fermer la liste des mondes', 'Close world list')} onClick={() => setJoinOpen(false)} autoFocus>×</button>
                <div className="lobby-heading"><h2>{translate('Rejoindre un monde', 'Join a world')}</h2><p>{translate('Rejoins le monde le plus peuplé avec le bouton Rejoindre, ou choisis toi-même un monde dans les listes.', 'Join the busiest world with the Join button, or choose a world from the lists.')}</p></div>
                <CommunityWorlds onPlay={() => { setJoinOpen(false); return onPlay(); }} mode={browseMode} onModeChange={setBrowseMode} />
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
