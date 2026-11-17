import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Matrix4, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { blockGeometry, blockMaterials } from '../game/textures';
import { heightAt } from '../game/levels';
import { BLOCK_INFO, BlockKind, voxelKey } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import { CUSTOM_WORLD_MAX_BLOCKS, CUSTOM_WORLD_MAX_Y, CUSTOM_WORLD_RADIUS, EDITOR_BLOCK_CATEGORIES, INFINITE_EDITOR_COORDINATE, worldBlockId } from '../game/worldCode';
import type { CustomTerrain } from '../game/worldCode';
import { ItemIcon } from './ItemIcon';
import { selectionInfo } from '../game/items';
import { translate } from '../game/language';
import { EditorPlayer } from './EditorPlayer';
import { StairModel } from './StairModel';
import { SlabModel } from './SlabModel';
import { isSlab, isStair, isUpsideDownStair } from '../game/extraBlocks';

const ALL_BLOCKS = [...new Set(Object.values(BlockKind).filter((kind) => typeof kind === 'number' && kind in BLOCK_INFO))] as BlockKind[];
const matrix = new Matrix4();
const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);

type PreviewBlock = { block: Voxel; base: boolean };

function BlockInstances({ blocks, erase, onInteract }: { blocks: PreviewBlock[]; erase: boolean; onInteract: (target: PreviewBlock, normal: { x: number; y: number; z: number }, remove: boolean) => void }) {
  const groups = useMemo(() => {
    const result = new Map<BlockKind, PreviewBlock[]>();
    for (const target of blocks) {
      const group = result.get(target.block.kind) ?? [];
      group.push(target);
      result.set(target.block.kind, group);
    }
    return [...result];
  }, [blocks]);
  return groups.map(([kind, values]) => <BlockInstanceGroup key={kind} kind={kind} values={values} erase={erase} onInteract={onInteract} />);
}

