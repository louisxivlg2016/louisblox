import { useEffect, useState } from 'react';
import { MenuDialog } from './MenuDialog';
import { WorldEditor } from './WorldEditor';
import { MultiplayerLobby } from './MultiplayerLobby';
import { heightAt } from '../game/levels';
import { normalizeRoomId, useMultiplayerStore } from '../game/multiplayerStore';
import { readEditorDraft, writeEditorDraft } from '../game/editorDraft';
import { BlockKind } from '../game/voxel';
import { GAMEPLAY_MODE_LABELS } from '../game/worldMode';
import type { GameplayMode, WorldTemplate } from '../game/worldMode';
import { createCustomWorld, CUSTOM_WORLD_MAX_BLOCKS, CUSTOM_WORLD_MAX_SOURCE, DEFAULT_WORLD_SOURCE, EDITOR_BLOCK_CATEGORIES, worldCodeFromBlocks, worldBlockId } from '../game/worldCode';
import type { CustomTerrain, CustomWorldDefinition } from '../game/worldCode';
import { ItemIcon } from './ItemIcon';
import { selectionInfo } from '../game/items';
import worldTabUrl from '../../assets/menu/world-tab.webp';
import createLobbyTabUrl from '../../assets/menu/create-lobby-tab.webp';
import worldCodeTabUrl from '../../assets/menu/world-code-tab.webp';
import worldEditorTabUrl from '../../assets/menu/world-editor-tab.webp';
import worldTabFrUrl from '../../assets/menu/french/monde.webp';
import createWorldTabFrUrl from '../../assets/menu/french/creer-un-monde.webp';
import createLobbyTabFrUrl from '../../assets/menu/french/creer-une-salle.webp';
import worldEditorTabFrUrl from '../../assets/menu/french/editeur-3d.webp';
import worldTabEsUrl from '../../assets/menu/spanish/mundo.webp';
import createWorldTabEsUrl from '../../assets/menu/spanish/crear-un-mundo.webp';
import createLobbyTabEsUrl from '../../assets/menu/spanish/crear-sala.webp';
import worldEditorTabEsUrl from '../../assets/menu/spanish/editor-3d.webp';
import { translate, useLanguageStore } from '../game/language';

export type CreateWorldOptions = {
  name: string;
  mode: GameplayMode;
  template: WorldTemplate;
  multiplayer: boolean;
  server?: string;
  canBreak: boolean;
  canPlace: boolean;
  allowDestructiveFire: boolean;
  allowCampfire: boolean;
  allowFloodingWater: boolean;
  allowCalmWater: boolean;
  customWorld?: CustomWorldDefinition;
};

export function createLobbyOptions(options: CreateWorldOptions, room: string, mode: GameplayMode | null): CreateWorldOptions {
  return { ...options, name: room.trim().slice(0, 48) || options.name, mode: mode ?? options.mode };
}

const initialWorld = createCustomWorld(DEFAULT_WORLD_SOURCE, 73421);
const WORLD_CODE_EXAMPLES = () => [
  { label: translate('Boutique et monnaie', 'Shop and coins'), source: `terrain("plat");\nremplir(-4, 1, -3, 4, 1, 3, "planches_chene");\nboutique(-2, 2, 0, "acheter", "pomme", 1, 5);\nboutique(0, 2, 0, "vendre", "pomme", 1, 5);\nboutique(2, 2, 0, "gagner", 20);` },
  { label: translate('Ferme et animaux', 'Farm and animals'), source: `terrain("plat");\nchamp(-5, 1, -4, 5, 4, "ble");\nanimal(-3, 2, 1, "vache");\nanimal(0, 2, 1, "cochon");\nanimal(3, 2, 1, "mouton");\ndonner(0, 2, -2, "pain", 3);` },
  { label: translate('Nuit enneigée', 'Snowy night'), source: `terrain("plat");\nnuit();\nmeteo("neige");\nsaisons("hiver");\narbre(-3, 1, -2);\narbre(3, 1, 2);\nzombie(0, 2, 0);\nsoin(2, 2, -2, 4);` },
  { label: translate('Téléporteurs', 'Teleporters'), source: `terrain("plat");\nremplir(-3, 1, -3, 3, 1, 3, "beton_bleu");\nremplir(17, 1, 17, 23, 1, 23, "beton_jaune");\nteleporter(0, 2, 0, 20, 2, 20);\nteleporter(20, 2, 20, 0, 2, 0);` },
  { label: translate('Saisons mélangées', 'Mixed seasons'), source: `terrain("plat");\nsaisons("printemps", "ete", "automne", "hiver");\nremplir(-5, 1, -5, -1, 1, 5, "herbe");\nremplir(1, 1, -5, 5, 1, 5, "herbe");\nsaison(-5, -5, -1, 5, "automne");` },
  { label: translate('Pièges et checkpoints', 'Traps and checkpoints'), source: `terrain("plat");\nremplir(-5, 1, -5, 5, 1, 5, "planches_chene");\ncheckpoint(0, 2, 4);\npiege(0, 2, 0, 2);\nmessage(2, 2, 2, "Attention aux pièges !");` },
  { label: translate('Bonus et escalier', 'Boosts and stairs'), source: `terrain("plat");\nremplir(-4, 1, -4, 4, 1, 4, "beton_blanc");\nescalier(0, 2, 3, 6, "bois");\nvitesse(-2, 2, 0, 30);\nsaut(2, 2, 0, 30);\ninvisible(0, 2, -2, 20);` },
  { label: translate('Bombes et actions', 'Bombs and actions'), source: `terrain("plat");\nremplir(-4, 1, -4, 4, 1, 4, "beton_gris");\nbombe(-2, 2, 0, 3);\nfeu_artifice(0, 2, 0, 5);\ninvoquer(2, 2, 0, "vache");\nnuit(0, 2, -2);\nmeteo(0, 2, 2, "pluie");` },
];
const CREATE_WORLD_TABS = () => [
  ['world', translate('Monde', 'World'), translate(worldTabFrUrl, worldTabUrl, worldTabEsUrl)],
  ['lobby', translate('Créer ton salon', 'Create your room'), translate(createLobbyTabFrUrl, createLobbyTabUrl, createLobbyTabEsUrl)],
  ['code', translate('Code du monde', 'World Code'), translate(createWorldTabFrUrl, worldCodeTabUrl, createWorldTabEsUrl)],
  ['editor', translate('Éditeur 3D', '3D Editor'), translate(worldEditorTabFrUrl, worldEditorTabUrl, worldEditorTabEsUrl)],
] as const;

