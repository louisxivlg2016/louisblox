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

type PendingInvitation = {
  kind: 'friend-request' | 'friend-accept';
  requestId: string;
  from: SocialPlayer;
  createdAt: number;
};

export class PlayerDirectory extends DurableObject<Env> {
  private knownPlayers = new Map<string, SocialPlayer>();
  private onlinePlayers = new Map<string, SocialPlayer>();
  private invitations = new Map<string, PendingInvitation[]>();
  private nameOwners = new Map<string, string>();
  private ready?: Promise<void>;

  private async ensureReady() {
    this.ready ??= this.ctx.blockConcurrencyWhile(async () => {
      const [known, invitations, owners] = await Promise.all([
        this.ctx.storage.get<Array<[string, SocialPlayer]>>('known-v1'),
        this.ctx.storage.get<Array<[string, PendingInvitation[]]>>('invitations-v1'),
        this.ctx.storage.get<Array<[string, string]>>('names-v1'),
      ]);
      this.knownPlayers = new Map(known ?? []);
      this.invitations = new Map(invitations ?? []);
      this.nameOwners = new Map(owners ?? []);
      for (const player of this.knownPlayers.values()) {
        const key = player.name.trim().toLocaleLowerCase();
        if (!this.nameOwners.has(key)) this.nameOwners.set(key, player.playerId);
      }
    });
    await this.ready;
  }

  private saveKnown() {
    return this.ctx.storage.put('known-v1', [...this.knownPlayers]);
  }

  private nameAvailable(name: string, playerId: string) {
    const normalized = name.trim().toLocaleLowerCase();
    if (!normalized || name.trim().length > 24) return false;
    const owner = this.nameOwners.get(normalized);
    return owner === undefined || owner === playerId;
  }

  private saveInvitations() {
    return this.ctx.storage.put('invitations-v1', [...this.invitations]);
  }

  private queue(targetId: string, kind: PendingInvitation['kind'], requestId: string, from: SocialPlayer) {
    const pending = this.invitations.get(targetId) ?? [];
    if (!pending.some((item) => item.kind === kind && item.requestId === requestId)) {
      pending.push({ kind, requestId, from, createdAt: Date.now() });
    }
    this.invitations.set(targetId, pending);
  }

  private async deliver(path: string, roomId: string, body: unknown) {
    try {
      const room = this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(roomId));
      const response = await room.fetch('https://room' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { sent?: boolean };
      return result.sent === true;
    } catch {
      return false;
    }
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    await this.ensureReady();
    const now = Date.now();
    for (const [playerId, player] of this.onlinePlayers) {
      if ((player.lastSeen ?? 0) + 120000 < now) this.onlinePlayers.delete(playerId);
    }
    if (url.pathname === '/username' && request.method === 'GET') {
      const name = (url.searchParams.get('name') ?? '').trim();
      const playerId = url.searchParams.get('playerId') ?? '';
      if (!name || name.length > 24 || !playerId) return json({ available: false, error: 'Choisis un pseudo de 1 à 24 caractères.' });
      const available = this.nameAvailable(name, playerId);
      return json({ available, error: available ? undefined : 'Ce pseudo est déjà utilisé. Choisis-en un autre.' }, available ? 200 : 409);
    }
    if (url.pathname === '/players' && request.method === 'GET') {
      const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase();
      const players = query
        ? [...this.knownPlayers.values()].filter((player) => player.name.toLocaleLowerCase().includes(query))
        : [...this.onlinePlayers.values()];
      return json({
        players: players
          .map((player) => ({ ...player, online: this.onlinePlayers.has(player.playerId) }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
    }
    if (url.pathname === '/friend-requests' && request.method === 'GET') {
      const playerId = url.searchParams.get('playerId') ?? '';
      const requests = this.invitations.get(playerId) ?? [];
      this.invitations.delete(playerId);
      if (requests.length > 0) await this.saveInvitations();
      return json({ requests });
    }
    if (url.pathname === '/presence') {
      if (request.method === 'DELETE') {
        const data = await request.json() as { playerId?: unknown };
        if (typeof data.playerId === 'string') this.onlinePlayers.delete(data.playerId);
        return json({ ok: true });
      }
      if (request.method === 'POST') {
        const player = parseSocialPlayer(await request.json());
        if (!player) return json({ ok: false, error: 'Profil invalide.' }, 400);
        if (!this.nameAvailable(player.name, player.playerId)) return json({ ok: false, error: 'Ce pseudo est déjà utilisé. Choisis-en un autre.' }, 409);
        const previous = this.knownPlayers.get(player.playerId);
        const renamed = previous !== undefined && previous.name !== player.name;
        if (previous && renamed) this.nameOwners.delete(previous.name.trim().toLocaleLowerCase());
        player.name = player.name.trim();
        const known = { ...player, lastSeen: undefined };
        const profileChanged = !previous || JSON.stringify({ ...previous, lastSeen: undefined }) !== JSON.stringify(known);
        this.nameOwners.set(player.name.toLocaleLowerCase(), player.playerId);
        this.knownPlayers.set(player.playerId, known);
        this.onlinePlayers.set(player.playerId, { ...player, lastSeen: now });
        const writes: Promise<unknown>[] = [];
        if (profileChanged) writes.push(this.saveKnown());
        if (!previous || renamed) writes.push(this.ctx.storage.put('names-v1', [...this.nameOwners]));
        await Promise.all(writes);
        return json({ ok: true });
      }
    }
    if (url.pathname === '/apple-gift' && request.method === 'POST') {
      const data = await request.json() as { targetId?: unknown; from?: unknown };
      const from = parseSocialPlayer(data.from);
      const target = typeof data.targetId === 'string' ? this.onlinePlayers.get(data.targetId) : undefined;
      if (!from || !target || target.playerId === from.playerId) return json({ sent: false, delivered: false });
      const delivered = await this.deliver('/apple-gift', target.room, { targetId: target.playerId, from: from.playerId, name: from.name, count: 1 });
      return json({ sent: true, delivered });
    }
    if ((url.pathname === '/friend-request' || url.pathname === '/friend-accept') && request.method === 'POST') {
      const data = await request.json() as { targetId?: unknown; requestId?: unknown; from?: unknown };
      const from = parseSocialPlayer(data.from);
      const target = typeof data.targetId === 'string' ? this.knownPlayers.get(data.targetId) : undefined;
      if (!from || !target || target.playerId === from.playerId) return json({ sent: false });
      const requestId = typeof data.requestId === 'string' && data.requestId.length <= 80 ? data.requestId : crypto.randomUUID();
      if (url.pathname === '/friend-accept') {
        const pending = (this.invitations.get(target.playerId) ?? []).filter((item) => !(item.kind === 'friend-request' && item.requestId === requestId));
        this.invitations.set(target.playerId, pending);
        this.queue(target.playerId, 'friend-accept', requestId, from);
      } else {
        this.queue(target.playerId, 'friend-request', requestId, from);
      }
      await this.saveInvitations();
      const delivered = await this.deliver(url.pathname, target.room, { targetId: target.playerId, requestId, from });
      return json({ sent: true, delivered });
    }
    return json({ error: 'Not found' }, 404);
  }
}
