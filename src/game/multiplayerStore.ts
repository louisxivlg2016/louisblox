import { create } from 'zustand';
import { rememberWorld } from './store';
import { setJoinOnlyRoom } from './roomJoin';

export type MultiplayerStatus = 'offline' | 'connecting' | 'online' | 'error';
export type LobbyPlayer = { playerId: string; name: string; self?: boolean };
type MultiplayerSettings = { playerName: string; room: string; server: string };

type MultiplayerStore = MultiplayerSettings & {
  enabled: boolean;
  joined: boolean;
  connectionId: number;
  status: MultiplayerStatus;
  worldReady: boolean;
  error: string;
  players: LobbyPlayer[];
  setEnabled: (enabled: boolean) => void;
  setWorldReady: (ready: boolean) => void;
  configure: (settings: MultiplayerSettings, joinOnly?: boolean) => MultiplayerSettings;
  setStatus: (status: MultiplayerStatus, error?: string) => void;
  setPlayers: (players: LobbyPlayer[]) => void;
  setPlayerName: (name: string) => void;
  serverEditing: boolean;
  setServerEditing: (editing: boolean) => void;
};

export function normalizeRoomId(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'main-room';
}

const query = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
const autoJoin = query.has('server') || query.has('room');
setJoinOnlyRoom(autoJoin ? query.get('room') || 'main-room' : null);

function initialPlayerName() {
  try {
    return localStorage.getItem('louisblox-player-name')?.trim().slice(0, 24) || 'Joueur';
  } catch {
    return 'Joueur';
  }
}

export const useMultiplayerStore = create<MultiplayerStore>((set) => ({
  enabled: autoJoin,
  joined: autoJoin,
  connectionId: 0,
  playerName: initialPlayerName(),
  room: query.get('room') || 'main-room',
  server: query.get('server') || '',
  status: 'offline',
  worldReady: false,
  error: '',
  players: [],
  serverEditing: false,
  setServerEditing: (serverEditing) => set({ serverEditing }),
  setWorldReady: (worldReady) => set({ worldReady }),
  setEnabled: (enabled) => {
    if (!enabled) setJoinOnlyRoom(null);
    set((state) => ({ enabled, joined: enabled && state.joined, status: enabled && state.joined ? 'connecting' : 'offline', worldReady: false, error: '', players: [] }));
  },
  configure: (settings, joinOnly = false) => {
    const playerName = settings.playerName.trim().slice(0, 24) || 'Joueur';
    const room = normalizeRoomId(settings.room);
    const server = settings.server.trim();
    try {
      localStorage.setItem('louisblox-player-name', playerName);
    } catch {
    }
    setJoinOnlyRoom(joinOnly ? room : null);
    if (!joinOnly) rememberWorld(room);
    set((state) => ({ playerName, room, server, enabled: true, joined: true, connectionId: state.connectionId + 1, status: 'connecting', worldReady: false, error: '', players: [] }));
    return { playerName, room, server };
  },
  setStatus: (status, error = '') => set({ status, error, ...(status === 'online' ? {} : { worldReady: false }) }),
  setPlayers: (players) => set({ players }),
  setPlayerName: (name) => {
    const playerName = name.trim().slice(0, 24) || 'Joueur';
    try {
      localStorage.setItem('louisblox-player-name', playerName);
    } catch {
    }
    set((state) => ({ playerName, error: '', connectionId: state.enabled && state.joined ? state.connectionId + 1 : state.connectionId, status: state.enabled && state.joined ? 'connecting' : state.status }));
  },
}));

export const useRemotePlayerStore = create<{
  players: Record<string, import('./multiplayer').PlayerSnapshot>;
  characters: Record<string, import('./characterStore').CharacterKind>;
  outfits: Record<string, import('./outfits').OutfitKind>;
  wigs: Record<string, import('./outfits').WigSelection>;
  appearances: Record<string, import('./appearance').CharacterAppearance>;
  avatars: Record<string, import('./avatar').ProfileAvatarKind>;
  setAvatars: (avatars: Record<string, import('./avatar').ProfileAvatarKind>) => void;
  setPlayers: (players: Record<string, import('./multiplayer').PlayerSnapshot>) => void;
  setCharacters: (characters: Record<string, import('./characterStore').CharacterKind>) => void;
  setOutfits: (outfits: Record<string, import('./outfits').OutfitKind>) => void;
  setWigs: (wigs: Record<string, import('./outfits').WigSelection>) => void;
  setAppearances: (appearances: Record<string, import('./appearance').CharacterAppearance>) => void;
}>((set) => ({
  players: {},
  characters: {},
  outfits: {},
  wigs: {},
  appearances: {},
  avatars: {},
  setAvatars: (avatars) => set({ avatars }),
  setPlayers: (players) => set({ players }),
  setCharacters: (characters) => set({ characters }),
  setOutfits: (outfits) => set({ outfits }),
  setWigs: (wigs) => set({ wigs }),
  setAppearances: (appearances) => set({ appearances }),
}));