function seedFromName(name: string) {
  return [...normalizeRoomId(name || translate('Monde personnalisé', 'Custom World'))].reduce((value, letter) => Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0, 2166136261) % 900000;
}

export function CreateWorldDialog({ onClose, onCreate, onPlay, initialMultiplayer }: { onClose: () => void; onCreate: (options: CreateWorldOptions) => void; onPlay: () => void | Promise<void>; initialMultiplayer?: boolean }) {
  useLanguageStore((state) => state.language);
  const connectionStatus = useMultiplayerStore((state) => state.status);
  const connectionError = useMultiplayerStore((state) => state.error);
  const savedServer = useMultiplayerStore((state) => state.server);
  const [draft] = useState(readEditorDraft);
  const [options, setOptions] = useState<CreateWorldOptions>({ name: draft?.name ?? translate('Mon aventure', 'My Adventure'), mode: 'creative', template: draft ? 'custom' : 'nature', multiplayer: initialMultiplayer ?? useMultiplayerStore.getState().enabled, canBreak: true, canPlace: true, allowDestructiveFire: true, allowCampfire: true, allowFloodingWater: true, allowCalmWater: true });
  const [tab, setTab] = useState<'world' | 'lobby' | 'code' | 'editor'>(draft ? 'editor' : 'world');
  const [source, setSource] = useState(draft?.world.source ?? DEFAULT_WORLD_SOURCE);
  const [terrain, setTerrain] = useState<CustomTerrain>(draft?.world.terrain ?? initialWorld.terrain);
  const [infiniteEditor, setInfiniteEditor] = useState(draft?.world.infinite === true);
  const [blocks, setBlocks] = useState(draft?.world.blocks ?? initialWorld.blocks);
  const [environment, setEnvironment] = useState<CustomWorldDefinition['environment']>(draft?.world.environment);
  const [spawns, setSpawns] = useState<NonNullable<CustomWorldDefinition['spawns']>>(draft?.world.spawns ?? []);
  const [images, setImages] = useState<NonNullable<CustomWorldDefinition['images']>>(draft?.world.images ?? []);
  const [characters, setCharacters] = useState<NonNullable<CustomWorldDefinition['characters']>>(draft?.world.characters ?? []);
  const [sourceDirty, setSourceDirty] = useState(draft?.sourceDirty ?? false);
  const [message, setMessage] = useState(draft ? translate('Ton brouillon a été restauré.', 'Your draft has been restored.') : translate('Exécute le code pour voir le résultat dans l’éditeur.', 'Run the code to see the result in the editor.'));
  const [draftNotice, setDraftNotice] = useState(draft ? translate('Brouillon restauré', 'Draft restored') : '');
  const [insertKind, setInsertKind] = useState<BlockKind>(BlockKind.OakPlanks);
  const [codeFullscreen, setCodeFullscreen] = useState(false);
  useEffect(() => {
    if (!codeFullscreen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setCodeFullscreen(false);
    };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [codeFullscreen]);
  const change = <K extends keyof CreateWorldOptions>(key: K, value: CreateWorldOptions[K]) => {
    setDraftNotice('');
    setOptions((current) => ({ ...current, [key]: value }));
  };
  const openTab = (next: typeof tab) => {
    setTab(next);
    if (next !== 'code') setCodeFullscreen(false);
    if (next === 'code' || next === 'editor') change('template', 'custom');
  };
  const changeSource = (value: string) => {
    setSource(value);
    setSourceDirty(true);
    setDraftNotice('');
  };
  const compileSource = (value: string) => {
    try {
      const result = createCustomWorld(value, seedFromName(options.name), (x, z) => heightAt(x, z, seedFromName(options.name)), infiniteEditor);
      setTerrain(result.terrain);
      setBlocks(result.blocks);
      setEnvironment(result.environment);
      setSpawns(result.spawns ?? []);
      setImages(result.images ?? []);
      setCharacters(result.characters ?? []);
      setSourceDirty(false);
      setDraftNotice('');
      setMessage(translate(`Code exécuté : ${result.blocks.length} bloc${result.blocks.length > 1 ? 's' : ''}. Tu peux maintenant modifier la construction dans l’éditeur.`, `Code executed: ${result.blocks.length} block${result.blocks.length > 1 ? 's' : ''}. You can now edit the construction in the editor.`));
      return result;
    } catch (error) {
      setSourceDirty(true);
      setMessage(error instanceof Error ? error.message : translate('Le code contient une erreur.', 'The code contains an error.'));
      setTab('code');
      return null;
    }
  };
  const runCode = () => compileSource(source);
  const resetCode = () => {
    if ((source.trim() || blocks.length > 0) && !window.confirm(translate('Effacer le code et tous les blocs de l’éditeur ? Le brouillon déjà sauvegardé sera conservé tant que tu ne cliques pas sur Sauvegarder.', 'Clear the code and every block in the editor? The saved draft will be kept until you click Save.'))) return;
    setSource('');
    setTerrain('flat');
    setBlocks([]);
    setEnvironment(undefined);
    setSpawns([]);
    setImages([]);
    setCharacters([]);
    setSourceDirty(false);
    setDraftNotice('');
    setMessage(translate('Zone vide : écris ton nouveau code depuis zéro, puis exécute-le.', 'Empty area: write your new code from scratch, then run it.'));
    setTab('code');
    window.requestAnimationFrame(() => document.getElementById('world-code')?.focus());
  };
  const loadExample = (example: string) => {
    setSource(example);
    setSourceDirty(true);
    setDraftNotice('');
    setMessage(translate('Exemple chargé. Exécute-le pour construire le monde, puis modifie-le à ta façon.', 'Example loaded. Run it to build the world, then customize it.'));
    setTab('code');
  };
  const addImage = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setMessage(translate('Choisis une image PNG, JPEG, GIF ou WebP de moins de 8 Mo.', 'Choose a PNG, JPEG, GIF, or WebP image smaller than 8 MB.'));
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext('2d')!;
      context.imageSmoothingEnabled = false;
      context.drawImage(bitmap, 0, 0, 32, 32);
      bitmap.close();
      const url = canvas.toDataURL('image/png');
      const nextSource = `${source.trimEnd()}\nimage(0, 3, 0, "${url}", 4, 4);`;
      setSource(nextSource);
      if (compileSource(nextSource)) setMessage(translate('Image ajoutée au monde. Tu peux maintenant le créer.', 'Image added to the world. You can now create it.'));
    } catch {
      setMessage(translate('Impossible de lire cette image.', 'Unable to read this image.'));
    }
  };
  const changeInfinite = (value: boolean) => {
    if (!value && blocks.some((block) => Math.abs(block.x) > 32 || Math.abs(block.z) > 32)) {
      setDraftNotice(translate('Retire d’abord les blocs hors de la zone finie 65 × 65', 'First remove blocks outside the finite 65 × 65 area'));
      return;
    }
    setInfiniteEditor(value);
    if (!value && source.trim()) setSourceDirty(true);
    setDraftNotice(value ? translate('Éditeur infini', 'Infinite editor') : translate('Éditeur fini · exécute le code pour vérifier les coordonnées', 'Finite editor · run the code to check coordinates'));
    setMessage(value ? translate('Le terrain suit maintenant le joueur. Utilise Aller à X, Y, Z pour explorer le monde.', 'Terrain now follows the player. Use Go to X, Y, Z to explore the world.') : translate('Mode fini 65 × 65. Exécute le code pour vérifier les coordonnées.', 'Finite 65 × 65 mode. Run the code to check coordinates.'));
  };
  const saveDraft = () => {
    const saved = writeEditorDraft(options.name, { version: 1, source, terrain, blocks, ...(infiniteEditor ? { infinite: true } : {}), ...(environment ? { environment } : {}), ...(spawns.length > 0 ? { spawns } : {}), ...(images.length > 0 ? { images } : {}), ...(characters.length > 0 ? { characters } : {}) }, sourceDirty);
    setDraftNotice(saved ? translate('Brouillon sauvegardé', 'Draft saved') : translate('Sauvegarde impossible', 'Unable to save draft'));
    if (saved) setMessage(translate('Brouillon sauvegardé sur cet appareil. Tu peux fermer et reprendre plus tard.', 'Draft saved on this device. You can close it and resume later.'));
    return saved;
  };
  const submit = (nextOptions = options) => {
    let compiledWorld: CustomWorldDefinition | undefined;
    if (nextOptions.template === 'custom' && sourceDirty) {
      const result = compileSource(source);
      if (!result) return;
      compiledWorld = result;
    }
    if (!nextOptions.name.trim()) {
      setTab('world');
      setMessage(translate('Donne un nom à ton monde avant de continuer.', 'Name your world before continuing.'));
      return;
    }
    const server = (nextOptions.server ?? savedServer).trim();
    if (nextOptions.multiplayer && server) {
      try {
        const url = new URL(server);
        if (url.protocol !== 'ws:' && url.protocol !== 'wss:') throw new Error('Protocol');
      } catch {
        setTab('code');
        setMessage(translate('Le serveur doit commencer par ws:// ou wss://.', 'The server must start with ws:// or wss://.'));
        return;
      }
    }
    onCreate({ ...nextOptions, server, customWorld: nextOptions.template === 'custom' ? compiledWorld ?? { version: 1, source, terrain, blocks, ...(infiniteEditor ? { infinite: true } : {}), ...(environment ? { environment } : {}), ...(spawns.length > 0 ? { spawns } : {}), ...(images.length > 0 ? { images } : {}), ...(characters.length > 0 ? { characters } : {}) } : undefined });
  };
  const createLobbyRoom = (room: string, mode: GameplayMode | null) => submit(createLobbyOptions(options, room, mode));
  return (
    <MenuDialog title={translate('Créer un monde', 'Create World')} onClose={onClose} className="create-world-dialog">
      <div className="create-world-form">
        <div className="world-library-heading"><div><h2>{translate('Créer un monde', 'Create World')}</h2><p>{translate('Choisis un terrain, programme-le, construis-le ou crée ton salon.', 'Choose terrain, program it, build it, or create your room.')}</p></div></div>
        <div className="create-world-tabs" role="tablist" aria-label={translate('Création du monde', 'World creation')}>
          {CREATE_WORLD_TABS().map(([id, label, image]) => <button type="button" role="tab" id={`create-tab-${id}`} aria-label={label} aria-selected={tab === id} aria-controls={`create-panel-${id}`} className={tab === id ? 'selected' : ''} key={id} onClick={() => openTab(id)}><img src={image} alt="" /></button>)}
        </div>
        {tab === 'world' && <div id="create-panel-world" role="tabpanel" aria-labelledby="create-tab-world" className="create-world-settings">
          <label htmlFor="world-name">{translate('Nom du monde', 'World name', 'Nombre del mundo')}
            <input id="world-name" value={options.name} onChange={(event) => change('name', event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }} placeholder={translate('Nom de ton monde', 'Your world name')} maxLength={48} required autoFocus />
          </label>
          <fieldset>
            <legend>{translate('Qui peut rejoindre ce monde ?', 'Who can join this world?')}</legend>
            <label><input type="radio" name="world-sharing" checked={!options.multiplayer} onChange={() => change('multiplayer', false)} /> {translate('Solo', 'Solo', 'Un jugador')}</label>
            <label><input type="radio" name="world-sharing" checked={options.multiplayer} onChange={() => change('multiplayer', true)} /> {translate('Multijoueur', 'Multiplayer', 'Multijugador')}</label>
          </fieldset>
          <label htmlFor="create-world-mode">{translate('Mode de jeu', 'Game mode', 'Modo de juego')}
            <select id="create-world-mode" value={options.mode} onChange={(event) => change('mode', event.target.value as GameplayMode)}>
              {Object.entries(GAMEPLAY_MODE_LABELS()).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
            </select>
          </label>
          <label htmlFor="create-world-template">{translate('Terrain', 'Terrain', 'Terreno')}
            <select id="create-world-template" value={options.template} onChange={(event) => { const template = event.target.value as WorldTemplate; change('template', template); if (template === 'custom') openTab('editor'); }}>
              <option value="nature">{translate('Monde naturel infini', 'Infinite natural world')}</option>
              <option value="city-ancient">{translate('Ville ancienne déjà construite', 'Pre-built historic city')}</option>
              <option value="city-modern">{translate('Ville moderne déjà construite', 'Pre-built modern city')}</option>
              <option value="custom">{translate('Monde personnalisé · code et éditeur', 'Custom world · code and editor')}</option>
            </select>
          </label>
          {options.template === 'custom' && <div className="create-custom-summary"><strong>{translate('Ton monde personnalisé', 'Your custom world')}</strong><span>{terrain === 'flat' ? translate('Terrain plat infini', 'Infinite flat terrain') : translate('Paysage naturel infini', 'Infinite natural landscape')} · {blocks.length} {translate('blocs', 'blocks', 'bloques')} · {infiniteEditor ? translate('éditeur infini', 'infinite editor') : translate('éditeur fini 65 × 65', 'finite 65 × 65 editor')}</span><button type="button" className="secondary-button" onClick={() => openTab('editor')}>{translate('Ouvrir l’éditeur 3D', 'Open 3D editor')}</button><button type="button" className="secondary-button" onClick={() => openTab('code')}>{translate('Écrire du code', 'Write code')}</button></div>}
          <fieldset>
            <legend>{translate('Autorisations des autres joueurs', 'Other players’ permissions')}</legend>
            <label className="protection-option"><input type="checkbox" checked={options.canBreak} onChange={(event) => change('canBreak', event.target.checked)} /> {translate('Casser des blocs', 'Break blocks', 'Romper bloques')}</label>
            <label className="protection-option"><input type="checkbox" checked={options.canPlace} onChange={(event) => change('canPlace', event.target.checked)} /> {translate('Poser des blocs', 'Place blocks', 'Colocar bloques')}</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowDestructiveFire} onChange={(event) => change('allowDestructiveFire', event.target.checked)} /> {translate('Feu rouge destructeur', 'Destructive red fire', 'Fuego rojo destructivo')}</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowCampfire} onChange={(event) => change('allowCampfire', event.target.checked)} /> {translate('Feu de camp non destructeur', 'Non-destructive campfire', 'Fogata no destructiva')}</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowFloodingWater} onChange={(event) => change('allowFloodingWater', event.target.checked)} /> {translate('Eau avec inondation', 'Flooding water', 'Agua con inundación')}</label>
            <label className="protection-option"><input type="checkbox" checked={options.allowCalmWater} onChange={(event) => change('allowCalmWater', event.target.checked)} /> {translate('Eau calme sans inondation', 'Calm water without flooding', 'Agua tranquila sin inundación')}</label>
          </fieldset>
        </div>}
        {tab === 'lobby' && <div id="create-panel-lobby" role="tabpanel" aria-labelledby="create-tab-lobby" className="create-lobby-panel">
          <p className="create-lobby-intro">{translate('Choisis ton pseudo et le nom du salon. Si tu as construit un monde avec le code ou l’éditeur, il sera utilisé pour ton salon.', 'Choose your username and room name. If you built a world with code or the editor, it will be used for your room.')}</p>
          <MultiplayerLobby onPlay={() => { onClose(); return onPlay(); }} onCreateRoom={createLobbyRoom} createLabel={translate('Créer ton salon', 'Create your room')} showWhenDisabled idPrefix="create-world" />
        </div>}
        {tab === 'code' && <div id="create-panel-code" role="tabpanel" aria-labelledby="create-tab-code" className="world-code-workspace">
          <div className={`world-code-editor ${codeFullscreen ? 'fullscreen' : ''}`}>
            <div className="world-code-controls">
              <fieldset className="world-code-sharing"><legend>{translate('Mode de jeu', 'Game mode')}</legend><label><input type="radio" name="world-code-sharing" checked={!options.multiplayer} onChange={() => change('multiplayer', false)} /> {translate('Solo', 'Solo', 'Un jugador')}</label><label><input type="radio" name="world-code-sharing" checked={options.multiplayer} onChange={() => change('multiplayer', true)} /> {translate('Multijoueur', 'Multiplayer', 'Multijugador')}</label></fieldset>
              {options.multiplayer && <div className="world-code-server"><label htmlFor="world-code-server">{translate('Serveur personnalisé', 'Custom server', 'Servidor personalizado')}</label><input id="world-code-server" value={options.server ?? savedServer} onChange={(event) => change('server', event.target.value)} placeholder="wss://…workers.dev/ws" autoCapitalize="none" autoCorrect="off" spellCheck={false} /><small>{translate('Indique ton serveur ws:// ou wss://, ou vide ce champ pour utiliser la connexion automatique.', 'Enter your ws:// or wss:// server, or clear this field to use the automatic connection.')}</small></div>}
              <div className="world-code-actions"><button type="button" className="primary-button" onClick={runCode}>{translate('Exécuter le code', 'Run code')}</button><button type="button" className="secondary-button" onClick={resetCode}>{translate('Partir de zéro', 'Start over')}</button><button type="button" className="secondary-button" onClick={() => loadExample(DEFAULT_WORLD_SOURCE)}>{translate('Exemple', 'Example')}</button><button type="button" className="secondary-button" onClick={() => { setSource(worldCodeFromBlocks({ terrain, blocks, environment, spawns, images, characters })); setSourceDirty(false); setDraftNotice(''); setMessage(translate('Le code correspond maintenant à la construction de l’éditeur.', 'The code now matches the editor construction.')); }}>{translate('Construction → code', 'Build → code')}</button><button type="button" className="secondary-button world-code-fullscreen-toggle" aria-pressed={codeFullscreen} onClick={() => setCodeFullscreen((value) => !value)}>{codeFullscreen ? translate('Quitter le plein écran', 'Exit fullscreen') : translate('Plein écran', 'Fullscreen')}</button><label className="secondary-button world-code-image-upload">{translate('Ajouter une image', 'Add an image')}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void addImage(file); event.currentTarget.value = ''; }} /></label></div>
            </div>
            <label htmlFor="world-code">{translate('JavaScript simplifié et sécurisé', 'Simplified and secure JavaScript')}</label>
            <textarea id="world-code" value={source} onChange={(event) => changeSource(event.target.value)} maxLength={CUSTOM_WORLD_MAX_SOURCE} spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-describedby="world-code-message" placeholder={translate('Écris ton code ici depuis zéro…', 'Write your code here from scratch…')} />
            <div className="world-code-examples"><span>{translate('Exemples complets à charger', 'Complete examples to load')}</span><div>{WORLD_CODE_EXAMPLES().map((example) => <button type="button" className="secondary-button" key={example.label} onClick={() => loadExample(example.source)}>{example.label}</button>)}</div></div>
            <p id="world-code-message" className={sourceDirty || message.startsWith('Line') ? 'world-code-message warning' : 'world-code-message'} role="status">{sourceDirty ? translate('Code modifié : exécute-le avant de créer le monde. ', 'Code changed: run it before creating the world. ') : ''}{message}</p>
          </div>
          <aside className="world-code-help">
            <h3>{translate('Commandes disponibles', 'Available commands')}</h3>
            <dl><div><dt>terrain("plat")</dt><dd>{translate('Ou "nature" pour le paysage infini.', 'Or "nature" for an infinite landscape.')}</dd></div><div><dt>bloc(x, y, z, "pierre")</dt><dd>{translate('Pose un bloc. Le 5e argument true le rend incassable ; le 6e argument true ouvre une porte.', 'Place a block. Use true as the fifth argument to protect it, or as the sixth argument to open a door.')}</dd></div><div><dt>remplir(x1, y1, z1, x2, y2, z2, "bois")</dt><dd>{translate('Remplit un volume. Le dernier ', 'Fill a volume. The optional last ')}<code>true</code>{translate(' facultatif protège aussi les blocs.', ' also protects blocks.')}</dd></div><div><dt>sphere(x, y, z, rayon, "verre")</dt><dd>{translate('Construit une sphère.', 'Build a sphere.')}</dd></div><div><dt>effacer(x, y, z)</dt><dd>{translate('Retire un bloc du code.', 'Remove a block from the code.')}</dd></div><div><dt>hauteur(x, z)</dt><dd>{translate('Hauteur du sol naturel.', 'Natural ground height.')}</dd></div><div><dt>aleatoire()</dt><dd>{translate('Nombre reproductible entre 0 et 1.', 'Repeatable number between 0 and 1.')}</dd></div><div><dt>ligne(x1, y1, z1, x2, y2, z2, "pierre")</dt><dd>{translate('Trace une ligne de blocs.', 'Draw a line of blocks.', 'Traza una línea de bloques.')}</dd></div><div><dt>mur(x1, y1, z1, x2, y2, z2, hauteur, "brique")</dt><dd>{translate('Construit un mur à la hauteur choisie.', 'Build a wall at the chosen height.', 'Construye un muro a la altura elegida.')}</dd></div><div><dt>cylindre(x, y, z, rayon, hauteur, "pierre")</dt><dd>{translate('Construit un cylindre plein.', 'Build a solid cylinder.', 'Construye un cilindro sólido.')}</dd></div><div><dt>pyramide(x, y, z, taille, "pierre")</dt><dd>{translate('Construit une pyramide pleine.', 'Build a solid pyramid.', 'Construye una pirámide sólida.')}</dd></div><div><dt>arbre(x, y, z)</dt><dd>{translate('Fait pousser un arbre avec tronc et feuilles.', 'Grow a tree with trunk and leaves.', 'Hace crecer un árbol con tronco y hojas.')}</dd></div><div><dt>maison(x, y, z, largeur, profondeur, hauteur, "mur", "toit")</dt><dd>{translate('Construit une maison avec porte, fenêtres, lit et coffre.', 'Build a house with door, windows, bed, and chest.', 'Construye una casa con puerta, ventanas, cama y cofre.')}</dd></div><div><dt>route(x1, y1, z1, x2, y2, z2, largeur, "beton_noir")</dt><dd>{translate('Crée une route à la largeur impaire choisie.', 'Build a road with the chosen odd width.', 'Crea una carretera con el ancho impar elegido.')}</dd></div><div><dt>champ(x, y, z, largeur, profondeur, "ble")</dt><dd>{translate('Plante des cultures alignées avec irrigation.', 'Plant aligned crops with irrigation.', 'Planta cultivos alineados con riego.')}</dd></div><div><dt>panneau(x, y, z, "Mon village")</dt><dd>{translate('Place un panneau avec ton texte.', 'Place a sign with your text.', 'Coloca un cartel con tu texto.')}</dd></div><div><dt>boutique(x, y, z, "acheter", "pomme", 1, 5)</dt><dd>{translate('Crée une boutique : achète 1 pomme pour 5 pièces avec E. Utilise "vendre" au même endroit pour vendre et "gagner" avec seulement un prix pour recevoir des pièces.', 'Create a shop: buy 1 apple for 5 coins with E. Use "sell" to sell and "earn" with only a price to receive coins.')}</dd></div><div><dt>saison(x1, z1, x2, z2, "hiver")</dt><dd>{translate('Choisis la saison d’une zone. "saisons("printemps", "ete")" mélange les saisons selon les blocs.', 'Choose a zone’s season. "saisons("printemps", "ete")" mixes seasons by block.')}</dd></div><div><dt>donner(x, y, z, "pomme", 3)</dt><dd>{translate('Donne 3 pommes avec E. "soin(x, y, z, 4)" rend 4 vies et "teleporter(x, y, z, 20, 5, 20)" téléporte.', 'Give 3 apples with E. "soin(x, y, z, 4)" restores 4 lives and "teleporter(x, y, z, 20, 5, 20)" teleports.')}</dd></div><div><dt>image(x, y, z, "https://…", 4, 4)</dt><dd>{translate('Affiche une image HTTPS ou importée, convertie en pixel art 32 × 32.', 'Display an HTTPS or imported image converted to 32 × 32 pixel art.')}</dd></div><div><dt>personnage(x, y, z, "travailleur")</dt><dd>{translate('Ajoute un personnage Minecraft : travailleur, marchand, princesse, chevalier, pirate, policier ou explorateur. Ajoute un nom en dernier argument si tu veux.', 'Add a Minecraft character: worker, trader, princess, knight, pirate, police, or explorer. Add a name as the last argument if you want.')}</dd></div><div><dt>animal(x, y, z, "vache") · zombie(x, y, z)</dt><dd>{translate('Fait apparaître une vache ou un zombie dans le monde.', 'Spawn a cow or a zombie in the world.')}</dd></div><div><dt>jour() · nuit() · meteo("pluie")</dt><dd>{translate('Règle le jour, la nuit ou la météo : clair, pluie ou neige.', 'Set day, night, or weather: clear, rain, or snow.')}</dd></div><div><dt>checkpoint(x, y, z) · piege(x, y, z, 2)</dt><dd>{translate('Enregistre un checkpoint ou place un piège à 2 dégâts.', 'Save a checkpoint or place a 2-damage trap.')}</dd></div><div><dt>vitesse(x, y, z, 30) · saut(x, y, z, 30) · invisible(x, y, z, 20)</dt><dd>{translate('Donne vitesse, super saut ou invisibilité pendant le temps choisi.', 'Give speed, super jump, or invisibility for the chosen time.')}</dd></div><div><dt>escalier(x, y, z, 6, "bois")</dt><dd>{translate('Construit un escalier montant de 6 blocs.', 'Build a staircase rising 6 blocks.')}</dd></div><div><dt>bombe(x, y, z, 3) · feu_artifice(x, y, z, 5)</dt><dd>{translate('Crée un panneau qui libère des bombes ou des feux d’artifice à chaque appui. La quantité est facultative, entre 1 et 10.', 'Create a block that releases bombs or fireworks when pressed. Count is optional, from 1 to 10.')}</dd></div><div><dt>invoquer(x, y, z, "vache")</dt><dd>{translate('Crée un panneau qui fait apparaître l’animal choisi à chaque appui. Utilise "zombie" pour un zombie.', 'Create a block that spawns the chosen animal when pressed. Use "zombie" for a zombie.')}</dd></div><div><dt>jour(x, y, z) · nuit(x, y, z) · meteo(x, y, z, "pluie")</dt><dd>{translate('Sans coordonnées, jour() et meteo("pluie") règlent le monde. Avec x, y, z, ils créent un panneau qui change le moment ou la météo à chaque appui. Choisis clair, pluie ou neige.', 'Without coordinates, jour() and meteo("pluie") configure the world. With x, y, z, they create a block that changes time or weather when pressed. Choose clear, rain, or snow.')}</dd></div></dl>
            <p>{translate('Les variables let, les calculs, les conditions if et les boucles for sont prises en charge.', 'Variables let, calculations, if conditions, and for loops are supported.', 'Las variables let, los cálculos, las condiciones if y los bucles for son compatibles.')} {infiniteEditor ? translate('Éditeur infini : x/z libres pour explorer le monde, y de 1 à 64.', 'Infinite editor: x/z are free to explore the world, y from 1 to 64.', 'Editor infinito: x/z libres para explorar el mundo, y de 1 a 64.') : translate('Éditeur fini : x/z de −64 à 64, y de 1 à 64.', 'Finite editor: x/z from −64 to 64, y from 1 to 64.', 'Editor finito: x/z de −64 a 64, y de 1 a 64.')} {translate(`Maximum ${CUSTOM_WORLD_MAX_BLOCKS} blocs.`, `Maximum ${CUSTOM_WORLD_MAX_BLOCKS.toLocaleString('en-US')} blocks.`, `Máximo ${CUSTOM_WORLD_MAX_BLOCKS.toLocaleString('es-ES')} bloques.`)}</p>
            <label htmlFor="world-code-block">Insert block by category
              <select id="world-code-block" value={insertKind} onChange={(event) => setInsertKind(Number(event.target.value) as BlockKind)}>{EDITOR_BLOCK_CATEGORIES.map((category) => <optgroup key={category.id} label={category.name}>{category.kinds.map((kind) => <option key={kind} value={kind}>{selectionInfo(kind).name}</option>)}</optgroup>)}</select>
            </label>
            <div className="world-code-insert"><ItemIcon kind={insertKind} /><code>{worldBlockId(insertKind)}</code><button type="button" className="secondary-button" onClick={() => changeSource(`${source.trimEnd()}\nbloc(0, 1, 0, "${worldBlockId(insertKind)}");`)}>{translate('Ajouter au code', 'Add to code')}</button></div>
            <p className="world-code-help-note">{translate('Le code s’exécute uniquement dans le générateur. Il ne peut ni lire tes fichiers, ni ouvrir de page, ni utiliser le navigateur. Exécuter le code remplace les blocs et le terrain de l’éditeur.', 'Code only runs in the generator. It cannot read your files, open pages, or use the browser. Running code replaces the editor’s blocks and terrain.')}</p>
          </aside>
        </div>}
        {tab === 'editor' && <div id="create-panel-editor" role="tabpanel" aria-labelledby="create-tab-editor" className="world-editor-panel">
          <section className="editor-world-sharing" aria-label={translate('Mode de jeu du monde créé dans l’éditeur', 'Game mode for the world created in the editor')}>
            <div className="editor-world-sharing-copy"><strong>{translate('Qui peut rejoindre ce monde ?', 'Who can join this world?')}</strong><span>{options.multiplayer ? translate('Multijoueur activé : les autres joueurs pourront rejoindre ta construction.', 'Multiplayer enabled: other players will be able to join your build.') : translate('Choisis Multijoueur pour construire et jouer avec les autres.', 'Choose Multiplayer to build and play with others.')}</span></div>
            <div className="editor-world-sharing-options" role="group" aria-label={translate('Solo ou multijoueur', 'Solo or multiplayer')}>
              <button type="button" className={!options.multiplayer ? 'selected' : ''} aria-pressed={!options.multiplayer} onClick={() => change('multiplayer', false)}>{translate('Solo', 'Solo', 'Un jugador')}</button>
              <button type="button" className={`editor-multiplayer-option ${options.multiplayer ? 'selected' : ''}`} aria-pressed={options.multiplayer} onClick={() => change('multiplayer', true)}>{translate('Multijoueur', 'Multiplayer', 'Multijugador')}</button>
            </div>
          </section>
          <WorldEditor blocks={blocks} terrain={terrain} images={images} characters={characters} seed={seedFromName(options.name)} onChange={(next) => { setBlocks(next); setDraftNotice(''); }} onTerrainChange={(next) => { setTerrain(next); setDraftNotice(''); }} onSaveDraft={saveDraft} draftNotice={draftNotice} infinite={infiniteEditor} onInfiniteChange={changeInfinite} />
        </div>}
        {tab !== 'lobby' && options.multiplayer && connectionStatus === 'connecting' && <p className="multiplayer-hint" role="status">{translate('Création du monde et connexion au salon…', 'Creating the world and connecting to the room…')}</p>}
        {tab !== 'lobby' && options.multiplayer && connectionError && <p className="multiplayer-error" role="alert">{connectionError}</p>}
        {tab !== 'lobby' && <div className="create-world-submit"><span>{draftNotice || (options.template === 'custom' ? `${blocks.length} ${translate('blocs', 'blocks', 'bloques')} · ${terrain === 'flat' ? translate('terrain plat', 'flat terrain') : translate('terrain naturel', 'natural terrain')}` : translate('Ton monde sera sauvegardé dans Mes mondes.', 'Your world will be saved in My Worlds.'))}</span><button className="primary-button" type="button" onClick={() => submit()} disabled={options.multiplayer && connectionStatus === 'connecting'}>{options.template === 'custom' && sourceDirty ? translate('Exécuter et créer le monde', 'Run and create world') : translate('Créer le monde', 'Create world')}</button></div>}
      </div>
    </MenuDialog>
  );
}
