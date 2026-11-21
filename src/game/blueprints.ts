import { create } from 'zustand';
import type { World } from 'koota';
import { applyVoxelEdit, getColumnTop } from './chunks';
import { constructionTemplate } from './constructionTemplates';
import { translate } from './language';
import { saveWorld } from './save';
import { useGameStore } from './store';
import { Player, PlayerPosition, PlayerState } from './traits';
import { voxelKey } from './voxel';
import type { Voxel } from './voxel';
import { world } from './world';

export type BlueprintKind = 'church' | 'farm';
type Blueprint = { kind: BlueprintKind; worldId: string; anchorX: number; anchorZ: number; ground: number; quarter: number; blocks: Voxel[]; index: number };

export const useBlueprintStore = create<{ active: Blueprint | null; setActive: (active: Blueprint | null) => void }>((set) => ({ active: null, setActive: (active) => set({ active }) }));

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

function persist(active: Blueprint | null) {
  try {
    if (!active) return;
    if (active.index >= active.blocks.length) localStorage.removeItem(storageKey(active.worldId));
    else localStorage.setItem(storageKey(active.worldId), JSON.stringify({ kind: active.kind, anchorX: active.anchorX, anchorZ: active.anchorZ, ground: active.ground, quarter: active.quarter, index: active.index }));
  } catch {
  }
}

export function startBlueprint(world: World, kind: BlueprintKind) {
  const placement = computePlacement(world, kind);
  if (!placement) return false;
  const active: Blueprint = { kind, worldId: useGameStore.getState().worldId, ...placement, blocks: positionedBlocks(kind, placement.anchorX, placement.anchorZ, placement.ground, placement.quarter), index: 0 };
  persist(active);
  useBlueprintStore.setState({ active });
  return true;
}

export function resumeBlueprint(world: World) {
  const current = useBlueprintStore.getState().active;
  const worldId = useGameStore.getState().worldId;
  if (current?.worldId === worldId) return;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(worldId)) ?? 'null');
    if (!saved || (saved.kind !== 'church' && saved.kind !== 'farm') || ![saved.anchorX, saved.anchorZ, saved.ground, saved.quarter, saved.index].every(Number.isFinite)) return;
    const blocks = positionedBlocks(saved.kind, saved.anchorX, saved.anchorZ, saved.ground, saved.quarter);
    useBlueprintStore.setState({ active: { kind: saved.kind, worldId, anchorX: saved.anchorX, anchorZ: saved.anchorZ, ground: saved.ground, quarter: saved.quarter, blocks, index: Math.max(0, Math.min(blocks.length, saved.index)) } });
  } catch {
  }
}

export function placeNextBlueprintBlock() {
  const active = useBlueprintStore.getState().active;
  if (!active || active.index >= active.blocks.length) return false;
  const block = active.blocks[active.index];
  applyVoxelEdit(world, voxelKey(block.x, block.y, block.z), { kind: block.kind, growth: block.growth, facing: block.facing, text: block.text }, true);
  const next = { ...active, index: active.index + 1 };
  persist(next);
  useBlueprintStore.setState({ active: next.index >= next.blocks.length ? null : next });
  if (next.index % 10 === 0 || next.index >= next.blocks.length) saveWorld(world);
  if (next.index >= next.blocks.length) useGameStore.getState().setNotice(translate('Construction terminée !', 'Construction complete!'));
  return true;
}

export function moveBlueprint(world: World) {
  const active = useBlueprintStore.getState().active;
  if (!active || active.index > 0) return false;
  const placement = computePlacement(world, active.kind);
  if (!placement) return false;
  const next = { ...active, ...placement, blocks: positionedBlocks(active.kind, placement.anchorX, placement.anchorZ, placement.ground, placement.quarter) };
  persist(next);
  useBlueprintStore.setState({ active: next });
  return true;
}

export function cancelBlueprint() {
  const active = useBlueprintStore.getState().active;
  if (!active) return;
  try { localStorage.removeItem(storageKey(active.worldId)); } catch {
  }
  useBlueprintStore.setState({ active: null });
}
