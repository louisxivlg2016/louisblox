import { requestPlay } from '../game/input';
import { BIOME_NAMES } from '../game/levels';
import { MEAT_NAMES } from '../game/meats';
import { useGameStore } from '../game/store';
import { BLOCK_INFO, HOTBAR_BLOCKS } from '../game/voxel';
import { Backpack } from './Backpack';
import { TouchControls } from './TouchControls';

const WEATHER_NAMES = { clear: 'Ciel clair', rain: 'Pluie', snow: 'Neige' } as const;

export function Hud() {
  const mode = useGameStore((state) => state.mode);
  const selected = useGameStore((state) => state.selected);
  const blockCount = useGameStore((state) => state.blockCount);
  const apples = useGameStore((state) => state.apples);
  const meat = useGameStore((state) => state.meat);
  const miningProgress = useGameStore((state) => state.miningProgress);
  const flying = useGameStore((state) => state.flying);
  const backpackOpen = useGameStore((state) => state.backpackOpen);
  const coordinates = useGameStore((state) => state.coordinates);
  const environment = useGameStore((state) => state.environment);
  const selectBlock = useGameStore((state) => state.selectBlock);
  const setBackpack = useGameStore((state) => state.setBackpack);
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
            {flying && <span className="weather-info flight-status">Vol activé</span>}
          </div>
          <button className="backpack-toggle" onClick={openBackpack}>Sac à dos</button>
          <div className="controls-hint">
            <span><strong>WASD / FLÈCHES</strong> se déplacer</span>
            <span><strong>ESPACE</strong> sauter / monter en vol</span>
            <span><strong>2× ESPACE</strong> activer / quitter le vol</span>
            <span><strong>MAJ</strong> accélérer</span>
            <span><strong>C</strong> descendre en vol</span>
          </div>
          <div className="action-hint">Clic gauche <strong>casser / frapper</strong> · Clic droit <strong>poser</strong> · <strong>E</strong> poser / cueillir</div>
          <TouchControls />
        </>
      )}

      {mode !== 'play' && !backpackOpen && (
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
          <div className="selected-name">{BLOCK_INFO[selected].name}</div>
          <div className="hotbar">
            {HOTBAR_BLOCKS.map((kind, index) => (
              <button
                key={kind}
                className={`hotbar-slot ${selected === kind ? 'selected' : ''}`}
                onClick={() => selectBlock(kind)}
                aria-label={`${index + 1} : ${BLOCK_INFO[kind].name}`}
              >
                <span className="slot-number">{index === 9 ? '0' : index + 1}</span>
                <span className="block-swatch" style={{ backgroundColor: BLOCK_INFO[kind].color }} />
              </button>
            ))}
          </div>
        </div>
      )}
      <Backpack />
    </div>
  );
}
