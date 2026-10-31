export type PlayerSnapshot = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  flying: boolean;
  moving?: boolean;
  airborne?: boolean;
  mounted?: boolean;
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
      ? configured || `wss://${location.host}/ws`
      : configured || `ws://${location.host}/ws`);
  const url = new URL(endpoint);
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') throw new Error('The multiplayer server must use ws:// or wss://');
  if (url.pathname === '/') url.pathname = '/ws';
  const room = params.get('room')?.trim() || url.searchParams.get('room') || 'main-room';
  url.searchParams.set('room', room);
  return url.toString();
}

export function isPlayerSnapshot(value: unknown): value is PlayerSnapshot {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  return ['x', 'y', 'z', 'yaw', 'pitch'].every((key) => typeof state[key] === 'number' && Number.isFinite(state[key]))
    && typeof state.flying === 'boolean'
    && (state.moving === undefined || typeof state.moving === 'boolean')
    && (state.airborne === undefined || typeof state.airborne === 'boolean')
    && (state.mounted === undefined || typeof state.mounted === 'boolean');
}
