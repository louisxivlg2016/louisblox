import { useState } from 'react';
import { MenuDialog } from './MenuDialog';
import { WorldEditor } from './WorldEditor';
import { MultiplayerLobby } from './MultiplayerLobby';
import { heightAt } from '../game/levels';
import { normalizeRoomId } from '../game/multiplayerStore';
import { readEditorDraft, writeEditorDraft } from '../game/editorDraft';
import { BLOCK_INFO, BlockKind } from '../game/voxel';
import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';
import type { GameplayMode, WorldTemplate } from '../game/worldMode';
import { createCustomWorld, CUSTOM_WORLD_MAX_SOURCE, DEFAULT_WORLD_SOURCE, EDITOR_BLOCK_CATEGORIES, worldCodeFromBlocks, worldBlockId } from '../game/worldCode';
import type { CustomTerrain, CustomWorldDefinition } from '../game/worldCode';
import { ItemIcon } from './ItemIcon';
import worldTabUrl from '../../assets/menu/world-tab.webp';
import createLobbyTabUrl from '../../assets/menu/create-lobby-tab.webp';
import worldCodeTabUrl from '../../assets/menu/world-code-tab.webp';
import worldEditorTabUrl from '../../assets/menu/world-editor-tab.webp';

export type CreateWorldOptions = {
  name: string;
  mode: GameplayMode;
  template: WorldTemplate;
  multiplayer: boolean;
  canBreak: boolean;
  canPlace: boolean;
  allowDestructiveFire: boolean;
  allowCampfire: boolean;
  allowFloodingWater: boolean;
  allowCalmWater: boolean;
  customWorld?: CustomWorldDefinition;
};

export function createLobbyOptions(options: CreateWorldOptions, room: string, mode: GameplayMode | null): CreateWorldOptions {
  return { ...options, name: room.trim().slice(0, 48) || options.name, mode: mode ?? options.mode, multiplayer: true };
}

const initialWorld = createCustomWorld(DEFAULT_WORLD_SOURCE, 73421);
const CREATE_WORLD_TABS = [
  ['world', 'Monde', worldTabUrl],
  ['lobby', 'Créer ton salon', createLobbyTabUrl],
  ['code', 'Code du monde', worldCodeTabUrl],
  ['editor', 'Éditeur 3D', worldEditorTabUrl],
] as const;

function seedFromName(name: string) {
  return [...normalizeRoomId(name || 'Monde personnalisé')].reduce((value, letter) => Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0, 2166136261) % 900000;
}