function BlockInstanceGroup({ kind, values, erase, onInteract }: { kind: BlockKind; values: PreviewBlock[]; erase: boolean; onInteract: (target: PreviewBlock, normal: { x: number; y: number; z: number }, remove: boolean) => void }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    values.forEach(({ block }, index) => {
      matrix.makeTranslation(block.x, block.y, block.z);
      mesh.current!.setMatrixAt(index, matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [values]);
  if (isStair(kind) || isSlab(kind)) return values.map((target) => (
    <group key={`${target.block.x},${target.block.y},${target.block.z}`} onClick={(event) => { if (event.delta > 5) return; event.stopPropagation(); onInteract(target, event.face?.normal ?? { x: 0, y: 1, z: 0 }, erase); }} onPointerDown={(event) => { if (event.button !== 2) return; event.stopPropagation(); onInteract(target, event.face?.normal ?? { x: 0, y: 1, z: 0 }, true); }}>
      {isStair(kind)
        ? <StairModel kind={kind} facing={target.block.facing} upsideDown={isUpsideDownStair(target.block)} position={[target.block.x, target.block.y, target.block.z]} />
        : <SlabModel kind={kind} facing={target.block.facing} growth={target.block.growth} position={[target.block.x, target.block.y, target.block.z]} />}
    </group>
  ));
  return (
    <instancedMesh
      ref={mesh}
      args={[blockGeometry, blockMaterials[kind], values.length]}
      onClick={(event) => {
        if (event.delta > 5 || event.instanceId === undefined) return;
        const target = values[event.instanceId];
        if (!target) return;
        event.stopPropagation();
        onInteract(target, event.face?.normal ?? { x: 0, y: 1, z: 0 }, erase);
      }}
      onPointerDown={(event) => {
        if (event.button !== 2 || event.instanceId === undefined) return;
        event.stopPropagation();
        const target = values[event.instanceId];
        if (target) onInteract(target, event.face?.normal ?? { x: 0, y: 1, z: 0 }, true);
      }}
    />
  );
}

function EditorScene({ blocks, terrain, seed, erase, onInteract, playerVisible, resetKey, keys, infinite, spawnPoint }: { blocks: Voxel[]; terrain: CustomTerrain; seed: number; erase: boolean; onInteract: (target: PreviewBlock, normal: { x: number; y: number; z: number }, remove: boolean) => void; playerVisible: boolean; resetKey: number; keys: { current: Set<string> }; infinite: boolean; spawnPoint: { x: number; y: number; z: number } | null }) {
  const controls = useThree((state) => state.controls) as unknown as { target: Vector3 } | null;
  const [center, setCenter] = useState({ x: 0, z: 0 });
  useEffect(() => { if (!infinite) setCenter({ x: 0, z: 0 }); }, [infinite]);
  useFrame(() => {
    if (!infinite || !controls) return;
    const x = Math.floor(controls.target.x / 16);
    const z = Math.floor(controls.target.z / 16);
    setCenter((current) => current.x === x && current.z === z ? current : { x, z });
  });
  const visible = useMemo(() => {
    const map = new Map<string, PreviewBlock>();
    for (let x = center.x * 16 - 32; x <= center.x * 16 + 32; x += 1) {
      for (let z = center.z * 16 - 32; z <= center.z * 16 + 32; z += 1) {
        const y = terrain === 'natural' ? heightAt(x, z, seed) : 0;
        const kind = terrain === 'natural' && y < 5 ? BlockKind.Sand : BlockKind.Grass;
        const block = { x, y, z, kind };
        map.set(voxelKey(x, y, z), { block, base: true });
      }
    }
    for (const block of blocks) map.set(voxelKey(block.x, block.y, block.z), { block, base: false });
    return [...map.values()];
  }, [blocks, terrain, seed, center]);
  return (
    <>
      <color attach="background" args={['#83b9df']} />
      <hemisphereLight args={['#e3f2ff', '#526240', 2]} />
      <directionalLight position={[16, 30, 12]} intensity={2.2} />
      <BlockInstances blocks={visible} erase={erase} onInteract={onInteract} />
      <gridHelper args={[65, 65, '#e9f4ce', '#526a4d']} position={[center.x * 16, 0.506, center.z * 16]} />
      {playerVisible && <EditorPlayer blocks={blocks} terrain={terrain} seed={seed} resetKey={resetKey} keys={keys} spawnPoint={spawnPoint} />}
      <OrbitControls makeDefault target={[0, 2, 0]} minDistance={5} maxDistance={85} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

export function WorldEditor({ blocks, terrain, seed, onChange, onTerrainChange, onSaveDraft, draftNotice, infinite, onInfiniteChange }: { blocks: Voxel[]; terrain: CustomTerrain; seed: number; onChange: (blocks: Voxel[]) => void; onTerrainChange: (terrain: CustomTerrain) => void; onSaveDraft: () => boolean; draftNotice: string; infinite: boolean; onInfiniteChange: (infinite: boolean) => void }) {
  const [category, setCategory] = useState('nature');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BlockKind>(BlockKind.GrayBrick);
  const [tool, setTool] = useState<'place' | 'erase' | 'protect'>('place');
  const [protectedPlacement, setProtectedPlacement] = useState(false);
  const [history, setHistory] = useState<Voxel[][]>([]);
  const [position, setPosition] = useState({ x: '0', y: '1', z: '0' });
  const [message, setMessage] = useState(translate('Choisis une catégorie, puis clique sur une face pour construire.', 'Choose a category, then click a face to build.'));
  const [playerVisible, setPlayerVisible] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [spawnPoint, setSpawnPoint] = useState<{ x: number; y: number; z: number } | null>(null);
  const keys = useRef(new Set<string>());
  const root = useRef<HTMLDivElement>(null);
  const currentCategory = EDITOR_BLOCK_CATEGORIES.find((entry) => entry.id === category);
  const normalizedQuery = query.trim().toLocaleLowerCase('en');
  const available = (normalizedQuery ? ALL_BLOCKS : currentCategory?.kinds ?? ALL_BLOCKS).filter((kind) => !normalizedQuery || selectionInfo(kind).name.toLocaleLowerCase('en').includes(normalizedQuery) || worldBlockId(kind).includes(normalizedQuery));

  useEffect(() => {
    if (!playerVisible) {
      keys.current.clear();
      return;
    }
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!movementKeys.has(event.code)) return;
      event.preventDefault();
      keys.current.add(event.code);
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const clear = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      clear();
    };
  }, [playerVisible]);

  const update = (next: Voxel[]) => {
    setHistory((current) => [...current.slice(-39), blocks]);
    onChange(next);
  };
  const put = (x: number, y: number, z: number, kind = selected, normal = { x: 0, y: 1, z: 0 }) => {
    const limit = infinite ? INFINITE_EDITOR_COORDINATE : CUSTOM_WORLD_RADIUS;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(z) || Math.abs(x) > limit || Math.abs(z) > limit || y < 1 || y > CUSTOM_WORLD_MAX_Y) {
      setMessage(infinite ? translate('Coordonnées entières trop grandes. Y doit être entre 1 et 48.', 'Integer coordinates are too large. Y must be between 1 and 48.') : translate('Coordonnées : x et z de -32 à 32, y de 1 à 48.', 'Coordinates: x and z from -32 to 32, y from 1 to 48.'));
      return;
    }
    const next = blocks.filter((block) => block.x !== x || block.y !== y || block.z !== z);
    if (next.length === blocks.length && blocks.length >= CUSTOM_WORLD_MAX_BLOCKS) {
      setMessage(translate(`La construction est limitée à ${CUSTOM_WORLD_MAX_BLOCKS} blocs.`, `Construction is limited to ${CUSTOM_WORLD_MAX_BLOCKS} blocks.`));
      return;
    }
    const facing = normal.x === 1 ? 'east' : normal.x === -1 ? 'west' : normal.z === 1 ? 'south' : 'north';
    const growth = normal.y === -1 ? 1 : normal.y === 0 ? 2 : 0;
    update([...next, { x, y, z, kind, ...(isStair(kind) || isSlab(kind) ? { facing: isStair(kind) ? 'south' : facing } : {}), ...(isSlab(kind) ? { growth } : {}), ...(protectedPlacement ? { protected: true } : {}) }]);
    setMessage(`${selectionInfo(kind).name} placed at ${x}, ${y}, ${z}${protectedPlacement ? translate(' · incassable', ' · unbreakable') : ''}.`);
  };
  const interact = ({ block, base }: PreviewBlock, normal: { x: number; y: number; z: number }, remove: boolean) => {
    if (tool === 'protect') {
      if (base) { setMessage(translate('Le sol de départ ne peut pas être protégé ici. Pose un bloc à cet endroit.', 'The starting ground cannot be protected here. Place a block at this location.')); return; }
      update(blocks.map((other) => other.x === block.x && other.y === block.y && other.z === block.z ? { ...other, protected: other.protected === true ? undefined : true } : other));
      setMessage(block.protected === true ? `${selectionInfo(block.kind).name} est maintenant cassable.` : `${selectionInfo(block.kind).name} est maintenant incassable.`);
      return;
    }
    if (remove) {
      if (base) { setMessage(translate('Le sol de départ est conservé. Tu peux construire dessus.', 'The starting ground is preserved. You can build on it.')); return; }
      update(blocks.filter((other) => other.x !== block.x || other.y !== block.y || other.z !== block.z));
      setMessage(`${selectionInfo(block.kind).name} removed.`);
      return;
    }
    put(block.x + Math.round(normal.x), block.y + Math.round(normal.y), block.z + Math.round(normal.z), selected, normal);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    onChange(previous);
    setMessage(translate('Dernière modification annulée.', 'Last change undone.'));
  };

  return (
    <div ref={root} className="world-editor" tabIndex={0} onPointerDown={(event) => { if (event.target instanceof HTMLElement && !event.target.closest('input, textarea, select')) root.current?.focus(); }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); } }}>
      <div className="world-editor-palette">
        <label htmlFor="editor-block-search">{translate('Rechercher un bloc', 'Search blocks')}
          <input id="editor-block-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={translate('Ex. brique, verre, sapin…', 'E.g. brick, glass, pine…')} />
        </label>
        <div className="world-editor-categories" aria-label={translate('Catégories de blocs', 'Block categories')}>
          <button type="button" className={category === 'all' ? 'selected' : ''} onClick={() => setCategory('all')}>{translate('Tous', 'All')} <small>{ALL_BLOCKS.length}</small></button>
          {EDITOR_BLOCK_CATEGORIES.map((entry) => <button type="button" key={entry.id} className={category === entry.id ? 'selected' : ''} onClick={() => setCategory(entry.id)}>{entry.name} <small>{entry.kinds.length}</small></button>)}
        </div>
        <div className="world-editor-block-list" aria-label={translate('Blocs disponibles', 'Available blocks')}>
          {available.map((kind) => <button type="button" key={kind} className={selected === kind ? 'selected' : ''} onClick={() => { setSelected(kind); setTool('place'); }} title={`${selectionInfo(kind).name} · ${worldBlockId(kind)}`} aria-pressed={selected === kind}><ItemIcon kind={kind} /><span>{selectionInfo(kind).name}</span></button>)}
          {available.length === 0 && <p>{translate('Aucun bloc trouvé.', 'No blocks found.')}</p>}
        </div>
        <label className="world-editor-protected-option"><input type="checkbox" checked={protectedPlacement} onChange={(event) => setProtectedPlacement(event.target.checked)} /> {translate('Poser des blocs incassables', 'Place unbreakable blocks', 'Colocar bloques irrompibles')}</label>
      </div>
      <div className="world-editor-stage">
        <div className="world-editor-toolbar">
          <div className="world-editor-tools" aria-label={translate('Outils de construction et du joueur', 'Building and player tools')}>
            <button type="button" className={tool === 'place' ? 'selected' : ''} onClick={() => setTool('place')}>{translate('Poser', 'Place')}</button>
            <button type="button" className={tool === 'erase' ? 'selected' : ''} onClick={() => setTool('erase')}>{translate('Enlever', 'Remove')}</button>
            <button type="button" className={tool === 'protect' ? 'selected' : ''} aria-pressed={tool === 'protect'} title={translate('Clique sur un bloc pour le rendre incassable ou cassable', 'Click a block to make it unbreakable or breakable')} onClick={() => setTool('protect')}>{translate('Protéger', 'Protect')}</button>
            <button type="button" onClick={undo} disabled={history.length === 0}>{translate('Annuler', 'Undo')}</button>
            <button type="button" className={playerVisible ? 'selected' : ''} aria-pressed={playerVisible} onClick={() => setPlayerVisible((visible) => !visible)}>{playerVisible ? translate('Joueur visible', 'Player visible') : translate('Joueur caché', 'Player hidden')}</button>
            <button type="button" onClick={() => { setSpawnPoint(null); setResetKey((value) => value + 1); setMessage(translate('Joueur replacé au point de départ.', 'Player returned to spawn.')); }}>{translate('Recentrer', 'Recenter')}</button>
            <button type="button" className="world-editor-save" onClick={() => setMessage(onSaveDraft() ? translate('Brouillon sauvegardé sur cet appareil. Tu peux continuer à construire.', 'Draft saved on this device. You can keep building.') : translate('Sauvegarde impossible sur cet appareil.', 'Unable to save on this device.'))}>{translate('Sauvegarder', 'Save')}</button>
          </div>
          <label>{translate('Éditeur', 'Editor')}<select aria-label={translate('Taille de l’éditeur', 'Editor size')} value={infinite ? 'infinite' : 'finite'} onChange={(event) => onInfiniteChange(event.target.value === 'infinite')}><option value="finite">{translate('Fini · 65 × 65', 'Finite · 65 × 65')}</option><option value="infinite">{translate('Infini · exploration libre', 'Infinite · free exploration')}</option></select></label>
          <label>{translate('Terrain', 'Terrain', 'Terreno')}<select value={terrain} onChange={(event) => onTerrainChange(event.target.value as CustomTerrain)}><option value="flat">{translate('Plat infini', 'Infinite flat')}</option><option value="natural">{translate('Naturel infini', 'Infinite natural')}</option></select></label>
        </div>
        <div className="world-editor-canvas">
          <Canvas frameloop={playerVisible ? 'always' : 'demand'} dpr={1} camera={{ position: [20, 20, 24], fov: 50, near: 0.1, far: 200 }} gl={{ antialias: false }} onContextMenu={(event) => event.preventDefault()}>
            <EditorScene blocks={blocks} terrain={terrain} seed={seed} erase={tool === 'erase'} onInteract={interact} playerVisible={playerVisible} resetKey={resetKey} keys={keys} infinite={infinite} spawnPoint={spawnPoint} />
          </Canvas>
        </div>
        <p className="world-editor-help">{translate('WASD ou flèches : déplacer le joueur · Espace : sauter · glisser pour tourner · clic pour poser · Enlever ou clic droit pour retirer · Protéger puis clic pour changer la résistance d’un bloc', 'WASD or arrows: move player · Space: jump · drag to rotate · click to place · Remove or right click to delete · Protect then click to change block resistance')}</p>
        <div className="world-editor-coordinates">
          {(['x', 'y', 'z'] as const).map((axis) => <label key={axis}>{axis.toUpperCase()}<input type="number" value={position[axis]} onChange={(event) => setPosition({ ...position, [axis]: event.target.value })} min={axis === 'y' ? 1 : infinite ? -INFINITE_EDITOR_COORDINATE : -CUSTOM_WORLD_RADIUS} max={axis === 'y' ? CUSTOM_WORLD_MAX_Y : infinite ? INFINITE_EDITOR_COORDINATE : CUSTOM_WORLD_RADIUS} /></label>)}
          <button type="button" className="secondary-button" onClick={() => put(Number(position.x), Number(position.y), Number(position.z))}>{translate('Poser ici', 'Place here')}</button>
          {infinite && <button type="button" className="secondary-button" onClick={() => { const x = Number(position.x); const y = Number(position.y); const z = Number(position.z); if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(z) || y < 1 || y > CUSTOM_WORLD_MAX_Y) { setMessage(translate('Coordonnées de téléportation invalides.', 'Invalid teleport coordinates.')); return; } setSpawnPoint({ x, y: y + 0.51, z }); setResetKey((value) => value + 1); setMessage(translate(`Joueur téléporté à ${x}, ${y + 0.51}, ${z}.`, `Player teleported to ${x}, ${y + 0.51}, ${z}.`, `Jugador teletransportado a ${x}, ${y + 0.51}, ${z}.`)); }}>{translate('Aller à X, Y, Z', 'Go to X, Y, Z')}</button>}
          <button type="button" className="text-button" onClick={() => { if (blocks.length === 0 || window.confirm(translate('Retirer tous les blocs de cette construction ?', 'Remove every block from this construction?'))) { update([]); setMessage(translate('Construction vidée.', 'Construction cleared.')); } }}>{translate('Vider', 'Clear')}</button>
        </div>
        <p className="world-editor-status" role="status"><strong>{blocks.length} / {CUSTOM_WORLD_MAX_BLOCKS} {translate('blocs', 'blocks', 'bloques')}</strong> · {message}{draftNotice ? ` · ${draftNotice}` : ''}</p>
      </div>
    </div>
  );
}
