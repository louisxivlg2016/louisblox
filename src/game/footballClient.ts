import { create } from 'zustand';
import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { isDown, isMouseButtonDown, stopMining } from './input';
import { useBattleStore, respawnAtBase } from './battle';
import { useGameStore } from './store';
import { useRemotePlayerStore } from './multiplayerStore';
import { Player, PlayerPosition, PlayerState } from './traits';
import { world } from './world';
import { playWhistle } from './audio';

export type FootballTeam = 'red' | 'blue';
export type FootballPhase = 'waiting' | 'countdown' | 'running' | 'restart' | 'penalty' | 'finished';
type Ball = { x: number; y: number; z: number; vx: number; vy: number; vz: number };
type Card = { yellow: number; redUntil: number };
type FootballState = {
  phase: FootballPhase;
  phaseUntil: number;
  endsAt: number;
  score: { red: number; blue: number };
  ball: Ball;
  overtime: boolean;
  winner: FootballTeam | null;
  cards: Record<string, Card>;
  penaltyTeam: FootballTeam | null;
  penaltyShooterId: string | null;
  notice: string;
  whistleToken: number;
};

const initial: FootballState = { phase: 'waiting', phaseUntil: 0, endsAt: 0, score: { red: 0, blue: 0 }, ball: { x: 0, y: 9, z: 0, vx: 0, vy: 0, vz: 0 }, overtime: false, winner: null, cards: {}, penaltyTeam: null, penaltyShooterId: null, notice: 'Choisis ton équipe', whistleToken: 0 };
export const useFootballStore = create<FootballState>(() => ({ ...initial, score: { ...initial.score }, ball: { ...initial.ball }, cards: {} }));
let socket: WebSocket | null = null;
let lastWhistle = 0;
let lastRedUntil = 0;

export function setFootballSocket(next: WebSocket | null) {
  socket = next;
}

export function clearFootball() {
  socket = null;
  lastWhistle = 0;
  lastRedUntil = 0;
  useFootballStore.setState({ ...initial, score: { ...initial.score }, ball: { ...initial.ball }, cards: {} });
}

function send(message: unknown) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function kickFootball(power = false) {
  send({ type: 'football-kick', power });
}

export function tackleFootball(targetId?: string, violent = false) {
  if (targetId) send({ type: 'football-foul', targetId, violent });
  else send({ type: 'football-tackle' });
}

export function refereeWhistle() {
  send({ type: 'football-whistle' });
}

