import { releasePointerForOverlay, requestPlay } from '../game/input';
import { useGameStore } from '../game/store';
import { useBombLauncherStore } from '../game/weaponAmmo';
import { selectionInfo } from '../game/items';
import { inventoryCount } from '../game/inventory';
import { ItemIcon } from './ItemIcon';
import { PaintballPalette } from './PaintballPalette';
import { PlaneTitleEditor } from './PlaneTitleEditor';
import { PoliceTitleEditor } from './PoliceTitleEditor';
import backpackButtonFrUrl from '../../assets/ui/backpack-button.webp';
import backpackButtonEnUrl from '../../assets/ui/english/backpack.webp';
import backpackButtonEsUrl from '../../assets/ui/spanish/mochila.webp';
import shopButtonFrUrl from '../../assets/ui/shop-button.webp';
import shopButtonEnUrl from '../../assets/ui/english/shop.webp';
import shopButtonEsUrl from '../../assets/ui/spanish/tienda.webp';
import teleportButtonUrl from '../../assets/ui/teleport-button.webp';
import constructionButtonUrl from '../../assets/ui/construction-button.webp';
import tribeButtonUrl from '../../assets/menu/tribe-button.webp';
import { Backpack } from './Backpack';
import { BoutiquePanel } from './BoutiquePanel';
import { ContainerPanel } from './ContainerPanel';
import { TouchControls } from './TouchControls';
import { Minimap } from './Minimap';
import { SirenButton } from './SirenButton';
import { RadioControls } from './RadioControls';
import { VehiclePassengers } from './VehiclePassengers';
import { BookPanel } from './BookPanel';
import { SignPanel } from './SignPanel';
import { useSignStore } from '../game/signs';
import { SeatChoicePanel } from './SeatChoicePanel';
import { GameMenu } from './GameMenu';
import { TeleportPanel, TeleportRequestDialog } from './TeleportRequests';
import { useTeleportRequestStore } from '../game/teleportRequests';
import { useChatStore } from '../game/chat';
import { ChatPanel } from './ChatPanel';
import { BattleHud } from './BattleHud';
import { useBattleStore } from '../game/battle';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { EmotePanel } from './EmotePanel';
import { useEmoteStore } from '../game/emotes';
import { EffectsHud } from './EffectsHud';
import { PiratesHud } from './PiratesHud';
import { FootballHud } from './FootballHud';
import { MazeHud } from './MazeHud';
import { FriendRequestDialog } from './FriendRequestDialog';
import { TradingPanel } from './TradingPanel';
import { useTradeStore } from '../game/trading';
import { HomePanel } from './HomePanel';
import { useHomeStore } from '../game/homes';
import { TribePanel } from './TribePanel';
import { useTribeStore } from '../game/tribes';
import { useLanguageStore } from '../game/language';
import { translate } from '../game/language';
import { useConstructionStore } from '../game/constructions';
import { ConstructionPanel } from './ConstructionPanel';
import { BlueprintControls } from './BlueprintControls';
import { CompanionPanel } from './CompanionPanel';
import { useCompanionMenuStore } from '../game/companionMenu';
import { captureGamePhoto } from '../game/pixelImages';
import { saveWorld } from '../game/save';
import { world } from '../game/world';

