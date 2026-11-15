import { useState } from 'react';
import { MenuDialog } from './MenuDialog';
import { WorldEditor } from './WorldEditor';
import { MultiplayerLobby } from './MultiplayerLobby';
import { heightAt } from '../game/levels';
import { normalizeRoomId } from '../game/multiplayerStore';
import { readEditorDraft, writeEditorDraft } from '../game/editorDraft';
import { BlockKind } from '../game/voxel';
import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';
import type { GameplayMode, WorldTemplate } from '../game/worldMode';
import { createCustomWorld, CUSTOM_WORLD_MAX_SOURCE, DEFAULT_WORLD_SOURCE, EDITOR_BLOCK_CATEGORIES, worldCodeFromBlocks, worldBlockId } from '../game/worldCode';
import type { CustomTerrain, CustomWorldDefinition } from '../game/worldCode';
import { ItemIcon } from './ItemIcon';
import { selectionInfo } from '../game/items';
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
  ['world', 'World', worldTabUrl],
  ['lobby', 'Create your room', createLobbyTabUrl],
  ['code', 'World Code', worldCodeTabUrl],
  ['editor', '3D Editor', worldEditorTabUrl],
] as const;

function seedFromName(name: string) {
  return [...normalizeRoomId(name || 'Custom World')].reduce((value, letter) => Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0, 2166136261) % 900000;
}

