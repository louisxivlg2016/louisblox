import { create } from 'zustand';
import { PIRATE_KITS, PIRATE_OBJECTIVES, teamObjective } from './pirates';
import type { PirateKit } from './pirates';
import { useBattleStore, respawnAtBase } from './battle';
import { useGameStore } from './store';
import { world } from './world';
import type { Vector3 } from 'three';

type PirateState = {
  kit: PirateKit | null;
  kits: Record<string, PirateKit>;
  coins: Record<string, number>;
  objectives: { red: number; blue: number };
  eliminated: string[];
  winner: 'red' | 'blue' | null;
  prices: Record<string, number>;
};

const initial = { kit: null, kits: {}, coins: {}, objectives: { red: 6, blue: 6 }, eliminated: [], winner: null, prices: {} };
export const usePirateStore = create<PirateState>(() => ({ ...initial, kits: {}, coins: {}, eliminated: [], prices: {} }));
let socket: WebSocket | null = null;
let kitRequestPending = false;

export function setPirateSocket(next: WebSocket | null) {
  socket = next;
}

export function clearPirates() {
  socket = null;
  kitRequestPending = false;
  usePirateStore.setState({ ...initial, kits: {}, coins: {}, eliminated: [], prices: {} });
}

function send(message: unknown) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function choosePirateKit(kit: PirateKit) {
  const team = useBattleStore.getState().team;
  if (!team || !socket || socket.readyState !== WebSocket.OPEN) return false;
  const loadout = PIRATE_KITS[kit].hotbar;
  usePirateStore.setState({ kit });
  useGameStore.setState({ hotbarSlots: [...loadout], selected: loadout[0] });
  kitRequestPending = true;
  send({ type: 'pirates-kit', kit });
  respawnAtBase(world, team);
  useGameStore.getState().setMode('play');
  return true;
}

export function requestPirateObjectiveHit(kind: 'melee' | 'cannon', position?: { x: number; y: number; z: number }) {
  send({ type: 'pirates-objective', kind, position });
}

export function buyPirateItem(item: string) {
  send({ type: 'pirates-buy', item });
}

export function receivePirateState(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  const kits: Record<string, PirateKit> = {};
  if (Array.isArray(data.kits)) {
    for (const entry of data.kits) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !(entry[1] in PIRATE_KITS)) continue;
      kits[entry[0]] = entry[1];
    }
  }
  const coins: Record<string, number> = {};
  if (Array.isArray(data.coins)) {
    for (const entry of data.coins) {
      if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number' && Number.isFinite(entry[1])) coins[entry[0]] = Math.max(0, Math.floor(entry[1]));
    }
  }
  const source = data.objectives && typeof data.objectives === 'object' ? data.objectives as Record<string, unknown> : {};
  const objectives = {
    red: typeof source.red === 'number' ? Math.max(0, source.red) : 6,
    blue: typeof source.blue === 'number' ? Math.max(0, source.blue) : 6,
  };
  const eliminated = Array.isArray(data.eliminated) ? data.eliminated.filter((id): id is string => typeof id === 'string') : [];
  const winner = data.winner === 'red' || data.winner === 'blue' ? data.winner : null;
  const prices = data.prices && typeof data.prices === 'object' ? data.prices as Record<string, number> : {};
  const localId = useBattleStore.getState().localPlayerId;
  const previousKit = usePirateStore.getState().kit;
  const kit = localId ? kits[localId] ?? (kitRequestPending ? previousKit : null) : null;
  if (localId && kit) kitRequestPending = false;
  if (!previousKit && kit) {
    const loadout = PIRATE_KITS[kit].hotbar;
    useGameStore.setState({ hotbarSlots: [...loadout], selected: loadout[0] });
  }
  usePirateStore.setState({ kits, coins, objectives, eliminated, winner, prices, kit });
}

export function receivePirateInventory(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  if (typeof data.item !== 'string' || typeof data.amount !== 'number' || !Number.isInteger(data.amount) || data.amount < 1 || data.amount > 64) return;
  const store = useGameStore.getState();
  store.setItemCount(data.item as import('./items').ItemKind, (store.itemCounts[data.item] ?? 0) + data.amount);
  const localId = useBattleStore.getState().localPlayerId;
  if (localId && typeof data.coins === 'number') usePirateStore.setState((state) => ({ coins: { ...state.coins, [localId]: Math.max(0, Math.floor(data.coins as number)) } }));
  store.setNotice(`${data.item} ajouté à ton inventaire.`);
}

export function damagePirateObjectivesInRadius(position: Vector3, radius: number) {
  if (useGameStore.getState().gameplayMode !== 'pirates') return;
  const team = teamObjective(useBattleStore.getState().team);
  const objective = PIRATE_OBJECTIVES[team];
  if (Math.hypot(position.x - objective.x, position.y - objective.y, position.z - objective.z) <= radius) requestPirateObjectiveHit('cannon', position);
}

export function isPirateEliminated() {
  const localId = useBattleStore.getState().localPlayerId;
  return localId !== null && usePirateStore.getState().eliminated.includes(localId);
}