export function Hud() {
  const language = useLanguageStore((state) => state.language);
  const mode = useGameStore((state) => state.mode);
  const selected = useGameStore((state) => state.selected);
  const selectedSlot = useGameStore((state) => state.selectedSlot);
  const bombAmmo = useBombLauncherStore((state) => state.ammo);
  const bombReloading = useBombLauncherStore((state) => state.reloadUntil !== null);
  const hotbarSlots = useGameStore((state) => state.hotbarSlots);
  const itemCounts = useGameStore((state) => state.itemCounts);
  const apples = useGameStore((state) => state.apples);
  const miningProgress = useGameStore((state) => state.miningProgress);
  const notice = useGameStore((state) => state.notice);
  const backpackOpen = useGameStore((state) => state.backpackOpen);
  const shopOpen = useGameStore((state) => state.shopOpen);
  const constructionOpen = useConstructionStore((state) => state.open);
  const teleportOpen = useGameStore((state) => state.teleportOpen);
  const containerOpen = useGameStore((state) => state.container !== null);
  const bookOpen = useGameStore((state) => state.bookOpen);
  const signOpen = useSignStore((state) => state.editing !== null);
  const seatChoice = useGameStore((state) => state.seatChoice);
  const chatOpen = useChatStore((state) => state.open);
  const emoteOpen = useEmoteStore((state) => state.open);
  const tradeOpen = useTradeStore((state) => state.open);
  const companionOpen = useCompanionMenuStore((state) => state.open);
  const homeOpen = useHomeStore((state) => state.open);
  const tribeOpen = useTribeStore((state) => state.panelOpen);
  const tribeInvitations = useTribeStore((state) => state.invitations.length);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const lives = useGameStore((state) => state.lives);
  const battleTeam = useBattleStore((state) => state.team);
  const multiplayerReady = useMultiplayerStore((state) => state.enabled && state.status === 'online');
  const teamSelection = mode === 'pause' && multiplayerReady && ((gameplayMode === 'battle' && battleTeam === null) || (gameplayMode === 'pirates' && battleTeam === null) || (gameplayMode === 'football' && battleTeam === null));
  const sleepProgress = useGameStore((state) => state.sleepProgress);
  const dayProgress = useGameStore((state) => state.environment.dayProgress);
  const teleportRequestOpen = useTeleportRequestStore((state) => state.incoming !== null);
  const selectBlock = useGameStore((state) => state.selectBlock);
  const setBackpack = useGameStore((state) => state.setBackpack);
  const setTeleportOpen = useGameStore((state) => state.setTeleportOpen);
  const openBackpack = () => {
    setBackpack(true);
    useGameStore.getState().setMode('pause');
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const openTeleport = () => {
    setTeleportOpen(true);
    useGameStore.getState().setMode('pause');
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const takePhoto = async () => {
    try {
      const thumbnail = await captureGamePhoto();
      useGameStore.setState({ worldThumbnail: thumbnail });
      const saved = saveWorld(world);
      useGameStore.getState().setNotice(saved ? translate('Photo téléchargée et ajoutée à l’image du monde !', 'Photo downloaded and set as the world image!') : translate('Photo téléchargée, mais la vignette n’a pas pu être sauvegardée.', 'Photo downloaded, but the world image could not be saved.'));
    } catch {
      useGameStore.getState().setNotice(translate('Impossible de prendre la photo pour le moment.', 'Unable to take a photo right now.'));
    }
  };
  const openShop = () => {
    useGameStore.getState().setShopOpen(true);
    useGameStore.getState().setMode('pause');
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const openConstruction = () => {
    useConstructionStore.getState().setOpen(true);
    useGameStore.getState().setMode('pause');
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const openTribe = () => {
    releasePointerForOverlay();
    useTribeStore.getState().setPanelOpen(true);
    useGameStore.getState().setMode('pause');
  };
  return (
    <div className="hud">
      {mode === 'play' && (
        <>
          <div className="crosshair" aria-hidden="true"><i /><b /></div>
          <button className="screenshot-toggle" type="button" onClick={() => { void takePhoto(); }} aria-label={translate('Prendre une photo pixelisée du jeu', 'Take a pixelated photo of the game')}>{translate('PHOTO', 'PHOTO', 'FOTO')}</button>
          {miningProgress > 0 && <div className="mining-meter"><div className="mining-fill" style={{ width: `${miningProgress * 100}%` }} /></div>}
          {!['pirates', 'football', 'maze'].includes(gameplayMode) && <button className="backpack-toggle" onClick={openBackpack} aria-label={translate('Sac à dos', 'Backpack')}><img src={translate(backpackButtonFrUrl, backpackButtonEnUrl, backpackButtonEsUrl)} alt="" /></button>}
          {!['pirates', 'football', 'maze', 'battle'].includes(gameplayMode) && <button className="shop-toggle" onClick={openShop} aria-label={translate('Boutique', 'Shop')}><img src={translate(shopButtonFrUrl, shopButtonEnUrl, shopButtonEsUrl)} alt="" /></button>}
          {!['pirates', 'football', 'maze', 'battle'].includes(gameplayMode) && <button className="construction-toggle" onClick={openConstruction} aria-label={translate('Construction · C', 'Construction · C')}><img src={constructionButtonUrl} alt={translate('Construction', 'Construction')} /></button>}
          {!['football', 'pirates', 'battle', 'maze'].includes(gameplayMode) && <button className="teleport-toggle" onClick={openTeleport} aria-label={translate('Téléportation · T', 'Teleportation · T')}>{language === 'es' ? <span className="localized-button-text">TELETRANSPORTE · T</span> : <img src={teleportButtonUrl} alt={translate('Téléportation · T', 'Teleportation · T')} />}</button>}
          {multiplayerReady && <button className="tribe-toggle" onClick={openTribe} aria-label={translate('Ouvrir ma tribu', 'Open my tribe')}>{language === 'es' ? <span className="localized-button-text">TRIBU</span> : <img src={tribeButtonUrl} alt="TRIBU" />}{tribeInvitations > 0 && <span className="tribe-invitation-count">{tribeInvitations}</span>}</button>}
          {notice && <div className="game-notice">{notice}</div>}
          <EffectsHud />
          <SirenButton />
          <RadioControls />
          <VehiclePassengers />
          <TouchControls />
        </>
      )}
      <Minimap />

      <TeleportPanel />
      <ChatPanel />
      <TribePanel />
      <BattleHud />
      <PiratesHud />
      <FootballHud />
      <MazeHud />
      <EmotePanel />
      <PaintballPalette />
      <PlaneTitleEditor />
      <PoliceTitleEditor />

      {mode !== 'play' && !teamSelection && !teleportRequestOpen && !backpackOpen && !shopOpen && !constructionOpen && !teleportOpen && !containerOpen && !bookOpen && !seatChoice && !signOpen && !chatOpen && !emoteOpen && !tradeOpen && !companionOpen && !homeOpen && !tribeOpen && (
        <GameMenu paused={mode === 'pause'} onPlay={requestPlay} onShop={openShop} />
      )}

      {mode === 'play' && (
        <div className="hotbar-wrap">
          {gameplayMode === 'survival' && <div className="survival-health" aria-label={`${lives} vies sur 10`}><span>{translate('Vies', 'Lives')}</span><div><i style={{ width: `${Math.max(0, Math.min(100, lives * 10))}%` }} /></div><strong>{lives}/10</strong></div>}
          <div className="selected-name" role="status">
            {selectionInfo(selected).name}
            {selected === 'pistol_bomb' && ` · ${bombAmmo}/10${bombReloading ? ' · 3-second reload…' : ''}`}
          </div>
          <div className="hotbar">
            {hotbarSlots.map((kind, index) => (
              <button
                key={`${kind ?? translate('vide', 'empty')}-${index}`}
                className={`hotbar-slot ${selectedSlot === index && selected === kind ? 'selected' : ''}`}
                onClick={() => {
                  if (kind === null) return;
                  selectBlock(kind, index);
                }}
                disabled={kind === null}
                aria-label={`${index + 1} : ${kind === null ? translate('vide', 'empty') : selectionInfo(kind).name}`}
              >
                <span className="slot-number">{index === 9 ? '0' : index + 1}</span>
                {kind !== null && <ItemIcon kind={kind} />}
                {gameplayMode === 'survival' && kind !== null && inventoryCount(kind, { gameplayMode, itemCounts, apples }) > 1 && <span className="slot-count">{inventoryCount(kind, { gameplayMode, itemCounts, apples })}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      <Backpack />
      <BoutiquePanel />
      <ConstructionPanel />
      <BlueprintControls />
      <ContainerPanel />
      <BookPanel />
      <SignPanel />
      <SeatChoicePanel />
      <TradingPanel />
      <CompanionPanel />
      <HomePanel />
      <TeleportRequestDialog />
      <FriendRequestDialog />
      {sleepProgress !== null && (
        <div className="sleep-overlay" style={{ backgroundColor: `rgba(0, 0, 0, ${0.05 + sleepProgress * 0.35})` }}>
          <span className="sleep-zzz" aria-hidden="true">Z Z Z</span>
          <p>{sleepProgress > 0.65 ? dayProgress >= 0.22 && dayProgress < 0.5 ? translate('La nuit tombe…', 'Night is falling…') : translate('Le jour se lève…', 'Day is breaking…') : translate('Tu dors…', 'You are sleeping…')}</p>
        </div>
      )}
    </div>
  );
}
