import { create } from 'zustand';
import { playerIdentity } from './playerIdentity';
import { useGameStore } from './store';

export type WorldProtection = {
  ownerId: string;
  centerX: number;
  centerZ: number;
  radius: 500;
  enabled: boolean;
  allowedPlayerIds: string[];
};

export const useProtectionStore = create<{
  protection: WorldProtection | null;
  setProtection: (protection: WorldProtection | null) => void;
}>((set) => ({
  protection: null,
  setProtection: (protection) => set({ protection }),
}));

let socket: WebSocket | null = null;

export function setProtectionSocket(next: WebSocket | null) {
  socket = next;
}

export function newProtection(ownerId = playerIdentity()): WorldProtection {
  return { ownerId, centerX: 0, centerZ: 0, radius: 500, enabled: true, allowedPlayerIds: [ownerId] };
}

export function isWorldProtection(value: unknown): value is WorldProtection {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.ownerId === 'string' && data.ownerId.length > 0 && data.ownerId.length <= 80
    && typeof data.centerX === 'number' && Number.isFinite(data.centerX)
    && typeof data.centerZ === 'number' && Number.isFinite(data.centerZ)
    && data.radius === 500 && typeof data.enabled === 'boolean'
    && Array.isArray(data.allowedPlayerIds) && data.allowedPlayerIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 80);
}

export function applyProtection(value: unknown) {
  if (isWorldProtection(value)) useProtectionStore.getState().setProtection(value);
}

export function canManageProtection() {
  const protection = useProtectionStore.getState().protection;
  return Boolean(protection && protection.ownerId === playerIdentity());
}

export function updateProtection(change: { enabled?: boolean; allowedPlayerIds?: string[] }) {
  const current = useProtectionStore.getState().protection;
  if (!current || !canManageProtection()) return false;
  const protection: WorldProtection = {
    ...current,
    enabled: change.enabled ?? current.enabled,
    allowedPlayerIds: [...new Set([current.ownerId, ...(change.allowedPlayerIds ?? current.allowedPlayerIds)])].slice(0, 50),
  };
  useProtectionStore.getState().setProtection(protection);
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'protection', protection }));
  return true;
}

export function canEditAt(x: number, z: number) {
  const protection = useProtectionStore.getState().protection;
  if (!protection?.enabled) return true;
  if (Math.hypot(x - protection.centerX, z - protection.centerZ) > protection.radius) return true;
  if (protection.allowedPlayerIds.includes(playerIdentity())) return true;
  useGameStore.getState().setNotice('Territoire protégé : demande au propriétaire l’autorisation de construire ou détruire.');
  return false;
}