function number(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function receiveFootballState(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  const source = data.ball && typeof data.ball === 'object' ? data.ball as Record<string, unknown> : {};
  const ball: Ball = { x: number(source.x, 0), y: number(source.y, 9), z: number(source.z, 0), vx: number(source.vx, 0), vy: number(source.vy, 0), vz: number(source.vz, 0) };
  const sourceScore = data.score && typeof data.score === 'object' ? data.score as Record<string, unknown> : {};
  const cards: Record<string, Card> = {};
  if (data.cards && typeof data.cards === 'object') {
    for (const [playerId, value] of Object.entries(data.cards)) {
      if (!value || typeof value !== 'object') continue;
      const card = value as Record<string, unknown>;
      cards[playerId] = { yellow: Math.max(0, Math.floor(number(card.yellow, 0))), redUntil: number(card.redUntil, 0) };
    }
  }
  const phase: FootballPhase = ['waiting', 'countdown', 'running', 'restart', 'penalty', 'finished'].includes(String(data.phase)) ? data.phase as FootballPhase : 'waiting';
  const whistleToken = Math.floor(number(data.whistleToken, 0));
  if (whistleToken > lastWhistle) {
    playWhistle(data.whistle === 'goal' ? 'goal' : data.whistle === 'long' ? 'long' : 'short');
    lastWhistle = whistleToken;
  }
  const localId = useBattleStore.getState().localPlayerId;
  const redUntil = localId ? cards[localId]?.redUntil ?? 0 : 0;
  if (redUntil > Date.now() && redUntil !== lastRedUntil && useGameStore.getState().gameplayMode === 'football') {
    const team = useBattleStore.getState().team;
    respawnAtBase(world, team, { x: team === 'blue' ? 10 : -10, y: 11.51, z: 18 });
  }
  lastRedUntil = redUntil;
  useFootballStore.setState({
    phase, phaseUntil: number(data.phaseUntil, 0), endsAt: number(data.endsAt, 0), ball,
    score: { red: Math.max(0, Math.floor(number(sourceScore.red, 0))), blue: Math.max(0, Math.floor(number(sourceScore.blue, 0))) },
    overtime: data.overtime === true, winner: data.winner === 'red' || data.winner === 'blue' ? data.winner : null,
    cards, penaltyTeam: data.penaltyTeam === 'red' || data.penaltyTeam === 'blue' ? data.penaltyTeam : null,
    penaltyShooterId: typeof data.penaltyShooterId === 'string' ? data.penaltyShooterId : null,
    notice: typeof data.notice === 'string' ? data.notice.slice(0, 140) : '', whistleToken,
  });
}

export function receiveFootballSpawn(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const positions = (value as { positions?: unknown }).positions;
  const localId = useBattleStore.getState().localPlayerId;
  if (!localId || !positions || typeof positions !== 'object') return;
  const position = (positions as Record<string, unknown>)[localId];
  if (!position || typeof position !== 'object') return;
  const point = position as Record<string, unknown>;
  if (!['x', 'y', 'z'].every((key) => typeof point[key] === 'number' && Number.isFinite(point[key]))) return;
  respawnAtBase(world, useBattleStore.getState().team, { x: point.x as number, y: point.y as number, z: point.z as number });
  const player = world.queryFirst(Player);
  if (player) player.set(PlayerState, { yaw: number(point.yaw, 0), pitch: 0 });
}

export function isFootballFrozen() {
  const game = useFootballStore.getState();
  const { localPlayerId, team } = useBattleStore.getState();
  if (game.phase === 'waiting' || game.phase === 'finished' || !team) return true;
  if (localPlayerId && (game.cards[localPlayerId]?.redUntil ?? 0) > Date.now()) return true;
  if (game.phase !== 'running' && Date.now() < game.phaseUntil) return true;
  return false;
}

export function footballBounds() {
  const game = useFootballStore.getState();
  const { localPlayerId, team } = useBattleStore.getState();
  const bounds = { minX: -26.5, maxX: 26.5, minZ: -14.5, maxZ: 14.5 };
  if (game.phase !== 'penalty' || !game.penaltyTeam) return bounds;
  const direction = game.penaltyTeam === 'red' ? 1 : -1;
  if (localPlayerId === game.penaltyShooterId) return { minX: direction * 18 - 3, maxX: direction * 18 + 3, minZ: -5, maxZ: 5 };
  if (team !== game.penaltyTeam) return { minX: direction * 26.5 - 1.5, maxX: direction * 26.5 + 1.5, minZ: -4, maxZ: 4 };
  return { ...bounds, minX: -16, maxX: 16 };
}

const direction = new Vector3();
const origin = new Vector3();
const toward = new Vector3();
const cooldowns = new WeakMap<World, number>();

export function footballControlSystem(world: World, camera: Camera, dt: number, taps: number, actions = { place: 0, harvest: 0 }) {
  if (useGameStore.getState().gameplayMode !== 'football') return false;
  stopMining();
  const cooldown = Math.max(0, (cooldowns.get(world) ?? 0) - dt);
  cooldowns.set(world, cooldown);
  if (cooldown > 0 || (taps === 0 && actions.place + actions.harvest === 0 && !isMouseButtonDown(0)) || isFootballFrozen()) return true;
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const state = world.queryFirst(Player)?.get(PlayerState);
  if (!player || !state) return true;
  origin.copy(player);
  origin.y += 1.1;
  camera.getWorldDirection(direction);
  const localId = useBattleStore.getState().localPlayerId;
  const localTeam = useBattleStore.getState().team;
  let targetId: string | undefined;
  let best = 4.5;
  for (const [id, remote] of Object.entries(useRemotePlayerStore.getState().players)) {
    if (id === localId || useBattleStore.getState().teams[id] === localTeam) continue;
    toward.set(remote.x, remote.y + 1, remote.z).sub(origin);
    const distance = toward.length();
    if (distance > best || toward.normalize().dot(direction) < 0.65) continue;
    best = distance;
    targetId = id;
  }
  const power = (isDown('ShiftLeft') || isDown('ShiftRight')) && (isDown('Space') || state.grounded === false);
  tackleFootball(targetId, targetId !== undefined && power);
  cooldowns.set(world, 0.35);
  return true;
}
