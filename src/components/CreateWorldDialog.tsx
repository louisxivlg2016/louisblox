import { useState } from 'react';
import { MenuDialog } from './MenuDialog';
import type { WorldTemplate } from '../game/worldMode';

export type CreateWorldOptions = {
  mode: 'survival' | 'creative';
  template: WorldTemplate;
  multiplayer: boolean;
  canBreak: boolean;
  canPlace: boolean;
};

export function CreateWorldDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (options: CreateWorldOptions) => void }) {
  const [options, setOptions] = useState<CreateWorldOptions>({ mode: 'creative', template: 'nature', multiplayer: false, canBreak: true, canPlace: true });
  const change = <K extends keyof CreateWorldOptions>(key: K, value: CreateWorldOptions[K]) => setOptions((current) => ({ ...current, [key]: value }));
  return (
    <MenuDialog title="Créer un monde" onClose={onClose} className="create-world-dialog">
      <form className="create-world-form" onSubmit={(event) => { event.preventDefault(); onCreate(options); }}>
        <div className="world-library-heading"><h2>Créer un monde</h2></div>
        <fieldset>
          <legend>Qui peut rejoindre ce monde ?</legend>
          <label><input type="radio" name="world-sharing" checked={!options.multiplayer} onChange={() => change('multiplayer', false)} /> Solo</label>
          <label><input type="radio" name="world-sharing" checked={options.multiplayer} onChange={() => change('multiplayer', true)} /> Multijoueur</label>
        </fieldset>
        <label htmlFor="create-world-mode">Mode de jeu
          <select id="create-world-mode" value={options.mode} onChange={(event) => change('mode', event.target.value as CreateWorldOptions['mode'])}>
            <option value="creative">Créatif</option>
            <option value="survival">Survie</option>
          </select>
        </label>
        <label htmlFor="create-world-template">Terrain
          <select id="create-world-template" value={options.template} onChange={(event) => change('template', event.target.value as WorldTemplate)}>
            <option value="nature">Monde naturel infini</option>
            <option value="city-ancient">Ville ancienne déjà construite</option>
            <option value="city-modern">Ville moderne déjà construite</option>
          </select>
        </label>
        <fieldset>
          <legend>Autorisations des autres joueurs</legend>
          <label className="protection-option"><input type="checkbox" checked={options.canBreak} onChange={(event) => change('canBreak', event.target.checked)} /> Casser des blocs</label>
          <label className="protection-option"><input type="checkbox" checked={options.canPlace} onChange={(event) => change('canPlace', event.target.checked)} /> Poser des blocs</label>
        </fieldset>
        <button className="primary-button" type="submit">Créer le monde</button>
      </form>
    </MenuDialog>
  );
}
