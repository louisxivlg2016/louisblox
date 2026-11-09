import { create } from 'zustand';

export type TribeMember = { playerId: string; name: string };
export type Tribe = { id: string; name: string; ownerId: string; members: TribeMember[] };
export type TribeInvitation = { id: string; name: string; ownerId: string; ownerName: string };

type TribeState = {
  tribes: Tribe[];
  invitations: TribeInvitation[];
  panelOpen: boolean;
  error: string;
  notice: string;
  setPanelOpen: (open: boolean) => void;
};

export const useTribeStore = create<TribeState>((set) => ({
  tribes: [],
  invitations: [],
  panelOpen: false,
  error: '',
  notice: '',
  setPanelOpen: (panelOpen) => set({ panelOpen }),
}));

let socket: WebSocket | null = null;

export function setTribeSocket(next: WebSocket | null) {
  socket = next;
}

export function clearTribes() {
  socket = null;
  useTribeStore.setState({ tribes: [], invitations: [], panelOpen: false, error: '', notice: '' });
}

export function sendTribe(type: string, data: Record<string, unknown> = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    useTribeStore.setState({ error: 'Connexion au salon indisponible. Réessaie dans un instant.' });
    return false;
  }
  useTribeStore.setState({ error: '', notice: '' });
  socket.send(JSON.stringify({ type, ...data }));
  return true;
}

function text(value: unknown, max: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : null;
}

function parseTribe(value: unknown): Tribe | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const id = text(data.id, 80);
  const name = text(data.name, 24);
  const ownerId = text(data.ownerId, 80);
  if (!id || !name || !ownerId || !Array.isArray(data.members)) return null;
  const members = data.members.flatMap((member): TribeMember[] => {
    if (!member || typeof member !== 'object') return [];
    const candidate = member as Record<string, unknown>;
    const playerId = text(candidate.playerId, 80);
    const memberName = text(candidate.name, 24);
    return playerId && memberName ? [{ playerId, name: memberName }] : [];
  });
  return members.length > 0 ? { id, name, ownerId, members } : null;
}

export function receiveTribeMessage(data: { type?: unknown; tribes?: unknown; tribe?: unknown; message?: unknown }) {
  if (data.type === 'tribe-state' && Array.isArray(data.tribes)) {
    const tribes = data.tribes.map(parseTribe).filter((tribe): tribe is Tribe => tribe !== null);
    useTribeStore.setState({ tribes, error: '' });
    return true;
  }
  if (data.type === 'tribe-invite' && data.tribe && typeof data.tribe === 'object') {
    const value = data.tribe as Record<string, unknown>;
    const id = text(value.id, 80);
    const name = text(value.name, 24);
    const ownerId = text(value.ownerId, 80);
    const ownerName = text(value.ownerName, 24);
    if (!id || !name || !ownerId || !ownerName) return true;
    const invitation = { id, name, ownerId, ownerName };
    useTribeStore.setState((state) => ({ invitations: [...state.invitations.filter((item) => item.id !== id), invitation], notice: `${ownerName} t’invite dans la tribu ${name}.` }));
    return true;
  }
  if (data.type === 'tribe-error') {
    useTribeStore.setState({ error: typeof data.message === 'string' ? data.message.slice(0, 160) : 'Action impossible dans cette tribu.' });
    return true;
  }
  if (data.type === 'tribe-notice') {
    useTribeStore.setState({ notice: typeof data.message === 'string' ? data.message.slice(0, 160) : '' });
    return true;
  }
  return false;
}

export function dismissTribeInvitation(tribeId: string) {
  useTribeStore.setState((state) => ({ invitations: state.invitations.filter((invitation) => invitation.id !== tribeId) }));
}
