import { requestPlay } from '../game/input';
import { BIOME_NAMES } from '../game/levels';
import type { Biome } from '../game/levels';
import { MEAT_NAMES } from '../game/meats';
import { useGameStore } from '../game/store';
import { teleportToBiome } from '../game/teleport';
import { selectionInfo } from '../game/items';
import { ItemIcon } from './ItemIcon';
import { world } from '../game/world';
import { Backpack } from './Backpack';
import { ContainerPanel } from './ContainerPanel';
import { TouchControls } from './TouchControls';
import { BookPanel } from './BookPanel';
import { SeatChoicePanel } from './SeatChoicePanel';

const WEATHER_NAMES = { clear: 'Ciel clair', rain: 'Pluie', snow: 'Neige' } as const;
const DESTINATIONS: Biome[] = ['winter', 'autumn', 'forest', 'prairie'];

export function Hud() {
  const mode = useGameStore((state) => state.mode);
  const selected = useGameStore((state) => state.selected);
  const hotbarSlots = useGameStore((state) => state.hotbarSlots);
  const blockCount = useGameStore((state) => state.blockCount);
  const apples = useGameStore((state) => state.apples);
  const meat = useGameStore((state) => state.meat);
  const miningProgress = useGameStore((state) => state.miningProgress);
  const flying = useGameStore((state) => state.flying);
  const riding = useGameStore((state) => state.riding);
  const ridingRole = useGameStore((state) => state.ridingRole);
  const notice = useGameStore((state) => state.notice);
  const equippedArmor = useGameStore((state) => state.equippedArmor);
  const lives = useGameStore((state) => state.lives);
  const backpackOpen = useGameStore((state) => state.backpackOpen);
  const teleportOpen = useGameStore((state) => state.teleportOpen);
  const containerOpen = useGameStore((state) => state.container !== null);
  const bookOpen = useGameStore((state) => state.bookOpen);
  const seatChoice = useGameStore((state) => state.seatChoice);
  const sleepProgress = useGameStore((state) => state.sleepProgress);
  const coordinates = useGameStore((state) => state.coordinates);
  const environment = useGameStore((state) => state.environment);
  const selectBlock = useGameStore((state) => state.selectBlock);
  const setBackpack = useGameStore((state) => state.setBackpack);
  const setTeleportOpen = useGameStore((state) => state.setTeleportOpen);
  const regenerate = useGameStore((state) => state.regenerate);
  const totalMinutes = Math.floor(environment.dayProgress * 24 * 60);
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  const meatSummary = Object.entries(meat)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${MEAT_NAMES[kind as keyof typeof MEAT_NAMES]} ×${count}`)
    .join(' · ');
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
  const travel = (biome: Biome) => {
    teleportToBiome(world, biome);
    setTeleportOpen(false);
    void requestPlay();
  };

  return (
    <div className="hud">
      {mode === 'play' && (
        <>
          <div className="crosshair" aria-hidden="true"><i /><b /></div>
          {miningProgress > 0 && <div className="mining-meter"><div className="mining-fill" style={{ width: `${miningProgress * 100}%` }} /></div>}
          <div className="world-stats">
            <strong className="block-count">{blockCount.toLocaleString('fr-FR')}</strong> blocs chargés
            <span className="coordinates">XYZ {coordinates.x.toFixed(2)} / {coordinates.y.toFixed(2)} / {coordinates.z.toFixed(2)}</span>
            <span className="biome-info">{BIOME_NAMES[environment.biome]} · {hours}:{minutes}</span>
            <span className={`weather-info ${environment.weather}`}>{WEATHER_NAMES[environment.weather]}</span>
            <span className="weather-info apple-count">Pommes : {apples}</span>
            <span className="weather-info meat-count">Viandes : {meatSummary || 'aucune'}</span>
            <span className="weather-info lives-count">Vies : {lives}/10</span>
            {equippedArmor && <span className="weather-info">Armure : {equippedArmor}</span>}
            {riding && <span className="weather-info">{riding === 'car' ? 'Au volant · E pour sortir' : riding === 'horse' ? 'À cheval · E pour descendre' : `${riding === 'plane' ? 'Avion' : 'Train'} · ${ridingRole === 'passenger' ? 'Passager' : 'Conducteur'} · E pour descendre`}</span>}
            {flying && <span className="weather-info flight-status">Vol activé</span>}
          </div>
          <button className="backpack-toggle" onClick={openBackpack}>Sac à dos</button>
          <button className="teleport-toggle" onClick={openTeleport}>Téléportation · T</button>
          <div className="controls-hint">
            <span><strong>WASD / FLÈCHES</strong> se déplacer / conduire</span>
            <span><strong>ESPACE</strong> sauter / remonter / voler</span>
            <span><strong>2× ESPACE</strong> activer / quitter le vol</span>
            <span><strong>MAJ</strong> accélérer</span>
            <span><strong>C</strong> plonger / descendre</span>
            <span><strong>P / F5</strong> changer de caméra</span>
          </div>
          <div className="action-hint">Clic gauche <strong>casser / frapper / tirer</strong> · <strong>E</strong> poser / utiliser / monter</div>
          {notice && <div className="game-notice">{notice}</div>}
          <TouchControls />
        </>
      )}

      {teleportOpen && (
        <div className="teleport-panel">
          <strong>Se téléporter</strong>
          {DESTINATIONS.map((biome) => (
            <button key={biome} onClick={() => travel(biome)}>{BIOME_NAMES[biome]}</button>
          ))}
        </div>
      )}

      {mode !== 'play' && !backpackOpen && !teleportOpen && !containerOpen && !bookOpen && !seatChoice && (
        <div className="menu-backdrop">
          <section className="menu-panel">
            <div className="brand-mark" aria-hidden="true"><span>L</span></div>
            <p className="eyebrow">BIENVENUE DANS</p>
            <h1>LOUISBLOX</h1>
            <p className="tagline">Explore. Casse. Construis.</p>
            <div className="menu-rule" />
            {mode === 'pause' && <p className="pause-label">PARTIE EN PAUSE</p>}
            <button className="primary-button" onClick={requestPlay}>
              {mode === 'pause' ? 'Reprendre la partie' : 'Entrer dans le monde'}
            </button>
            <button className="secondary-button" onClick={regenerate}>Générer un nouveau monde</button>
            <div className="menu-help">
              <span><kbd>WASD / FLÈCHES</kbd> Déplacement</span>
              <span><kbd>SOURIS</kbd> Regarder</span>
              <span><kbd>1 — 0</kbd> Choisir un bloc</span>
              <span><kbd>ÉCHAP</kbd> Pause</span>
            </div>
          </section>
        </div>
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
      <ContainerPanel />
      <BookPanel />
      <SeatChoicePanel />
      {sleepProgress !== null && (
        <div className="sleep-overlay" style={{ backgroundColor: `rgba(0, 0, 0, ${0.15 + sleepProgress * 0.8})` }}>
          <p>{sleepProgress > 0.65 ? 'Le jour se lève…' : 'Tu dors…'}</p>
        </div>
      )}
    </div>
  );
}
