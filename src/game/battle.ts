import { create } from 'zustand';
import type { World } from 'koota';
import { battleSpawn, isBattleTeam } from './battleArena';
import type { BattleTeam } from './battleArena';
import { useGameStore } from './store';
import { Player, PlayerBody, PlayerHealth, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity } from './traits';
import { world } from './world';
import { dismount } from './vehicles';
import { useEffectStore } from './effects';
import { pirateSpawn } from './pirates';
import { footballSpawn } from './footballArena';

export type BattleHitKind = 'bullet' | 'rifle' | 'arrow' | 'bomb' | 'melee';
export type BattleEvent = { id: string; killerName: string; victimName: string };
type Scores = { red: number; blue: number };

type BattleStore = {
  team: BattleTeam | null;
  teams: Record<string, BattleTeam>;
  health: Record<string, number>;
  scores: Scores;
  playerScores: Record<string, number>;
  names: Record<string, string>;
  localPlayerId: string | null;
  events: BattleEvent[];
  deadUntil: number;
  ready: boolean;
  setLocalPlayerId: (playerId: string | null) => void;
  clear: () => void;
};

const initialState = {
  team: null,
  teams: {},
  health: {},
  scores: { red: 0, blue: 0 },
  playerScores: {},
  names: {},
  localPlayerId: null,
  events: [],
  deadUntil: 0,
  ready: false,
};

export const useBattleStore = create<BattleStore>((set) => ({
  ...initialState,
  setLocalPlayerId: (localPlayerId) => set({ localPlayerId }),
  clear: () => set({ ...initialState, teams: {}, health: {}, scores: { red: 0, blue: 0 }, playerScores: {}, names: {}, events: [] }),
}));

let socket: WebSocket | null = null;
let deathTimer: number | undefined;

export function setBattleSocket(next: WebSocket | null) {
  socket = next;
}

export function setBattleLocalPlayer(playerId: string | null) {
  useBattleStore.getState().setLocalPlayerId(playerId);
}

export function clearBattle() {
  socket = null;
  if (deathTimer !== undefined) window.clearTimeout(deathTimer);
  deathTimer = undefined;
  useBattleStore.getState().clear();
}

export function respawnAtBase(world: World, team: BattleTeam | null, position = useGameStore.getState().gameplayMode === 'pirates' ? pirateSpawn(team === 'blue' ? 'blue' : 'red') : useGameStore.getState().gameplayMode === 'football' ? footballSpawn(team === 'blue' ? 'blue' : 'red') : battleSpawn(team)) {
  const player = world.queryFirst(Player);
  if (!player) return;
  useEffectStore.getState().reset();
  if (player.get(PlayerMount)?.vehicle) dismount(world);
  player.get(PlayerPosition)?.set(position.x, position.y, position.z);
  player.get(PlayerBody)?.value?.setTranslation(position, true);
  player.get(PlayerVelocity)?.set(0, 0, 0);
  player.set(PlayerState, { flying: false, grounded: false });
  player.set(PlayerHealth, { value: 10, absorbed: 0 });
  useGameStore.getState().setFlying(false);
  useGameStore.getState().setLives(10);
}

export function chooseBattleTeam(team: 'red' | 'blue' | 'solo' | 'auto') {
  const { localPlayerId, ready, team: currentTeam } = useBattleStore.getState();
  if (socket?.readyState !== WebSocket.OPEN || !ready || (team === 'solo' && !localPlayerId)) return false;
  const nextTeam: BattleTeam = team === 'auto' ? 'red' : team === 'solo' ? `solo:${localPlayerId}` : team;
  if (currentTeam === nextTeam) return true;
  socket.send(JSON.stringify({ type: 'battle-team', team }));
  useBattleStore.setState({ team: nextTeam });
  respawnAtBase(world, nextTeam);
  return true;
}

export function requestBattleHit(targetId: string, kind: BattleHitKind) {
  if (socket?.readyState !== WebSocket.OPEN || !useBattleStore.getState().team) return;
  socket.send(JSON.stringify({ type: 'battle-hit', targetId, kind }));
}

