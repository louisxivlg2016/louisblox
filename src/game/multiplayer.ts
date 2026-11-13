import { isSelectedKind } from './items';
import type { SelectedKind } from './items';
import type { EmoteKind } from './emotes';
import { isPotionEffect } from './effects';
import { isGameplayMode } from './worldMode';
import { isAnimalMount, isVehicleKind, type MountKind } from './vehicleTypes';

export type HorseSnapshot = { id: string; x: number; y: number; z: number; yaw: number };

export type PlayerSnapshot = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  bodyYaw?: number;
  pitch: number;
  flying: boolean;
  moving?: boolean;
  airborne?: boolean;
  parachuting?: boolean;
  hasParachute?: boolean;
  mounted?: boolean;
  mountRole?: 'driver' | 'passenger';
  vehicleKind?: MountKind;
  vehicleId?: string;
  horse?: HorseSnapshot;
  emote?: EmoteKind | null;
  selected?: SelectedKind;
  effects?: import('./effects').PotionEffect[];
};

type EndpointEnvironment = {
  VITE_WS_URL?: string;
  NEXT_PUBLIC_WS_URL?: string;
};

function isLocalHostname(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
}

export function resolveMultiplayerUrl(
  location: Location = window.location,
  environment: EndpointEnvironment = {
    VITE_WS_URL: import.meta.env?.VITE_WS_URL,
    NEXT_PUBLIC_WS_URL: import.meta.env?.NEXT_PUBLIC_WS_URL,
  },
) {
  const params = new URLSearchParams(location.search);
  const override = params.get('server')?.trim();
  const configured = environment.VITE_WS_URL?.trim() || environment.NEXT_PUBLIC_WS_URL?.trim();
  const local = location.protocol === 'http:' && isLocalHostname(location.hostname);
  const endpoint = override || (local
    ? `ws://${location.hostname}:8787/ws`
    : location.protocol === 'https:'
      ? configured || 'wss://louisblox.louisblox.workers.dev/ws'
      : configured || `ws://${location.host}/ws`);
  const url = new URL(endpoint);
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') throw new Error('The multiplayer server must use ws:// or wss://');
  if (url.pathname === '/') url.pathname = '/ws';
  const room = params.get('room')?.trim() || url.searchParams.get('room') || 'main-room';
  url.searchParams.set('room', room);
  return url.toString();
}

function isHorseSnapshot(value: unknown): value is HorseSnapshot {
  if (!value || typeof value !== 'object') return false;
  const horse = value as Record<string, unknown>;
  return typeof horse.id === 'string' && horse.id.length > 0 && horse.id.length <= 80
    && ['x', 'y', 'z', 'yaw'].every((key) => typeof horse[key] === 'number' && Number.isFinite(horse[key]));
}

export function isPlayerSnapshot(value: unknown): value is PlayerSnapshot {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  return ['x', 'y', 'z', 'yaw', 'pitch'].every((key) => typeof state[key] === 'number' && Number.isFinite(state[key]))
    && typeof state.flying === 'boolean'
    && (state.bodyYaw === undefined || typeof state.bodyYaw === 'number' && Number.isFinite(state.bodyYaw))
    && (state.moving === undefined || typeof state.moving === 'boolean')
    && (state.airborne === undefined || typeof state.airborne === 'boolean')
    && (state.parachuting === undefined || typeof state.parachuting === 'boolean')
    && (state.hasParachute === undefined || typeof state.hasParachute === 'boolean')
    && (state.mounted === undefined || typeof state.mounted === 'boolean')
    && (state.mountRole === undefined || state.mountRole === 'driver' || state.mountRole === 'passenger')
    && (state.vehicleKind === undefined || isVehicleKind(state.vehicleKind) || isAnimalMount(state.vehicleKind))
    && (state.vehicleId === undefined || typeof state.vehicleId === 'string' && state.vehicleId.length > 0 && state.vehicleId.length <= 80)
    && (state.horse === undefined || isHorseSnapshot(state.horse))
    && (state.emote === undefined || state.emote === null || state.emote === 'sit' || state.emote === 'lie' || state.emote === 'wave')
    && (state.selected === undefined || isSelectedKind(state.selected))
    && (state.effects === undefined || Array.isArray(state.effects) && state.effects.every(isPotionEffect));
}

export async function deleteRoom(room: string) {
  const url = new URL(resolveMultiplayerUrl());
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '/room';
  url.search = '';
  url.searchParams.set('room', room);
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Room deletion failed (${response.status})`);
}

export type RoomInfo = { gameplayMode: import('./worldMode').GameplayMode | null; players: number };

export async function fetchRoomInfo(room: string, server: string, signal?: AbortSignal): Promise<RoomInfo | null> {
  const url = new URL(server.trim() || resolveMultiplayerUrl());
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '/room';
  url.search = '';
  url.searchParams.set('room', room);
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) return null;
  const data = await response.json() as { gameplayMode?: unknown; players?: unknown };
  const mode = data.gameplayMode;
  return {
    gameplayMode: isGameplayMode(mode) ? mode : null,
    players: typeof data.players === 'number' ? data.players : 0,
  };
}
