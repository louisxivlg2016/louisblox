import { create } from 'zustand';
import type { World } from 'koota';
import { useBattleStore, respawnAtBase } from './battle';
import { useGameStore } from './store';
import { useMultiplayerStore } from './multiplayerStore';
import { Chunk, Player, PlayerPosition, PlayerState } from './traits';
import { getBlockIndex, replaceVoxel, streamChunks } from './chunks';
import { world } from './world';
import { MAZE_BARRIERS, MAZE_OVERVIEW, mazeSpawn } from './maze';
import { MAZE_PLAYGROUND_BOUNDS, mazePlaygroundSpawn } from './mazePlayground';
import { playWhistle } from './audio';
import { BlockKind, voxelKey } from './voxel';
import { releasePointerForOverlay, stopMining } from './input';
import { translate } from './language';
import { useMazeCourseStore } from './mazeCourses';

export type MazePhase = 'playground' | 'waiting' | 'ready' | 'countdown' | 'running' | 'finished' | 'lost';
type MazeState = { phase: MazePhase; phaseUntil: number; startedAt: number; winner: string | null; winnerName: string | null; finishMs: number; notice: string; whistleToken: number; barriersOpen: boolean; overview: boolean; spawn: { x: number; y: number; z: number } };
const initial = { phase: 'playground' as const, phaseUntil: 0, startedAt: 0, winner: null, winnerName: null, finishMs: 0, notice: translate('Franchis le parcours pour débloquer le Labyrinthe', 'Complete the obstacle course to unlock the Maze'), whistleToken: 0, barriersOpen: false, overview: false, spawn: mazePlaygroundSpawn(0) };
export const useMazeStore = create<MazeState>(() => ({ ...initial, spawn: { ...initial.spawn } }));
let socket: WebSocket | null = null;
let lastWhistle = 0;