export function requestBattleHeal(amount: number) {
  if (socket?.readyState !== WebSocket.OPEN || !useBattleStore.getState().team) return;
  socket.send(JSON.stringify({ type: 'battle-heal', amount }));
}

export function receiveBattleState(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  const sourceTeams = data.teams && typeof data.teams === 'object' ? data.teams as Record<string, unknown> : {};
  const sourceHealth = data.health && typeof data.health === 'object' ? data.health as Record<string, unknown> : {};
  const sourceScores = data.scores && typeof data.scores === 'object' ? data.scores as Record<string, unknown> : {};
  const teams: Record<string, BattleTeam> = {};
  const health: Record<string, number> = {};
  for (const [playerId, team] of Object.entries(sourceTeams)) {
    if (isBattleTeam(team)) teams[playerId] = team === 'solo' ? `solo:${playerId}` : team;
  }
  const sourcePlayerScores = data.playerScores && typeof data.playerScores === 'object' ? data.playerScores as Record<string, unknown> : {};
  const playerScores: Record<string, number> = {};
  for (const [playerId, kills] of Object.entries(sourcePlayerScores)) {
    if (typeof kills === 'number' && Number.isFinite(kills) && kills >= 0) playerScores[playerId] = Math.floor(kills);
  }
  const sourceNames = data.names && typeof data.names === 'object' ? data.names as Record<string, unknown> : {};
  const names: Record<string, string> = {};
  for (const [playerId, name] of Object.entries(sourceNames)) {
    if (typeof name === 'string') names[playerId] = name.slice(0, 24);
  }
  for (const [playerId, lives] of Object.entries(sourceHealth)) {
    if (typeof lives === 'number' && Number.isFinite(lives) && lives >= 0 && lives <= 10) health[playerId] = lives;
  }
  const scores = {
    red: typeof sourceScores.red === 'number' && sourceScores.red >= 0 ? Math.floor(sourceScores.red) : 0,
    blue: typeof sourceScores.blue === 'number' && sourceScores.blue >= 0 ? Math.floor(sourceScores.blue) : 0,
  };
  const localPlayerId = useBattleStore.getState().localPlayerId;
  useBattleStore.setState({ teams, health, scores, playerScores, names, team: localPlayerId ? teams[localPlayerId] ?? null : null });
  const lives = localPlayerId ? health[localPlayerId] : undefined;
  if (lives !== undefined) {
    world.queryFirst(Player)?.set(PlayerHealth, { value: lives });
    useGameStore.getState().setLives(lives);
  }
}

export function receiveBattleElimination(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  if (typeof data.killerName !== 'string' || typeof data.victimName !== 'string') return;
  const event = {
    id: typeof data.messageId === 'string' ? data.messageId : crypto.randomUUID(),
    killerName: data.killerName.slice(0, 24),
    victimName: data.victimName.slice(0, 24),
  };
  useBattleStore.setState((state) => ({ events: [...state.events, event].slice(-4) }));
}

export function receiveBattleRespawn(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  const team = isBattleTeam(data.team) ? data.team : null;
  const position = data.position && typeof data.position === 'object' ? data.position as Record<string, unknown> : null;
  if (!team || !position || !['x', 'y', 'z'].every((key) => typeof position[key] === 'number' && Number.isFinite(position[key]))) return;
  respawnAtBase(world, team, { x: position.x as number, y: position.y as number, z: position.z as number });
  const deadUntil = Date.now() + 1500;
  useBattleStore.setState({ deadUntil });
  if (deathTimer !== undefined) window.clearTimeout(deathTimer);
  deathTimer = window.setTimeout(() => useBattleStore.setState({ deadUntil: 0 }), 1550);
}

export function receiveBattleKnockback(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const direction = (value as { direction?: unknown }).direction;
  if (!direction || typeof direction !== 'object') return;
  const { x, y, z } = direction as Record<string, unknown>;
  if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y) || typeof z !== 'number' || !Number.isFinite(z)) return;
  const player = world.queryFirst(Player);
  player?.get(PlayerVelocity)?.set(x * 7, y, z * 7);
}