export function CreateWorldDialog({ onClose, onCreate, onPlay }: { onClose: () => void; onCreate: (options: CreateWorldOptions) => void; onPlay: () => void | Promise<void> }) {
  const [draft] = useState(readEditorDraft);
  const [options, setOptions] = useState<CreateWorldOptions>({ name: draft?.name ?? 'My Adventure', mode: 'creative', template: draft ? 'custom' : 'nature', multiplayer: false, canBreak: true, canPlace: true, allowDestructiveFire: true, allowCampfire: true, allowFloodingWater: true, allowCalmWater: true });
  const [tab, setTab] = useState<'world' | 'lobby' | 'code' | 'editor'>(draft ? 'editor' : 'world');
  const [source, setSource] = useState(draft?.world.source ?? DEFAULT_WORLD_SOURCE);
  const [terrain, setTerrain] = useState<CustomTerrain>(draft?.world.terrain ?? initialWorld.terrain);
  const [infiniteEditor, setInfiniteEditor] = useState(draft?.world.infinite === true);
  const [blocks, setBlocks] = useState(draft?.world.blocks ?? initialWorld.blocks);
  const [sourceDirty, setSourceDirty] = useState(draft?.sourceDirty ?? false);
  const [message, setMessage] = useState(draft ? 'Your draft has been restored.' : 'Run the code to see the result in the editor.');
  const [draftNotice, setDraftNotice] = useState(draft ? 'Draft restored' : '');
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
      setMessage(`Code executed: ${result.blocks.length} block${result.blocks.length > 1 ? 's' : ''}. You can now edit the construction in the editor.`);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The code contains an error.');
      setTab('code');
      return false;
    }
  };
  const resetCode = () => {
    if ((source.trim() || blocks.length > 0) && !window.confirm('Clear the code and every block in the editor? The saved draft will be kept until you click Save.')) return;
    setSource('');
    setTerrain('flat');
    setBlocks([]);
    setSourceDirty(false);
    setDraftNotice('');
    setMessage('Empty area: write your new code from scratch, then run it.');
    setTab('code');
    window.requestAnimationFrame(() => document.getElementById('world-code')?.focus());
  };
  const changeInfinite = (value: boolean) => {
    if (!value && blocks.some((block) => Math.abs(block.x) > 32 || Math.abs(block.z) > 32)) {
      setDraftNotice('First remove blocks outside the finite 65 × 65 area');
      return;
    }
    setInfiniteEditor(value);
    if (!value && source.trim()) setSourceDirty(true);
    setDraftNotice(value ? 'Infinite editor' : 'Finite editor · run the code to check coordinates');
    setMessage(value ? 'Terrain now follows the player. Use Go to X, Y, Z to explore the world.' : 'Finite 65 × 65 mode. Run the code to check coordinates.');
  };
  const saveDraft = () => {
    const saved = writeEditorDraft(options.name, { version: 1, source, terrain, blocks, ...(infiniteEditor ? { infinite: true } : {}) }, sourceDirty);
    setDraftNotice(saved ? 'Draft saved' : 'Unable to save draft');
    if (saved) setMessage('Draft saved on this device. You can close it and resume later.');
    return saved;
  };
  const submit = (nextOptions = options) => {
    if (nextOptions.template === 'custom' && sourceDirty) {
      setTab('code');
      setMessage('Run the modified code first to add it to the world and room.');
      return;
    }
    if (!nextOptions.name.trim()) {
      setTab('world');
      setMessage('Name your world before continuing.');
      return;
    }
    onCreate({ ...nextOptions, customWorld: nextOptions.template === 'custom' ? { version: 1, source, terrain, blocks, ...(infiniteEditor ? { infinite: true } : {}) } : undefined });
  };
  const createLobbyRoom = (room: string, mode: GameplayMode | null) => submit(createLobbyOptions(options, room, mode));
  return (
    <MenuDialog title="Create World" onClose={onClose} className="create-world-dialog">
      <div className="create-world-form">
        <div className="world-library-heading"><div><h2>Create World</h2><p>Choose terrain, program it, build it, or create your room.</p></div></div>
        <div className="create-world-tabs" role="tablist" aria-label="World creation">
          {CREATE_WORLD_TABS.map(([id, label, image]) => <button type="button" role="tab" id={`create-tab-${id}`} aria-label={label} aria-selected={tab === id} aria-controls={`create-panel-${id}`} className={tab === id ? 'selected' : ''} key={id} onClick={() => openTab(id)}><img src={image} alt="" /></button>)}
        </div>
        {tab === 'world' && <div id="create-panel-world" role="tabpanel" aria-labelledby="create-tab-world" className="create-world-settings">
          <label htmlFor="world-name">World name
            <input id="world-name" value={options.name} onChange={(event) => change('name', event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }} placeholder="Your world name" maxLength={48} required autoFocus />
          </label>
          <fieldset>
            <legend>Who can join this world?</legend>
            <label><input type="radio" name="world-sharing" checked={!options.multiplayer} onChange={() => change('multiplayer', false)} /> Solo</label>
            <label><input type="radio" name="world-sharing" checked={options.multiplayer} onChange={() => change('multiplayer', true)} /> Multiplayer</label>
          </fieldset>
          <label htmlFor="create-world-mode">Game mode
            <select id="create-world-mode" value={options.mode} onChange={(event) => change('mode', event.target.value as GameplayMode)}>
              {Object.entries(GAMEPLAY_MODE_LABELS).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
            </select>
          </label>
          <label htmlFor="create-world-template">Terrain
            <select id="create-world-template" value={options.template} onChange={(event) => { const template = event.target.value as WorldTemplate; change('template', template); if (template === 'custom') openTab('editor'); }}>
              <option value="nature">Infinite natural world</option>
              <option value="city-ancient">Pre-built historic city</option>
              <option value="city-modern">Pre-built modern city</option>
              <option value="custom">Custom world · code and editor</option>
            </select>
          </label>
          {options.template === 'custom' && <div className="create-custom-summary"><strong>Your custom world</strong><span>{terrain === 'flat' ? 'Infinite flat terrain' : 'Infinite natural landscape'} · {blocks.length} blocks · {infiniteEditor ? 'infinite editor' : 'finite 65 × 65 editor'}</span><button type="button" className="secondary-button" onClick={() => openTab('editor')}>Open 3D editor</button><button type="button" className="secondary-button" onClick={() => openTab('code')}>Write code</button></div>}
          <fieldset>
            <legend>Other players’ permissions</legend>
            <label className="protection-option"><input type="checkbox" checked={options.canBreak} onChange={(event) => change('canBreak', event.target.checked)} /> Break blocks</label>
            <label className="protection-option"><input type="checkbox" checked={options.canPlace} onChange={(event) => change('canPlace', event.target.checked)} /> Place blocks</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowDestructiveFire} onChange={(event) => change('allowDestructiveFire', event.target.checked)} /> Destructive red fire</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowCampfire} onChange={(event) => change('allowCampfire', event.target.checked)} /> Non-destructive campfire</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowFloodingWater} onChange={(event) => change('allowFloodingWater', event.target.checked)} /> Flooding water</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowCalmWater} onChange={(event) => change('allowCalmWater', event.target.checked)} /> Calm water without flooding</label>
          </fieldset>
        </div>}
        {tab === 'lobby' && <div id="create-panel-lobby" role="tabpanel" aria-labelledby="create-tab-lobby" className="create-lobby-panel">
          <p className="create-lobby-intro">Choose your username and room name. If you built a world with code or the editor, it will be used for your room.</p>
          <MultiplayerLobby onPlay={() => { onClose(); return onPlay(); }} onCreateRoom={createLobbyRoom} createLabel="Create your room" showWhenDisabled idPrefix="create-world" />
        </div>}
        {tab === 'code' && <div id="create-panel-code" role="tabpanel" aria-labelledby="create-tab-code" className="world-code-workspace">
          <div className="world-code-editor">
            <label htmlFor="world-code">Simplified and secure JavaScript</label>
            <textarea id="world-code" value={source} onChange={(event) => changeSource(event.target.value)} maxLength={CUSTOM_WORLD_MAX_SOURCE} spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-describedby="world-code-message" placeholder="Write your code here from scratch…" />
            <div className="world-code-actions"><button type="button" className="primary-button" onClick={runCode}>Run code</button><button type="button" className="secondary-button" onClick={resetCode}>Start over</button><button type="button" className="secondary-button" onClick={() => { changeSource(DEFAULT_WORLD_SOURCE); setMessage('Example loaded. Run it to replace the construction.'); }}>Example</button><button type="button" className="secondary-button" onClick={() => { setSource(worldCodeFromBlocks({ terrain, blocks })); setSourceDirty(false); setDraftNotice(''); setMessage('The code now matches the editor construction.'); }}>Build → code</button></div>
            <p id="world-code-message" className={sourceDirty || message.startsWith('Line') ? 'world-code-message warning' : 'world-code-message'} role="status">{sourceDirty ? 'Code changed: run it before creating the world. ' : ''}{message}</p>
          </div>
          <aside className="world-code-help">
            <h3>Available commands</h3>
            <dl><div><dt>terrain("plat")</dt><dd>Or "nature" for an infinite landscape.</dd></div><div><dt>bloc(x, y, z, "pierre")</dt><dd>Place a block. Add <code>true</code> as the last argument to make it unbreakable.</dd></div><div><dt>remplir(x1, y1, z1, x2, y2, z2, "bois")</dt><dd>Fill a volume. The optional last <code>true</code> also protects blocks.</dd></div><div><dt>sphere(x, y, z, rayon, "verre")</dt><dd>Build a sphere.</dd></div><div><dt>effacer(x, y, z)</dt><dd>Remove a block from the code.</dd></div><div><dt>hauteur(x, z)</dt><dd>Natural ground height.</dd></div><div><dt>aleatoire()</dt><dd>Repeatable number between 0 and 1.</dd></div></dl>
            <p>Variables <code>let</code>, calculations, <code>if</code> conditions, and <code>for</code> loops are supported. {infiniteEditor ? 'Infinite editor: x/z are free to explore the world, y from 1 to 48.' : 'Finite editor: x/z from −32 to 32, y from 1 to 48.'} Maximum 4,000 blocks.</p>
            <label htmlFor="world-code-block">Insert block by category
              <select id="world-code-block" value={insertKind} onChange={(event) => setInsertKind(Number(event.target.value) as BlockKind)}>{EDITOR_BLOCK_CATEGORIES.map((category) => <optgroup key={category.id} label={category.name}>{category.kinds.map((kind) => <option key={kind} value={kind}>{selectionInfo(kind).name}</option>)}</optgroup>)}</select>
            </label>
            <div className="world-code-insert"><ItemIcon kind={insertKind} /><code>{worldBlockId(insertKind)}</code><button type="button" className="secondary-button" onClick={() => changeSource(`${source.trimEnd()}\nbloc(0, 1, 0, "${worldBlockId(insertKind)}");`)}>Add to code</button></div>
            <p className="world-code-help-note">Code only runs in the generator. It cannot read your files, open pages, or use the browser. Running code replaces the editor’s blocks and terrain.</p>
          </aside>
        </div>}
        {tab === 'editor' && <div id="create-panel-editor" role="tabpanel" aria-labelledby="create-tab-editor"><WorldEditor blocks={blocks} terrain={terrain} seed={seedFromName(options.name)} onChange={(next) => { setBlocks(next); setDraftNotice(''); }} onTerrainChange={(next) => { setTerrain(next); setDraftNotice(''); }} onSaveDraft={saveDraft} draftNotice={draftNotice} infinite={infiniteEditor} onInfiniteChange={changeInfinite} /></div>}
        <div className="create-world-submit"><span>{draftNotice || (options.template === 'custom' ? `${blocks.length} blocks · ${terrain === 'flat' ? 'flat terrain' : 'natural terrain'}` : 'Your world will be saved in My Worlds.')}</span><button className="primary-button" type="button" onClick={() => submit()} disabled={options.template === 'custom' && sourceDirty}>Create world</button></div>
      </div>
    </MenuDialog>
  );
}
