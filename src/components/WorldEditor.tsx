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
import { EditorPlayer } from './EditorPlayer';

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
  const [message, setMessage] = useState('Choisis une catégorie, puis clique sur une face pour construire.');
  const [playerVisible, setPlayerVisible] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [spawnPoint, setSpawnPoint] = useState<{ x: number; y: number; z: number } | null>(null);
  const keys = useRef(new Set<string>());
  const root = useRef<HTMLDivElement>(null);
  const currentCategory = EDITOR_BLOCK_CATEGORIES.find((entry) => entry.id === category);
  const normalizedQuery = query.trim().toLocaleLowerCase('fr');
  const available = (normalizedQuery ? ALL_BLOCKS : currentCategory?.kinds ?? ALL_BLOCKS).filter((kind) => !normalizedQuery || BLOCK_INFO[kind].name.toLocaleLowerCase('fr').includes(normalizedQuery) || worldBlockId(kind).includes(normalizedQuery));

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
  const put = (x: number, y: number, z: number, kind = selected) => {
    const limit = infinite ? INFINITE_EDITOR_COORDINATE : CUSTOM_WORLD_RADIUS;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(z) || Math.abs(x) > limit || Math.abs(z) > limit || y < 1 || y > CUSTOM_WORLD_MAX_Y) {
      setMessage(infinite ? 'Coordonnées entières trop grandes. Y doit être entre 1 et 48.' : 'Coordonnées : x et z de -32 à 32, y de 1 à 48.');
      return;
    }
    const next = blocks.filter((block) => block.x !== x || block.y !== y || block.z !== z);
    if (next.length === blocks.length && blocks.length >= CUSTOM_WORLD_MAX_BLOCKS) {
      setMessage(`La construction est limitée à ${CUSTOM_WORLD_MAX_BLOCKS} blocs.`);
      return;
    }
    update([...next, { x, y, z, kind, ...(protectedPlacement ? { protected: true } : {}) }]);
    setMessage(`${BLOCK_INFO[kind].name} posé en ${x}, ${y}, ${z}${protectedPlacement ? ' · incassable' : ''}.`);
  };
  const interact = ({ block, base }: PreviewBlock, normal: { x: number; y: number; z: number }, remove: boolean) => {
    if (tool === 'protect') {
      if (base) { setMessage('Le sol de départ ne peut pas être protégé ici. Pose un bloc à cet endroit.'); return; }
      update(blocks.map((other) => other.x === block.x && other.y === block.y && other.z === block.z ? { ...other, protected: other.protected === true ? undefined : true } : other));
      setMessage(block.protected === true ? `${BLOCK_INFO[block.kind].name} est maintenant cassable.` : `${BLOCK_INFO[block.kind].name} est maintenant incassable.`);
      return;
    }
    if (remove) {
      if (base) { setMessage('Le sol de départ est conservé. Tu peux construire dessus.'); return; }
      update(blocks.filter((other) => other.x !== block.x || other.y !== block.y || other.z !== block.z));
      setMessage(`${BLOCK_INFO[block.kind].name} retiré.`);
      return;
    }
    put(block.x + Math.round(normal.x), block.y + Math.round(normal.y), block.z + Math.round(normal.z));
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    onChange(previous);
    setMessage('Dernière modification annulée.');
  };

  return (
    <div ref={root} className="world-editor" tabIndex={0} onPointerDown={(event) => { if (event.target instanceof HTMLElement && !event.target.closest('input, textarea, select')) root.current?.focus(); }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); } }}>
      <div className="world-editor-palette">
        <label htmlFor="editor-block-search">Rechercher un bloc
          <input id="editor-block-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex. brique, verre, sapin…" />
        </label>
        <div className="world-editor-categories" aria-label="Catégories de blocs">
          <button type="button" className={category === 'all' ? 'selected' : ''} onClick={() => setCategory('all')}>Tous <small>{ALL_BLOCKS.length}</small></button>
          {EDITOR_BLOCK_CATEGORIES.map((entry) => <button type="button" key={entry.id} className={category === entry.id ? 'selected' : ''} onClick={() => setCategory(entry.id)}>{entry.name} <small>{entry.kinds.length}</small></button>)}
        </div>
        <div className="world-editor-block-list" aria-label="Blocs disponibles">
          {available.map((kind) => <button type="button" key={kind} className={selected === kind ? 'selected' : ''} onClick={() => { setSelected(kind); setTool('place'); }} title={`${BLOCK_INFO[kind].name} · ${worldBlockId(kind)}`} aria-pressed={selected === kind}><ItemIcon kind={kind} /><span>{BLOCK_INFO[kind].name}</span></button>)}
          {available.length === 0 && <p>Aucun bloc trouvé.</p>}
        </div>
        <label className="world-editor-protected-option"><input type="checkbox" checked={protectedPlacement} onChange={(event) => setProtectedPlacement(event.target.checked)} /> Poser des blocs incassables</label>
      </div>
      <div className="world-editor-stage">
        <div className="world-editor-toolbar">
          <div className="world-editor-tools" aria-label="Outils de construction et du joueur">
            <button type="button" className={tool === 'place' ? 'selected' : ''} onClick={() => setTool('place')}>Poser</button>
            <button type="button" className={tool === 'erase' ? 'selected' : ''} onClick={() => setTool('erase')}>Enlever</button>
            <button type="button" className={tool === 'protect' ? 'selected' : ''} aria-pressed={tool === 'protect'} title="Clique sur un bloc pour le rendre incassable ou cassable" onClick={() => setTool('protect')}>Protéger</button>
            <button type="button" onClick={undo} disabled={history.length === 0}>Annuler</button>
            <button type="button" className={playerVisible ? 'selected' : ''} aria-pressed={playerVisible} onClick={() => setPlayerVisible((visible) => !visible)}>{playerVisible ? 'Joueur visible' : 'Joueur caché'}</button>
            <button type="button" onClick={() => { setSpawnPoint(null); setResetKey((value) => value + 1); setMessage('Joueur replacé au point de départ.'); }}>Recentrer</button>
            <button type="button" className="world-editor-save" onClick={() => setMessage(onSaveDraft() ? 'Brouillon sauvegardé sur cet appareil. Tu peux continuer à construire.' : 'Sauvegarde impossible sur cet appareil.')}>Sauvegarder</button>
          </div>
          <label>Éditeur<select aria-label="Taille de l’éditeur" value={infinite ? 'infinite' : 'finite'} onChange={(event) => onInfiniteChange(event.target.value === 'infinite')}><option value="finite">Fini · 65 × 65</option><option value="infinite">Infini · exploration libre</option></select></label>
          <label>Terrain<select value={terrain} onChange={(event) => onTerrainChange(event.target.value as CustomTerrain)}><option value="flat">Plat infini</option><option value="natural">Naturel infini</option></select></label>
        </div>
        <div className="world-editor-canvas">
          <Canvas frameloop={playerVisible ? 'always' : 'demand'} dpr={1} camera={{ position: [20, 20, 24], fov: 50, near: 0.1, far: 200 }} gl={{ antialias: false }} onContextMenu={(event) => event.preventDefault()}>
            <EditorScene blocks={blocks} terrain={terrain} seed={seed} erase={tool === 'erase'} onInteract={interact} playerVisible={playerVisible} resetKey={resetKey} keys={keys} infinite={infinite} spawnPoint={spawnPoint} />
          </Canvas>
        </div>
        <p className="world-editor-help">WASD ou flèches : déplacer le joueur · Espace : sauter · glisser pour tourner · clic pour poser · Enlever ou clic droit pour retirer · Protéger puis clic pour changer la résistance d’un bloc</p>
        <div className="world-editor-coordinates">
          {(['x', 'y', 'z'] as const).map((axis) => <label key={axis}>{axis.toUpperCase()}<input type="number" value={position[axis]} onChange={(event) => setPosition({ ...position, [axis]: event.target.value })} min={axis === 'y' ? 1 : infinite ? -INFINITE_EDITOR_COORDINATE : -CUSTOM_WORLD_RADIUS} max={axis === 'y' ? CUSTOM_WORLD_MAX_Y : infinite ? INFINITE_EDITOR_COORDINATE : CUSTOM_WORLD_RADIUS} /></label>)}
          <button type="button" className="secondary-button" onClick={() => put(Number(position.x), Number(position.y), Number(position.z))}>Poser ici</button>
          {infinite && <button type="button" className="secondary-button" onClick={() => { const x = Number(position.x); const y = Number(position.y); const z = Number(position.z); if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(z) || y < 1 || y > CUSTOM_WORLD_MAX_Y) { setMessage('Coordonnées de téléportation invalides.'); return; } setSpawnPoint({ x, y: y + 0.51, z }); setResetKey((value) => value + 1); setMessage(`Joueur téléporté en ${x}, ${y + 0.51}, ${z}.`); }}>Aller à X, Y, Z</button>}
          <button type="button" className="text-button" onClick={() => { if (blocks.length === 0 || window.confirm('Retirer tous les blocs de cette construction ?')) { update([]); setMessage('Construction vidée.'); } }}>Vider</button>
        </div>
        <p className="world-editor-status" role="status"><strong>{blocks.length} / {CUSTOM_WORLD_MAX_BLOCKS} blocs</strong> · {message}{draftNotice ? ` · ${draftNotice}` : ''}</p>
      </div>
    </div>
  );
}
