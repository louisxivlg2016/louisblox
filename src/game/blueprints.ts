import { create } from 'zustand';
import type { World } from 'koota';
import { applyVoxelEdit, applyVoxelEdits, chunkCoordinate, getColumnTop, isChunkLoaded, loadChunk } from './chunks';
import { constructionTemplate } from './constructionTemplates';
import { translate } from './language';
import { saveWorld } from './save';
import { useGameStore } from './store';
import { Player, PlayerPosition, PlayerState } from './traits';
import { voxelKey } from './voxel';
import type { Voxel } from './voxel';
import { world } from './world';
import { allowsConstruction } from './worldMode';

export type BlueprintKind = 'church' | 'farm' | 'paris' | 'skyscraper' | 'villa';
type Blueprint = { kind: BlueprintKind; worldId: string; anchorX: number; anchorZ: number; ground: number; quarter: number; blocks: Voxel[]; index: number };

export const useBlueprintStore = create<{ active: Blueprint | null; autoBuilding: boolean; setActive: (active: Blueprint | null) => void }>((set) => ({ active: null, autoBuilding: false, setActive: (active) => set({ active }) }));
let autoBuildTimer: ReturnType<typeof setInterval> | null = null;

function stopAutoBuild() {
  if (autoBuildTimer) clearInterval(autoBuildTimer);
  autoBuildTimer = null;
  useBlueprintStore.setState({ autoBuilding: false });
}

function storageKey(worldId: string) {
  return `louisblox-blueprint-${worldId}`;
}

function computePlacement(world: World, kind: BlueprintKind) {
  const entity = world.queryFirst(Player);
  const position = entity?.get(PlayerPosition);
  const state = entity?.get(PlayerState);
  if (!position || !state) return null;
  const distance = kind === 'church' ? 27 : 35;
  return {
    anchorX: Math.round(position.x - Math.sin(state.yaw) * distance),
    anchorZ: Math.round(position.z - Math.cos(state.yaw) * distance),
    ground: getColumnTop(world, Math.round(position.x), Math.round(position.z)) ?? Math.floor(position.y - 0.5),
    quarter: ((Math.round(state.yaw / (Math.PI / 2)) % 4) + 4) % 4,
  };
}

function positionedBlocks(kind: BlueprintKind, anchorX: number, anchorZ: number, ground: number, quarter: number) {
  const directions = ['north', 'east', 'south', 'west'] as const;
  return constructionTemplate(kind).map((block) => {
    const x = quarter === 1 ? block.z : quarter === 2 ? -block.x : quarter === 3 ? -block.z : block.x;
    const z = quarter === 1 ? -block.x : quarter === 2 ? -block.z : quarter === 3 ? block.x : block.z;
    return { ...block, x: x + anchorX, y: block.y + ground, z: z + anchorZ, facing: block.facing ? directions[(directions.indexOf(block.facing) + quarter) % 4] : undefined };
  });
}

function ensureBlueprintChunks(blocks: Voxel[]) {
  const chunks = new Set<string>();
  for (const block of blocks) {
    const cx = chunkCoordinate(block.x);
    const cz = chunkCoordinate(block.z);
    const key = `${cx},${cz}`;
    if (chunks.has(key)) continue;
    chunks.add(key);
    if (!isChunkLoaded(world, block.x, block.z)) loadChunk(world, cx, cz);
  }
}

function persist(active: Blueprint | null) {
  try {
    if (!active) return;
    if (active.index >= active.blocks.length) localStorage.removeItem(storageKey(active.worldId));
    else localStorage.setItem(storageKey(active.worldId), JSON.stringify({ kind: active.kind, anchorX: active.anchorX, anchorZ: active.anchorZ, ground: active.ground, quarter: active.quarter, index: active.index }));
  } catch {
  }
}

export function startBlueprint(world: World, kind: BlueprintKind) {
  if (!allowsConstruction(useGameStore.getState().gameplayMode)) return false;
  stopAutoBuild();
  const placement = computePlacement(world, kind);
  if (!placement) return false;
  const active: Blueprint = { kind, worldId: useGameStore.getState().worldId, ...placement, blocks: positionedBlocks(kind, placement.anchorX, placement.anchorZ, placement.ground, placement.quarter), index: 0 };
  ensureBlueprintChunks(active.blocks);
  persist(active);
  useBlueprintStore.setState({ active });
  return true;
}

