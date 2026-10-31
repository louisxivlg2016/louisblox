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
  setPlayerName: (name: string) => void;
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
  setPlayerName: (name) => {
    const playerName = name.trim().slice(0, 24) || 'Joueur';
    try {
      localStorage.setItem('louisblox-player-name', playerName);
    } catch {
    }
    set({ playerName, error: '' });
  },
}));

export const useRemotePlayerStore = create<{
  players: Record<string, import('./multiplayer').PlayerSnapshot>;
  characters: Record<string, import('./characterStore').CharacterKind>;
  outfits: Record<string, import('./outfits').OutfitKind>;
  wigs: Record<string, import('./outfits').WigSelection>;
  appearances: Record<string, import('./appearance').CharacterAppearance>;
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
  setPlayers: (players) => set({ players }),
  setCharacters: (characters) => set({ characters }),
  setOutfits: (outfits) => set({ outfits }),
  setWigs: (wigs) => set({ wigs }),
  setAppearances: (appearances) => set({ appearances }),
}));
