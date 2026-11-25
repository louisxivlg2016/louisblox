import { create } from 'zustand';
import type { World } from 'koota';
import { useGameStore } from './store';
import { Player, PlayerHealth, PlayerPosition } from './traits';
import { addVoxel, explodeVoxels } from './chunks';
import { BlockKind } from './voxel';
import { releasePointerForOverlay } from './input';
import { respawnAtBase } from './battle';
import { SKYFALL_SPAWN } from './skyfallArena';
import { world } from './world';

export type FallingBlock = { id: string; x: number; y: number; z: number; kind: 'tnt' | 'anvil' | 'safe'; speed: number };
const initial = { phase: 'waiting' as 'waiting' | 'running' | 'finished', startedAt: 0, nextSpawnAt: 0, blocks: [] as FallingBlock[], bestMs: 0 };
export const useSkyfallStore = create<typeof initial>(() => ({ ...initial }));
export function clearSkyfall() { useSkyfallStore.setState({ ...initial, blocks: [] }); }

function spawnBlock(state: typeof initial) {
  const kinds: FallingBlock['kind'][] = ['tnt', 'anvil', 'safe', 'safe'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const block: FallingBlock = { id: crypto.randomUUID(), x: Math.round((Math.random() - 0.5) * 36), y: 26, z: Math.round((Math.random() - 0.5) * 36), kind, speed: kind === 'anvil' ? 14 : kind === 'tnt' ? 10 : 8 };
  useSkyfallStore.setState({ blocks: [...state.blocks, block], nextSpawnAt: Date.now() + Math.max(350, 1100 - (Date.now() - state.startedAt) / 60) });
}

export function skyfallControlSystem(world: World, dt: number) {
  if (useGameStore.getState().gameplayMode !== 'skyfall') return false;
  let state = useSkyfallStore.getState();
  if (state.phase === 'waiting') {
    respawnAtBase(world, null, SKYFALL_SPAWN);
    world.queryFirst(Player)?.set(PlayerHealth, { value: 10, absorbed: 0 });
    useSkyfallStore.setState({ phase: 'running', startedAt: Date.now(), nextSpawnAt: Date.now() + 500 });
    state = useSkyfallStore.getState();
  }
  if (state.phase !== 'running') return true;
  if (Date.now() >= state.nextSpawnAt) spawnBlock(state);
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const health = world.queryFirst(Player)?.get(PlayerHealth);
  if (!player || !health) return true;
  const remaining: FallingBlock[] = [];
  for (const block of useSkyfallStore.getState().blocks) {
    const y = block.y - block.speed * dt;
    const close = Math.hypot(player.x - block.x, player.z - block.z) < 1.1 && Math.abs(player.y + 0.8 - y) < 1.5;
    if (close && block.kind !== 'safe') {
      health.value = Math.max(0, health.value - (block.kind === 'anvil' ? 5 : 3));
      if (health.value <= 0) {
        const bestMs = Math.max(useSkyfallStore.getState().bestMs, Date.now() - state.startedAt);
        useSkyfallStore.setState({ phase: 'finished', bestMs });
        releasePointerForOverlay();
        return true;
      }
    }
    if (y > 7.5) {
      remaining.push({ ...block, y });
      continue;
    }
    if (block.kind === 'safe') addVoxel(world, block.x, 8, block.z, BlockKind.ConcreteLime, undefined, undefined, 0, undefined, undefined, false, true);
    else {
      explodeVoxels(world, block.x, 8, block.z, block.kind === 'anvil' ? 2.5 : 1.8);
      if (Math.hypot(player.x - block.x, player.z - block.z) < 2.5) health.value = Math.max(0, health.value - 2);
    }
  }
  if (player.y < 2 || health.value <= 0) {
    const bestMs = Math.max(useSkyfallStore.getState().bestMs, Date.now() - state.startedAt);
    useSkyfallStore.setState({ phase: 'finished', bestMs });
    releasePointerForOverlay();
    return true;
  }
  useSkyfallStore.setState({ blocks: remaining });
  return true;
}
