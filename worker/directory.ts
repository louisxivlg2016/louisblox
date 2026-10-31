import { DurableObject } from 'cloudflare:workers';

export type Appearance = {
  hairColor: string;
  eyeColor: string;
  clothingColor: string | null;
  hairStyle: 'short' | 'long';
};

export type SocialPlayer = {
  playerId: string;
  name: string;
  room: string;
  character: 'boy' | 'girl';
  outfit: string;
  wig: string;
  appearance: Appearance;
  lastSeen?: number;
};

type Env = {
  GAME_ROOM: DurableObjectNamespace;
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const color = (value: unknown) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
const outfits = new Set(['default', 'king', 'military', 'knight', 'explorer', 'princess', 'louis14', 'louis15']);
const wigs = new Set(['auto', 'none', 'louis14', 'louis15']);

export function parseAppearance(value: unknown, character: 'boy' | 'girl' = 'boy'): Appearance {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    hairColor: color(data.hairColor) ? data.hairColor as string : '#49382f',
    eyeColor: color(data.eyeColor) ? data.eyeColor as string : '#273b4b',
    clothingColor: data.clothingColor === null || color(data.clothingColor) ? data.clothingColor as string | null : null,
    hairStyle: data.hairStyle === 'long' || data.hairStyle === 'short' ? data.hairStyle : character === 'girl' ? 'long' : 'short',
  };
}

export function parseSocialPlayer(value: unknown): SocialPlayer | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.playerId !== 'string' || data.playerId.length < 1 || data.playerId.length > 80) return null;
  if (typeof data.name !== 'string' || data.name.length < 1 || data.name.length > 24) return null;
  if (typeof data.room !== 'string' || data.room.length < 1 || data.room.length > 48) return null;
  const character = data.character === 'girl' ? 'girl' : 'boy';
  return {
    playerId: data.playerId,
    name: data.name,
    room: data.room,
    character,
    outfit: typeof data.outfit === 'string' && outfits.has(data.outfit) ? data.outfit : 'default',
    wig: typeof data.wig === 'string' && wigs.has(data.wig) ? data.wig : 'auto',
    appearance: parseAppearance(data.appearance, character),
  };
}

export class PlayerDirectory extends DurableObject<Env> {
  private players = new Map<string, SocialPlayer>();

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    const now = Date.now();
    for (const [playerId, player] of this.players) {
      if ((player.lastSeen ?? 0) + 30000 < now) this.players.delete(playerId);
    }
    if (url.pathname === '/players' && request.method === 'GET') {
      return json({ players: [...this.players.values()].sort((a, b) => a.name.localeCompare(b.name)) });
    }
    if (url.pathname === '/presence') {
      if (request.method === 'DELETE') {
        const data = await request.json() as { playerId?: unknown };
        if (typeof data.playerId === 'string') this.players.delete(data.playerId);
        return json({ ok: true });
      }
      if (request.method === 'POST') {
        const player = parseSocialPlayer(await request.json());
        if (!player) return json({ ok: false }, 400);
        player.lastSeen = now;
        this.players.set(player.playerId, player);
        return json({ ok: true });
      }
    }
    if ((url.pathname === '/friend-request' || url.pathname === '/friend-accept') && request.method === 'POST') {
      const data = await request.json() as { targetId?: unknown; requestId?: unknown; from?: unknown };
      const from = parseSocialPlayer(data.from);
      const target = typeof data.targetId === 'string' ? this.players.get(data.targetId) : undefined;
      if (!from || !target) return json({ sent: false });
      const requestId = typeof data.requestId === 'string' && data.requestId.length <= 80 ? data.requestId : crypto.randomUUID();
      const room = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(target.room));
      return room.fetch('https://room' + url.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: target.playerId, requestId, from }),
      });
    }
    return json({ error: 'Not found' }, 404);
  }
}