export function CreateWorldDialog({ onClose, onCreate, onPlay }: { onClose: () => void; onCreate: (options: CreateWorldOptions) => void; onPlay: () => void | Promise<void> }) {
  const [draft] = useState(readEditorDraft);
  const [options, setOptions] = useState<CreateWorldOptions>({ name: draft?.name ?? 'Mon aventure', mode: 'creative', template: draft ? 'custom' : 'nature', multiplayer: false, canBreak: true, canPlace: true, allowDestructiveFire: true, allowCampfire: true, allowFloodingWater: true, allowCalmWater: true });
  const [tab, setTab] = useState<'world' | 'lobby' | 'code' | 'editor'>(draft ? 'editor' : 'world');
  const [source, setSource] = useState(draft?.world.source ?? DEFAULT_WORLD_SOURCE);
  const [terrain, setTerrain] = useState<CustomTerrain>(draft?.world.terrain ?? initialWorld.terrain);
  const [infiniteEditor, setInfiniteEditor] = useState(draft?.world.infinite === true);
  const [blocks, setBlocks] = useState(draft?.world.blocks ?? initialWorld.blocks);
  const [sourceDirty, setSourceDirty] = useState(draft?.sourceDirty ?? false);
  const [message, setMessage] = useState(draft ? 'Ton brouillon a été restauré.' : 'Exécute le code pour voir le résultat dans l’éditeur.');
  const [draftNotice, setDraftNotice] = useState(draft ? 'Brouillon restauré' : '');
  const [insertKind, setInsertKind] = useState<BlockKind>(BlockKind.OakPlanks);
  const change = <K extends keyof CreateWorldOptions>(key: K, value: CreateWorldOptions[K]) => {
    setDraftNotice('');
    setOptions((current) => ({ ...current, [key]: value }));
  };
  const openTab = (next: typeof tab) => {
    setTab(next);
    if (next === 'code' || next === 'editor') change('template', 'custom');
    if (next === 'lobby') change('multiplayer', true);
  };
  const changeSource = (value: string) => {
    setSource(value);
    setSourceDirty(true);
    setDraftNotice('');
  };
  const runCode = () => {
    try {
      const result = createCustomWorld(source, seedFromName(options.name), (x, z) => heightAt(x, z, seedFromName(options.name)), infiniteEditor);
      setTerrain(result.terrain);
      setBlocks(result.blocks);
      setSourceDirty(false);
      setDraftNotice('');
      setMessage(`Code exécuté : ${result.blocks.length} bloc${result.blocks.length > 1 ? 's' : ''}. Tu peux maintenant modifier la construction dans l’éditeur.`);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Le code contient une erreur.');
      setTab('code');
      return false;
    }
  };
  const resetCode = () => {
    if ((source.trim() || blocks.length > 0) && !window.confirm('Effacer le code et tous les blocs de l’éditeur ? Le brouillon déjà sauvegardé sera conservé tant que tu ne cliques pas sur Sauvegarder.')) return;
    setSource('');
    setTerrain('flat');
    setBlocks([]);
    setSourceDirty(false);
    setDraftNotice('');
    setMessage('Zone vide : écris ton nouveau code depuis zéro, puis exécute-le.');
    setTab('code');
    window.requestAnimationFrame(() => document.getElementById('world-code')?.focus());
  };
  const changeInfinite = (value: boolean) => {
    if (!value && blocks.some((block) => Math.abs(block.x) > 32 || Math.abs(block.z) > 32)) {
      setDraftNotice('Retire d’abord les blocs hors de la zone finie 65 × 65');
      return;
    }
    setInfiniteEditor(value);
    if (!value && source.trim()) setSourceDirty(true);
    setDraftNotice(value ? 'Éditeur infini' : 'Éditeur fini · exécute le code pour vérifier les coordonnées');
    setMessage(value ? 'Le terrain suit maintenant le joueur. Utilise Aller à X, Y, Z pour explorer le monde.' : 'Mode fini 65 × 65. Exécute le code pour vérifier les coordonnées.');
  };
  const saveDraft = () => {
    const saved = writeEditorDraft(options.name, { version: 1, source, terrain, blocks, ...(infiniteEditor ? { infinite: true } : {}) }, sourceDirty);
    setDraftNotice(saved ? 'Brouillon sauvegardé' : 'Sauvegarde impossible');
    if (saved) setMessage('Brouillon sauvegardé sur cet appareil. Tu peux fermer et reprendre plus tard.');
    return saved;
  };
  const submit = (nextOptions = options) => {
    if (nextOptions.template === 'custom' && sourceDirty) {
      setTab('code');
      setMessage('Exécute d’abord le code modifié pour l’ajouter au monde et au salon.');
      return;
    }
    if (!nextOptions.name.trim()) {
      setTab('world');
      setMessage('Donne un nom à ton monde avant de continuer.');
      return;
    }
    onCreate({ ...nextOptions, customWorld: nextOptions.template === 'custom' ? { version: 1, source, terrain, blocks, ...(infiniteEditor ? { infinite: true } : {}) } : undefined });
  };
  const createLobbyRoom = (room: string, mode: GameplayMode | null) => submit(createLobbyOptions(options, room, mode));
  return (
    <MenuDialog title="Créer un monde" onClose={onClose} className="create-world-dialog">
      <div className="create-world-form">
        <div className="world-library-heading"><div><h2>Créer un monde</h2><p>Choisis un terrain, programme-le, construis-le ou crée ton salon.</p></div></div>
        <div className="create-world-tabs" role="tablist" aria-label="Création du monde">
          {CREATE_WORLD_TABS.map(([id, label, image]) => <button type="button" role="tab" id={`create-tab-${id}`} aria-label={label} aria-selected={tab === id} aria-controls={`create-panel-${id}`} className={tab === id ? 'selected' : ''} key={id} onClick={() => openTab(id)}><img src={image} alt="" /></button>)}
        </div>
        {tab === 'world' && <div id="create-panel-world" role="tabpanel" aria-labelledby="create-tab-world" className="create-world-settings">
          <label htmlFor="world-name">Nom du monde
            <input id="world-name" value={options.name} onChange={(event) => change('name', event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }} placeholder="Nom de ton monde" maxLength={48} required autoFocus />
          </label>
          <fieldset>
            <legend>Qui peut rejoindre ce monde ?</legend>
            <label><input type="radio" name="world-sharing" checked={!options.multiplayer} onChange={() => change('multiplayer', false)} /> Solo</label>
            <label><input type="radio" name="world-sharing" checked={options.multiplayer} onChange={() => change('multiplayer', true)} /> Multijoueur</label>
          </fieldset>
          <label htmlFor="create-world-mode">Mode de jeu
            <select id="create-world-mode" value={options.mode} onChange={(event) => change('mode', event.target.value as GameplayMode)}>
              {Object.entries(GAMEPLAY_MODE_LABELS).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
            </select>
          </label>
          <label htmlFor="create-world-template">Terrain
            <select id="create-world-template" value={options.template} onChange={(event) => { const template = event.target.value as WorldTemplate; change('template', template); if (template === 'custom') openTab('editor'); }}>
              <option value="nature">Monde naturel infini</option>
              <option value="city-ancient">Ville ancienne déjà construite</option>
              <option value="city-modern">Ville moderne déjà construite</option>
              <option value="custom">Monde personnalisé · code et éditeur</option>
            </select>
          </label>
          {options.template === 'custom' && <div className="create-custom-summary"><strong>Ton monde personnalisé</strong><span>{terrain === 'flat' ? 'Terrain plat infini' : 'Paysage naturel infini'} · {blocks.length} blocs · {infiniteEditor ? 'éditeur infini' : 'éditeur fini 65 × 65'}</span><button type="button" className="secondary-button" onClick={() => openTab('editor')}>Ouvrir l’éditeur 3D</button><button type="button" className="secondary-button" onClick={() => openTab('code')}>Écrire du code</button></div>}
          <fieldset>
            <legend>Autorisations des autres joueurs</legend>
            <label className="protection-option"><input type="checkbox" checked={options.canBreak} onChange={(event) => change('canBreak', event.target.checked)} /> Casser des blocs</label>
            <label className="protection-option"><input type="checkbox" checked={options.canPlace} onChange={(event) => change('canPlace', event.target.checked)} /> Poser des blocs</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowDestructiveFire} onChange={(event) => change('allowDestructiveFire', event.target.checked)} /> Feu rouge destructeur</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowCampfire} onChange={(event) => change('allowCampfire', event.target.checked)} /> Feu de camp non destructeur</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowFloodingWater} onChange={(event) => change('allowFloodingWater', event.target.checked)} /> Eau avec inondation</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowCalmWater} onChange={(event) => change('allowCalmWater', event.target.checked)} /> Eau calme sans inondation</label>
          </fieldset>
        </div>}
        {tab === 'lobby' && <div id="create-panel-lobby" role="tabpanel" aria-labelledby="create-tab-lobby" className="create-lobby-panel">
          <p className="create-lobby-intro">Choisis ton pseudo et le nom du salon. Si tu as construit un monde avec le code ou l’éditeur, il sera utilisé pour ton salon.</p>
          <MultiplayerLobby onPlay={() => { onClose(); return onPlay(); }} onCreateRoom={createLobbyRoom} createLabel="Créer ton salon" showWhenDisabled idPrefix="create-world" />
        </div>}
        {tab === 'code' && <div id="create-panel-code" role="tabpanel" aria-labelledby="create-tab-code" className="world-code-workspace">
          <div className="world-code-editor">
            <label htmlFor="world-code">JavaScript simplifié et sécurisé</label>
            <textarea id="world-code" value={source} onChange={(event) => changeSource(event.target.value)} maxLength={CUSTOM_WORLD_MAX_SOURCE} spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-describedby="world-code-message" placeholder="Écris ton code ici depuis zéro…" />
            <div className="world-code-actions"><button type="button" className="primary-button" onClick={runCode}>Exécuter le code</button><button type="button" className="secondary-button" onClick={resetCode}>Partir de zéro</button><button type="button" className="secondary-button" onClick={() => { changeSource(DEFAULT_WORLD_SOURCE); setMessage('Exemple chargé. Exécute-le pour remplacer la construction.'); }}>Exemple</button><button type="button" className="secondary-button" onClick={() => { setSource(worldCodeFromBlocks({ terrain, blocks })); setSourceDirty(false); setDraftNotice(''); setMessage('Le code correspond maintenant à la construction de l’éditeur.'); }}>Construction → code</button></div>
            <p id="world-code-message" className={sourceDirty || message.startsWith('Ligne') ? 'world-code-message warning' : 'world-code-message'} role="status">{sourceDirty ? 'Code modifié : exécute-le avant de créer le monde. ' : ''}{message}</p>
          </div>
          <aside className="world-code-help">
            <h3>Commandes disponibles</h3>
            <dl><div><dt>terrain("plat")</dt><dd>Ou "nature" pour le paysage infini.</dd></div><div><dt>bloc(x, y, z, "pierre")</dt><dd>Pose un bloc. Ajoute <code>true</code> en dernier argument pour le rendre incassable.</dd></div><div><dt>remplir(x1, y1, z1, x2, y2, z2, "bois")</dt><dd>Remplit un volume. Le dernier <code>true</code> facultatif protège aussi les blocs.</dd></div><div><dt>sphere(x, y, z, rayon, "verre")</dt><dd>Construit une sphère.</dd></div><div><dt>effacer(x, y, z)</dt><dd>Retire un bloc du code.</dd></div><div><dt>hauteur(x, z)</dt><dd>Hauteur du sol naturel.</dd></div><div><dt>aleatoire()</dt><dd>Nombre reproductible entre 0 et 1.</dd></div></dl>
            <p>Variables <code>let</code>, calculs, conditions <code>if</code> et boucles <code>for</code> acceptés. {infiniteEditor ? 'Éditeur infini : x/z libres pour explorer le monde, y de 1 à 48.' : 'Éditeur fini : x/z de −32 à 32, y de 1 à 48.'} Maximum 4 000 blocs.</p>
            <label htmlFor="world-code-block">Insérer un bloc par catégorie
              <select id="world-code-block" value={insertKind} onChange={(event) => setInsertKind(Number(event.target.value) as BlockKind)}>{EDITOR_BLOCK_CATEGORIES.map((category) => <optgroup key={category.id} label={category.name}>{category.kinds.map((kind) => <option key={kind} value={kind}>{BLOCK_INFO[kind].name}</option>)}</optgroup>)}</select>
            </label>
            <div className="world-code-insert"><ItemIcon kind={insertKind} /><code>{worldBlockId(insertKind)}</code><button type="button" className="secondary-button" onClick={() => changeSource(`${source.trimEnd()}\nbloc(0, 1, 0, "${worldBlockId(insertKind)}");`)}>Ajouter au code</button></div>
            <p className="world-code-help-note">Le code s’exécute uniquement dans le générateur. Il ne peut ni lire tes fichiers, ni ouvrir de page, ni utiliser le navigateur. Exécuter le code remplace les blocs et le terrain de l’éditeur.</p>
          </aside>
        </div>}
        {tab === 'editor' && <div id="create-panel-editor" role="tabpanel" aria-labelledby="create-tab-editor"><WorldEditor blocks={blocks} terrain={terrain} seed={seedFromName(options.name)} onChange={(next) => { setBlocks(next); setDraftNotice(''); }} onTerrainChange={(next) => { setTerrain(next); setDraftNotice(''); }} onSaveDraft={saveDraft} draftNotice={draftNotice} infinite={infiniteEditor} onInfiniteChange={changeInfinite} /></div>}
        <div className="create-world-submit"><span>{draftNotice || (options.template === 'custom' ? `${blocks.length} blocs · ${terrain === 'flat' ? 'terrain plat' : 'terrain naturel'}` : 'Ton monde sera sauvegardé dans Mes mondes.')}</span><button className="primary-button" type="button" onClick={() => submit()} disabled={options.template === 'custom' && sourceDirty}>Créer le monde</button></div>
      </div>
    </MenuDialog>
  );
}
