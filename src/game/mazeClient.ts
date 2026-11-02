import { create } from 'zustand';
import type { World } from 'koota';
import { useBattleStore, respawnAtBase } from './battle';
import { useGameStore } from './store';
import { Player, PlayerState } from './traits';
import { world } from './world';
import { MAZE_OVERVIEW, mazeSpawn } from './maze';
import { playWhistle } from './audio';
import { stopMining } from './input';

export type MazePhase = 'waiting' | 'ready' | 'countdown' | 'running' | 'finished';
type MazeState = { phase: MazePhase; phaseUntil: number; startedAt: number; winner: string | null; winnerName: string | null; finishMs: number; notice: string; whistleToken: number; barriersOpen: boolean; overview: boolean; spawn: { x: number; y: number; z: number } };
const initial = { phase: 'waiting' as const, phaseUntil: 0, startedAt: 0, winner: null, winnerName: null, finishMs: 0, notice: 'L’arbitre prépare le départ', whistleToken: 0, barriersOpen: false, overview: false, spawn: mazeSpawn(0) };
export const useMazeStore = create<MazeState>(() => ({ ...initial, spawn: { ...initial.spawn } }));
let socket: WebSocket | null = null;
let lastWhistle = 0;

export function setMazeSocket(next: WebSocket | null) { socket = next; }
export function clearMaze() {
  socket = null;
  lastWhistle = 0;
  useMazeStore.setState({ ...initial, spawn: { ...initial.spawn } });
}
function send(type: string) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type }));
}
export function requestMazeStart() { send('maze-start'); }
export function requestMazeReset() { send('maze-reset'); }

function number(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function receiveMazeState(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  const token = Math.floor(number(data.whistleToken, 0));
  if (token > lastWhistle) {
    playWhistle(data.phase === 'finished' || data.phase === 'running' ? 'goal' : 'short');
    lastWhistle = token;
  }
  const phases: MazePhase[] = ['waiting', 'ready', 'countdown', 'running', 'finished'];
  useMazeStore.setState({
    phase: phases.includes(data.phase as MazePhase) ? data.phase as MazePhase : 'waiting',
    phaseUntil: number(data.phaseUntil, 0), startedAt: number(data.startedAt, 0),
    winner: typeof data.winner === 'string' ? data.winner : null,
    winnerName: typeof data.winnerName === 'string' ? data.winnerName.slice(0, 24) : null,
    finishMs: Math.max(0, number(data.finishMs, 0)),
    notice: typeof data.notice === 'string' ? data.notice.slice(0, 120) : '', whistleToken: token,
    barriersOpen: data.barriersOpen === true,
  });
}

export function receiveMazeSpawn(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const positions = (value as { positions?: unknown }).positions;
  const localId = useBattleStore.getState().localPlayerId;
  if (!localId || !positions || typeof positions !== 'object') return;
  const point = (positions as Record<string, unknown>)[localId];
  if (!point || typeof point !== 'object') return;
  const position = point as Record<string, unknown>;
  if (!['x', 'y', 'z'].every((key) => typeof position[key] === 'number' && Number.isFinite(position[key]))) return;
  const spawn = { x: position.x as number, y: position.y as number, z: position.z as number };
  useMazeStore.setState({ spawn, overview: false });
  respawnAtBase(world, null, spawn);
  const player = world.queryFirst(Player);
  if (player) player.set(PlayerState, { yaw: number(position.yaw, 0), pitch: 0 });
}

export function toggleMazeOverview() {
  const state = useMazeStore.getState();
  const overview = !state.overview;
  const spawn = overview ? MAZE_OVERVIEW : state.spawn;
  useMazeStore.setState({ overview });
  respawnAtBase(world, null, spawn);
  const player = world.queryFirst(Player);
  if (player) player.set(PlayerState, { yaw: 0, pitch: overview ? -0.78 : 0 });
}

export function isMazeFrozen() {
  const state = useMazeStore.getState();
  return !state.overview && state.phase !== 'running';
}

export function mazeBounds() {
  return useMazeStore.getState().overview ? { minX: -2, maxX: 2, minZ: 22, maxZ: 26 } : { minX: -21.5, maxX: 21.5, minZ: -24.5, maxZ: 24.5 };
}

export function mazeControlSystem(_world: World) {
  if (useGameStore.getState().gameplayMode !== 'maze') return false;
  stopMining();
  return true;
}
