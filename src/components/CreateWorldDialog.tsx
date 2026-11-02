import { useState } from 'react';
import { MenuDialog } from './MenuDialog';
import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';

const MODES: GameplayMode[] = ['survival', 'creative', 'city-ancient', 'city-modern'];

export function CreateWorldDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (mode: GameplayMode, multiplayer: boolean) => void }) {
  const [multiplayer, setMultiplayer] = useState(false);
  const [mode, setMode] = useState<GameplayMode>('creative');
  return (
    <MenuDialog title="Créer un monde" onClose={onClose} className="create-world-dialog">
      <form className="create-world-form" onSubmit={(event) => { event.preventDefault(); onCreate(mode, multiplayer); }}>
        <div className="world-library-heading"><h2>Créer un monde</h2></div>
        <fieldset>
          <legend>Qui peut rejoindre ce monde ?</legend>
          <label><input type="radio" name="world-sharing" checked={!multiplayer} onChange={() => setMultiplayer(false)} /> Solo</label>
          <label><input type="radio" name="world-sharing" checked={multiplayer} onChange={() => setMultiplayer(true)} /> Multijoueur</label>
        </fieldset>
        <label htmlFor="create-world-mode">Type de monde
          <select id="create-world-mode" value={mode} onChange={(event) => setMode(event.target.value as GameplayMode)}>
            {MODES.map((value) => <option key={value} value={value}>{GAMEPLAY_MODE_LABELS[value]}</option>)}
          </select>
        </label>
        <button className="primary-button" type="submit">Créer le monde</button>
      </form>
    </MenuDialog>
  );
}
