import { create } from 'zustand';
import { resolveMultiplayerUrl } from './multiplayer';
import { useMultiplayerStore } from './multiplayerStore';
import { useCharacterStore } from './characterStore';
import { sanitizeAppearance } from './appearance';
import { isOutfitKind, isWigSelection } from './outfits';
import type { OutfitKind, WigSelection } from './outfits';

export type FriendPlayer = {
  playerId: string;
  name: string;
  room: string;
  character: 'boy' | 'girl';
  outfit: OutfitKind;
  wig: WigSelection;
  appearance: import('./appearance').CharacterAppearance;
  lastSeen?: number;
};

export type FriendRequest = { requestId: string; from: FriendPlayer };

type FriendStore = {
  onlinePlayers: FriendPlayer[];
  friends: FriendPlayer[];
  requests: FriendRequest[];
  setOnlinePlayers: (players: FriendPlayer[]) => void;
  addFriend: (friend: FriendPlayer) => void;
  receiveRequest: (request: FriendRequest) => void;
  removeRequest: (requestId: string) => void;
};

const FRIENDS_KEY = 'louisblox-friends-v1';

function friend(value: unknown): FriendPlayer | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.playerId !== 'string' || data.playerId.length > 80 || typeof data.name !== 'string' || data.name.length > 24 || typeof data.room !== 'string' || data.room.length > 48) return null;
  return {
    playerId: data.playerId,
    name: data.name,
    room: data.room,
    character: data.character === 'girl' ? 'girl' : 'boy',
    outfit: isOutfitKind(data.outfit) ? data.outfit : 'default',
    wig: isWigSelection(data.wig) ? data.wig : 'auto',
    appearance: sanitizeAppearance(data.appearance, data.character === 'girl' ? 'girl' : 'boy'),
    lastSeen: typeof data.lastSeen === 'number' ? data.lastSeen : undefined,
  };
}

function readFriends(): FriendPlayer[] {
  try {
    const saved = JSON.parse(localStorage.getItem(FRIENDS_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.map(friend).filter((value): value is FriendPlayer => value !== null) : [];
  } catch {
    return [];
  }
}

function saveFriends(friends: FriendPlayer[]) {
  try {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
  } catch {
  }
}

export const useFriendStore = create<FriendStore>((set) => ({
  onlinePlayers: [],
  friends: readFriends(),
  requests: [],
  setOnlinePlayers: (onlinePlayers) => set({ onlinePlayers }),
  addFriend: (friend) => set((state) => {
    const friends = [...state.friends.filter((item) => item.playerId !== friend.playerId), friend];
    saveFriends(friends);
    return { friends };
  }),
  receiveRequest: (request) => set((state) => ({ requests: [...state.requests.filter((item) => item.requestId !== request.requestId), request] })),
  removeRequest: (requestId) => set((state) => ({ requests: state.requests.filter((request) => request.requestId !== requestId) })),
}));

function selfProfile(): FriendPlayer {
  const multiplayer = useMultiplayerStore.getState();
  const self = multiplayer.players.find((player) => player.self);
  if (!self) throw new Error('Connecte-toi à un salon pour proposer un ami.');
  const character = useCharacterStore.getState();
  return {
    playerId: self.playerId,
    name: multiplayer.playerName,
    room: multiplayer.room,
    character: character.character,
    outfit: character.outfit,
    wig: character.wig,
    appearance: character.appearance,
  };
}

function endpoint(path: string) {
  const url = new URL(resolveMultiplayerUrl());
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = path;
  url.search = '';
  return url;
}

export async function listOnlinePlayers() {
  const response = await fetch(endpoint('/players'), { cache: 'no-store' });
  if (!response.ok) throw new Error('Annuaire indisponible');
  const data = await response.json() as { players?: unknown };
  return Array.isArray(data.players) ? data.players.map(friend).filter((value): value is FriendPlayer => value !== null) : [];
}

async function postFriend(path: string, targetId: string, requestId?: string) {
  const from = selfProfile();
  const response = await fetch(endpoint(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId, requestId, from }),
  });
  if (!response.ok) throw new Error('Invitation impossible pour le moment.');
  const result = await response.json() as { sent?: boolean };
  if (!result.sent) throw new Error('Ce joueur n’est plus disponible.');
}

export const sendFriendRequest = (target: FriendPlayer) => postFriend('/friend-request', target.playerId);
export const acceptFriendRequest = (request: FriendRequest) => postFriend('/friend-accept', request.from.playerId, request.requestId);

export function receiveFriendRequest(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  const from = friend(data.from);
  if (!from || typeof data.requestId !== 'string' || data.requestId.length > 80) return;
  useFriendStore.getState().receiveRequest({ requestId: data.requestId, from });
}

export function receiveFriendAcceptance(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const from = friend((value as Record<string, unknown>).from);
  if (from) useFriendStore.getState().addFriend(from);
}