export function setMazeSocket(next: WebSocket | null) { socket = next; }
export function clearMaze() {
  socket = null;
  lastWhistle = 0;
  useMazeCourseStore.getState().setCourse(0);
  useMazeStore.setState({ ...initial, spawn: { ...initial.spawn } });
}
function send(type: string) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type }));
}
function applyMazeBarriers(open: boolean) {
  if (world.query(Chunk).length === 0) return;
  for (const { x, y, z } of MAZE_BARRIERS) {
    const block = getBlockIndex(world).get(`${x},${y},${z}`);
    if (block && block.open !== open) replaceVoxel(world, { block, x, y, z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, block.kind, open);
  }
}

function startSoloMaze() {
  if (useGameStore.getState().gameplayMode !== 'maze') return;
  const spawn = mazeSpawn(0);
  applyMazeBarriers(false);
  respawnAtBase(world, null, spawn);
  world.queryFirst(Player)?.set(PlayerState, { yaw: 0, pitch: 0 });
  useMazeStore.setState({ phase: 'countdown', phaseUntil: Date.now() + 3000, startedAt: 0, winner: null, winnerName: null, finishMs: 0, notice: translate('Prépare-toi pour le départ', 'Get ready for the start'), barriersOpen: false, overview: false, spawn });
}

export function requestMazeStart() {
  if (socket?.readyState === WebSocket.OPEN) send('maze-start');
  else if (!useMultiplayerStore.getState().enabled) startSoloMaze();
}
export function requestMazeReset() {
  if (socket?.readyState === WebSocket.OPEN) send('maze-reset');
  else if (!useMultiplayerStore.getState().enabled) startSoloMaze();
}

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
  const phases: MazePhase[] = ['playground', 'waiting', 'ready', 'countdown', 'running', 'finished', 'lost'];
  const incomingPhase = phases.includes(data.phase as MazePhase) ? data.phase as MazePhase : 'waiting';
  const phase = useMazeStore.getState().phase === 'lost' && incomingPhase === 'finished' ? 'lost' : incomingPhase;
  if ((phase === 'finished' || phase === 'lost') && useMazeStore.getState().phase !== 'finished' && useMazeStore.getState().phase !== 'lost') releasePointerForOverlay();
  const barriersOpen = data.barriersOpen === true;
  if (useMazeStore.getState().barriersOpen !== barriersOpen) applyMazeBarriers(barriersOpen);
  if (typeof data.course === 'number' && Number.isInteger(data.course) && data.course >= 0 && data.course < 100 && data.course !== useMazeCourseStore.getState().index) {
    useMazeCourseStore.getState().setCourse(data.course);
    useGameStore.setState({ generation: useGameStore.getState().generation + 1 });
  }
  useMazeStore.setState({
    phase,
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
  for (let index = 0; index < 12; index += 1) streamChunks(world, spawn.x, spawn.z);
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
  if (state.phase === 'playground' || state.phase === 'finished' || state.phase === 'lost') return false;
  return !state.overview && state.phase !== 'running';
}

export function mazeBounds() {
  const phase = useMazeStore.getState().phase;
  if (phase === 'playground' || phase === 'finished' || phase === 'lost') return MAZE_PLAYGROUND_BOUNDS;
  return useMazeStore.getState().overview ? { minX: -2, maxX: 2, minZ: 22, maxZ: 26 } : { minX: -21.5, maxX: 21.5, minZ: -24.5, maxZ: 24.5 };
}

export function mazeControlSystem(_world: World) {
  if (useGameStore.getState().gameplayMode !== 'maze') return false;
  const playgroundState = useMazeStore.getState();
  const playgroundPosition = _world.queryFirst(Player)?.get(PlayerPosition);
  if (playgroundState.phase === 'finished' && playgroundPosition) {
    const flame = getBlockIndex(_world).get(voxelKey(Math.round(playgroundPosition.x), Math.round(playgroundPosition.y + 0.2), Math.round(playgroundPosition.z)));
    if (flame?.kind === BlockKind.Wildfire) {
      const spawn = playgroundState.spawn ?? mazePlaygroundSpawn(0);
      releasePointerForOverlay();
      respawnAtBase(_world, null, spawn);
      useMazeStore.setState({ phase: 'lost', notice: translate('Tu as perdu dans la lave !', 'You lost in the lava!'), spawn, overview: false });
      return true;
    }
  }
  if (!socket && !useMultiplayerStore.getState().enabled) {
    const state = useMazeStore.getState();
    const position = _world.queryFirst(Player)?.get(PlayerPosition);
    if (state.phase === 'playground' && position && Math.abs(position.x - 128) <= 4 && position.z >= 90 && position.z <= 99 && position.y < 14) {
      const spawn = mazeSpawn(0);
      for (let index = 0; index < 12; index += 1) streamChunks(_world, spawn.x, spawn.z);
      respawnAtBase(_world, null, spawn);
      useMazeStore.setState({ phase: 'waiting', notice: translate('Labyrinthe débloqué · prépare-toi pour la course', 'Maze unlocked · get ready for the race'), spawn, overview: false });
      return true;
    }
    if (state.phase === 'countdown' && Date.now() >= state.phaseUntil) {
      playWhistle('short');
      applyMazeBarriers(true);
      useMazeStore.setState({ phase: 'running', startedAt: Date.now(), notice: 'Trouve la ligne jaune au nord du labyrinthe.', barriersOpen: true });
    }
    const current = useMazeStore.getState();
    if (current.phase === 'running' && position && Math.abs(position.x - 18) <= 2 && position.z >= -25 && position.z <= -22 && Math.abs(position.y - 8.51) < 4) {
      playWhistle('goal');
      releasePointerForOverlay();
      const course = useMazeCourseStore.getState().nextCourse();
      useGameStore.setState({ generation: useGameStore.getState().generation + 1 });
      const spawn = mazePlaygroundSpawn(0);
      for (let index = 0; index < 12; index += 1) streamChunks(_world, spawn.x, spawn.z);
      respawnAtBase(_world, null, spawn);
      _world.queryFirst(Player)?.set(PlayerState, { yaw: 0, pitch: 0 });
      useMazeStore.setState({ phase: 'finished', winner: 'solo', winnerName: useMultiplayerStore.getState().playerName, finishMs: Date.now() - current.startedAt, notice: translate(`Parcours ${course + 1}/100 débloqué`, `Course ${course + 1}/100 unlocked`), whistleToken: current.whistleToken + 1, spawn, overview: false });
    }
  }
  stopMining();
  return true;
}