export function resumeBlueprint(world: World) {
  if (!allowsConstruction(useGameStore.getState().gameplayMode)) return;
  const current = useBlueprintStore.getState().active;
  const worldId = useGameStore.getState().worldId;
  if (current?.worldId === worldId) return;
  stopAutoBuild();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(worldId)) ?? 'null');
    if (!saved || (!['church', 'farm', 'paris', 'skyscraper', 'villa'].includes(saved.kind)) || ![saved.anchorX, saved.anchorZ, saved.ground, saved.quarter, saved.index].every(Number.isFinite)) return;
    const blocks = positionedBlocks(saved.kind, saved.anchorX, saved.anchorZ, saved.ground, saved.quarter);
    ensureBlueprintChunks(blocks);
    useBlueprintStore.setState({ active: { kind: saved.kind, worldId, anchorX: saved.anchorX, anchorZ: saved.anchorZ, ground: saved.ground, quarter: saved.quarter, blocks, index: Math.max(0, Math.min(blocks.length, saved.index)) } });
  } catch {
  }
}

export function placeNextBlueprintBlock() {
  if (!allowsConstruction(useGameStore.getState().gameplayMode)) return false;
  const active = useBlueprintStore.getState().active;
  if (!active || active.index >= active.blocks.length || useBlueprintStore.getState().autoBuilding) return false;
  const block = active.blocks[active.index];
  applyVoxelEdit(world, voxelKey(block.x, block.y, block.z), { kind: block.kind, growth: block.growth, facing: block.facing, text: block.text }, true);
  const next = { ...active, index: active.index + 1 };
  persist(next);
  useBlueprintStore.setState({ active: next.index >= next.blocks.length ? null : next });
  if (next.index % 10 === 0 || next.index >= next.blocks.length) saveWorld(world);
  if (next.index >= next.blocks.length) useGameStore.getState().setNotice(translate('Construction terminée !', 'Construction complete!'));
  return true;
}

export function autoBuildBlueprint() {
  if (!allowsConstruction(useGameStore.getState().gameplayMode)) return false;
  const active = useBlueprintStore.getState().active;
  if (!active || active.index >= active.blocks.length || autoBuildTimer) return false;
  ensureBlueprintChunks(active.blocks);
  const firstIndex = active.index;
  const startedAt = performance.now();
  let appliedStep = 0;
  useBlueprintStore.setState({ autoBuilding: true });
  const tick = () => {
    const current = useBlueprintStore.getState().active;
    if (!current || current.worldId !== active.worldId || !allowsConstruction(useGameStore.getState().gameplayMode)) {
      stopAutoBuild();
      return;
    }
    const progress = Math.min(1, (performance.now() - startedAt) / 3000);
    const step = progress === 1 ? 3 : Math.floor(progress * 3);
    if (step > appliedStep) {
      appliedStep = step;
      const target = progress === 1 ? current.blocks.length : Math.min(current.blocks.length - 1, firstIndex + Math.floor((current.blocks.length - firstIndex) * step / 3));
      const edits: Parameters<typeof applyVoxelEdits>[1] = current.blocks.slice(current.index, target).map((block) => [voxelKey(block.x, block.y, block.z), { kind: block.kind, growth: block.growth, facing: block.facing, text: block.text }]);
      applyVoxelEdits(world, edits, true);
      const next = { ...current, index: target };
      persist(next);
      useBlueprintStore.setState({ active: target >= next.blocks.length ? null : next });
    }
    if (progress === 1) {
      stopAutoBuild();
      saveWorld(world);
      useGameStore.getState().setNotice(translate('Construction terminée en 3 secondes !', 'Construction completed in 3 seconds!'));
    }
  };
  autoBuildTimer = setInterval(tick, 50);
  tick();
  return true;
}

export function moveBlueprint(world: World) {
  if (!allowsConstruction(useGameStore.getState().gameplayMode)) return false;
  const active = useBlueprintStore.getState().active;
  if (!active || active.index > 0 || useBlueprintStore.getState().autoBuilding) return false;
  const placement = computePlacement(world, active.kind);
  if (!placement) return false;
  const next = { ...active, ...placement, blocks: positionedBlocks(active.kind, placement.anchorX, placement.anchorZ, placement.ground, placement.quarter) };
  ensureBlueprintChunks(next.blocks);
  persist(next);
  useBlueprintStore.setState({ active: next });
  return true;
}

export function cancelBlueprint() {
  stopAutoBuild();
  const active = useBlueprintStore.getState().active;
  if (!active) return;
  try { localStorage.removeItem(storageKey(active.worldId)); } catch {
  }
  useBlueprintStore.setState({ active: null });
}
