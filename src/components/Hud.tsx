import { requestPlay } from '../game/input';
import { useGameStore } from '../game/store';
import { selectionInfo } from '../game/items';
import { ItemIcon } from './ItemIcon';
import { PaintballPalette } from './PaintballPalette';
import backpackButtonUrl from '../../assets/ui/backpack-button.webp';
import shopButtonUrl from '../../assets/ui/shop-button.webp';
import { Backpack } from './Backpack';
import { BoutiquePanel } from './BoutiquePanel';
import { ContainerPanel } from './ContainerPanel';
import { TouchControls } from './TouchControls';
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
import { usePirateStore } from '../game/piratesClient';
import { FootballHud } from './FootballHud';
import { MazeHud } from './MazeHud';
import { FriendRequestDialog } from './FriendRequestDialog';
import { TradingPanel } from './TradingPanel';
import { useTradeStore } from '../game/trading';
import { HomePanel } from './HomePanel';
import { useHomeStore } from '../game/homes';

export function Hud() {
  const mode = useGameStore((state) => state.mode);
  const selected = useGameStore((state) => state.selected);
  const hotbarSlots = useGameStore((state) => state.hotbarSlots);
  const miningProgress = useGameStore((state) => state.miningProgress);
  const notice = useGameStore((state) => state.notice);
  const backpackOpen = useGameStore((state) => state.backpackOpen);
  const shopOpen = useGameStore((state) => state.shopOpen);
  const teleportOpen = useGameStore((state) => state.teleportOpen);
  const containerOpen = useGameStore((state) => state.container !== null);
  const bookOpen = useGameStore((state) => state.bookOpen);
  const signOpen = useSignStore((state) => state.editing !== null);
  const seatChoice = useGameStore((state) => state.seatChoice);
  const chatOpen = useChatStore((state) => state.open);
  const emoteOpen = useEmoteStore((state) => state.open);
  const tradeOpen = useTradeStore((state) => state.open);
  const homeOpen = useHomeStore((state) => state.open);
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  const battleTeam = useBattleStore((state) => state.team);
  const multiplayerReady = useMultiplayerStore((state) => state.enabled && state.status === 'online');
  const pirateKit = usePirateStore((state) => state.kit);
  const teamSelection = mode === 'pause' && multiplayerReady && ((gameplayMode === 'battle' && battleTeam === null) || (gameplayMode === 'pirates' && (battleTeam === null || pirateKit === null)) || (gameplayMode === 'football' && battleTeam === null));
  const sleepProgress = useGameStore((state) => state.sleepProgress);
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
  const openShop = () => {
    useGameStore.getState().setShopOpen(true);
    useGameStore.getState().setMode('pause');
    if (document.pointerLockElement) document.exitPointerLock();
  };
  return (
    <div className="hud">
      {mode === 'play' && (
        <>
          <div className="crosshair" aria-hidden="true"><i /><b /></div>
          {miningProgress > 0 && <div className="mining-meter"><div className="mining-fill" style={{ width: `${miningProgress * 100}%` }} /></div>}
          <button className="backpack-toggle" onClick={openBackpack} aria-label="Sac à dos"><img src={backpackButtonUrl} alt="" /></button>
          <button className="shop-toggle" onClick={openShop} aria-label="Boutique"><img src={shopButtonUrl} alt="" /></button>
          {gameplayMode !== 'football' && <button className="teleport-toggle" onClick={openTeleport}>Téléportation · T</button>}
          <div className="action-hint">{gameplayMode === 'football' ? 'Clic gauche : tir · E : tir puissant · T : tacler · G : passer' : <>Clic gauche <strong>casser / frapper / tirer</strong> · <strong>E</strong> poser / utiliser / monter</>}</div>
          {notice && <div className="game-notice">{notice}</div>}
          <EffectsHud />
          <TouchControls />
        </>
      )}

      <TeleportPanel />
      <ChatPanel />
      <BattleHud />
      <PiratesHud />
      <FootballHud />
      <MazeHud />
      <EmotePanel />
      <PaintballPalette />

      {mode !== 'play' && !teamSelection && !teleportRequestOpen && !backpackOpen && !shopOpen && !teleportOpen && !containerOpen && !bookOpen && !seatChoice && !signOpen && !chatOpen && !emoteOpen && !tradeOpen && !homeOpen && (
        <GameMenu paused={mode === 'pause'} onPlay={requestPlay} onShop={openShop} />
      )}

      {mode !== 'menu' && (
        <div className="hotbar-wrap">
          <div className="selected-name">{selectionInfo(selected).name}</div>
          <div className="hotbar">
            {hotbarSlots.map((kind, index) => (
              <button
                key={`${kind ?? 'vide'}-${index}`}
                className={`hotbar-slot ${selected === kind ? 'selected' : ''}`}
                onClick={() => { if (kind !== null) selectBlock(kind); }}
                disabled={kind === null}
                aria-label={`${index + 1} : ${kind === null ? 'vide' : selectionInfo(kind).name}`}
              >
                <span className="slot-number">{index === 9 ? '0' : index + 1}</span>
                {kind !== null && <ItemIcon kind={kind} />}
              </button>
            ))}
          </div>
        </div>
      )}
      <Backpack />
      <BoutiquePanel />
      <ContainerPanel />
      <BookPanel />
      <SignPanel />
      <SeatChoicePanel />
      <TradingPanel />
      <HomePanel />
      <TeleportRequestDialog />
      <FriendRequestDialog />
      {sleepProgress !== null && (
        <div className="sleep-overlay" style={{ backgroundColor: `rgba(0, 0, 0, ${0.05 + sleepProgress * 0.35})` }}>
          <span className="sleep-zzz" aria-hidden="true">Z Z Z</span>
          <p>{sleepProgress > 0.65 ? 'Le jour se lève…' : 'Tu dors…'}</p>
        </div>
      )}
    </div>
  );
}
