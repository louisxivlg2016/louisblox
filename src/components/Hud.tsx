import { requestPlay } from '../game/input';
import { useGameStore } from '../game/store';
import { selectionInfo } from '../game/items';
import { ItemIcon } from './ItemIcon';
import { Backpack } from './Backpack';
import { BoutiquePanel } from './BoutiquePanel';
import { ContainerPanel } from './ContainerPanel';
import { TouchControls } from './TouchControls';
import { BookPanel } from './BookPanel';
import { SignPanel } from './SignPanel';
import { useSignStore } from '../game/signs';
import { SeatChoicePanel } from './SeatChoicePanel';
import { GameMenu } from './GameMenu';
import { WorldStats } from './WorldStats';
import { TeleportPanel, TeleportRequestDialog } from './TeleportRequests';
import { useTeleportRequestStore } from '../game/teleportRequests';

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
          <WorldStats />
          <button className="backpack-toggle" onClick={openBackpack}>Sac à dos</button>
          <button className="shop-toggle" onClick={openShop}>Boutique</button>
          <button className="teleport-toggle" onClick={openTeleport}>Téléportation · T</button>
          <div className="controls-hint">
            <span><strong>WASD / FLÈCHES</strong> se déplacer / conduire</span>
            <span><strong>ESPACE</strong> sauter / remonter / voler</span>
            <span><strong>2× ESPACE</strong> activer / quitter le vol</span>
            <span><strong>MAJ</strong> accélérer</span>
            <span><strong>C</strong> plonger / descendre</span>
            <span><strong>B</strong> boutique</span>
            <span><strong>P / F5</strong> changer de caméra</span>
          </div>
          <div className="action-hint">Clic gauche <strong>casser / frapper / tirer</strong> · <strong>E</strong> poser / utiliser / monter</div>
          {notice && <div className="game-notice">{notice}</div>}
          <TouchControls />
        </>
      )}

      <TeleportPanel />

      {mode !== 'play' && !teleportRequestOpen && !backpackOpen && !shopOpen && !teleportOpen && !containerOpen && !bookOpen && !seatChoice && !signOpen && (
        <GameMenu paused={mode === 'pause'} onPlay={requestPlay} onShop={openShop} />
      )}

      {mode !== 'menu' && (
        <div className="hotbar-wrap">
          <div className="selected-name">{selectionInfo(selected).name}</div>
          <div className="hotbar">
            {hotbarSlots.map((kind, index) => (
              <button
                key={`${kind}-${index}`}
                className={`hotbar-slot ${selected === kind ? 'selected' : ''}`}
                onClick={() => selectBlock(kind)}
                aria-label={`${index + 1} : ${selectionInfo(kind).name}`}
              >
                <span className="slot-number">{index === 9 ? '0' : index + 1}</span>
                <ItemIcon kind={kind} />
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
      <TeleportRequestDialog />
      {sleepProgress !== null && (
        <div className="sleep-overlay" style={{ backgroundColor: `rgba(0, 0, 0, ${0.05 + sleepProgress * 0.35})` }}>
          <span className="sleep-zzz" aria-hidden="true">Z Z Z</span>
          <p>{sleepProgress > 0.65 ? 'Le jour se lève…' : 'Tu dors…'}</p>
        </div>
      )}
    </div>
  );
}
