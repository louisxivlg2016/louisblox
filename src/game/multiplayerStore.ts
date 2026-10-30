import { create } from 'zustand';

export type MultiplayerStatus = 'offline' | 'connecting' | 'online' | 'error';
export type LobbyPlayer = { playerId: string; name: string; self?: boolean };
type MultiplayerSettings = { playerName: string; room: string; server: string };

type MultiplayerStore = MultiplayerSettings & {
  enabled: boolean;
  connectionId: number;
  status: MultiplayerStatus;
  error: string;
  players: LobbyPlayer[];
  setEnabled: (enabled: boolean) => void;
  configure: (settings: MultiplayerSettings) => MultiplayerSettings;
  setStatus: (status: MultiplayerStatus, error?: string) => void;
  setPlayers: (players: LobbyPlayer[]) => void;
};

const query = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);

function initialPlayerName() {
  try {
    return localStorage.getItem('louisblox-player-name')?.trim().slice(0, 24) || 'Joueur';
  } catch {
    return 'Joueur';
  }
}

export const useMultiplayerStore = create<MultiplayerStore>((set) => ({
  enabled: query.has('server') || query.has('room'),
  connectionId: 0,
  playerName: initialPlayerName(),
  room: query.get('room') || 'main-room',
  server: query.get('server') || '',
  status: 'offline',
  error: '',
  players: [],
  setEnabled: (enabled) => set({ enabled, status: enabled ? 'connecting' : 'offline', error: '', players: [] }),
  configure: (settings) => {
    const playerName = settings.playerName.trim().slice(0, 24) || 'Joueur';
    const room = settings.room.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'main-room';
    const server = settings.server.trim();
    try {
      localStorage.setItem('louisblox-player-name', playerName);
    } catch {
    }
    set((state) => ({ playerName, room, server, enabled: true, connectionId: state.connectionId + 1, status: 'connecting', error: '', players: [] }));
    return { playerName, room, server };
  },
  setStatus: (status, error = '') => set({ status, error }),
  setPlayers: (players) => set({ players }),
}));

export const useRemotePlayerStore = create<{
  players: Record<string, import('./multiplayer').PlayerSnapshot>;
  characters: Record<string, import('./characterStore').CharacterKind>;
  setPlayers: (players: Record<string, import('./multiplayer').PlayerSnapshot>) => void;
  setCharacters: (characters: Record<string, import('./characterStore').CharacterKind>) => void;
}>((set) => ({
  players: {},
  characters: {},
  setPlayers: (players) => set({ players }),
  setCharacters: (characters) => set({ characters }),
}));
