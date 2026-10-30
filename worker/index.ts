import { DurableObject } from 'cloudflare:workers';

type PlayerState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  flying: boolean;
  moving: boolean;
};

type VoxelEdit = number | {
  kind: number;
  open?: boolean;
  growth?: number;
  items?: Array<string | number>;
  facing?: string;
} | null;
type EditEntry = [string, VoxelEdit];
type StoredWorld = { seed: number | null; edits: EditEntry[] };

type PlayerAttachment = {
  playerId: string;
  joinedAt: number;
  name: string;
  character: 'boy' | 'girl';
  state: PlayerState | null;
};

interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const facings = new Set(['north', 'south', 'east', 'west']);

function parseState(value: unknown): PlayerState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Record<string, unknown>;
  if (!['x', 'y', 'z', 'yaw', 'pitch'].every((key) => typeof state[key] === 'number' && Number.isFinite(state[key]))) return null;
  return {
    x: state.x as number,
    y: state.y as number,
    z: state.z as number,
    yaw: state.yaw as number,
    pitch: state.pitch as number,
    flying: state.flying === true,
    moving: state.moving === true,
  };
}

function parseEdits(value: unknown): EditEntry[] | null {
  if (!Array.isArray(value) || value.length > 512) return null;
  const edits: EditEntry[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [x, y, z] = String(entry[0]).split(',').map(Number);
    if (![x, y, z].every(Number.isInteger) || Math.abs(x) > 10000000 || Math.abs(z) > 10000000 || y < -64 || y > 80) return null;
    const key = `${x},${y},${z}`;
    const edit = entry[1];
    if (edit === null) {
      edits.push([key, null]);
      continue;
    }
    if (typeof edit === 'number') {
      if (!Number.isInteger(edit) || edit < 0 || edit > 200) return null;
      edits.push([key, edit]);
      continue;
    }
    if (!edit || typeof edit !== 'object') return null;
    const data = edit as Record<string, unknown>;
    if (typeof data.kind !== 'number' || !Number.isInteger(data.kind) || data.kind < 0 || data.kind > 200) return null;
    const result: Exclude<VoxelEdit, number | null> = { kind: data.kind };
    if (typeof data.open === 'boolean') result.open = data.open;
    if (typeof data.growth === 'number' && Number.isInteger(data.growth) && data.growth >= 0 && data.growth <= 16) result.growth = data.growth;
    if (typeof data.facing === 'string' && facings.has(data.facing)) result.facing = data.facing;
    if (Array.isArray(data.items)) {
      result.items = data.items.slice(0, 64).filter((item): item is string | number => typeof item === 'string' && item.length <= 96 || typeof item === 'number' && Number.isFinite(item));
    }
    edits.push([key, result]);
  }
  return edits;
}

export class GameRoom extends DurableObject {
  private worldSeed: number | null = null;
  private worldEdits = new Map<string, VoxelEdit>();
  private worldReady?: Promise<void>;

  private async ensureWorld() {
    this.worldReady ??= this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<StoredWorld>('world-v1');
      this.worldSeed = stored?.seed ?? null;
      this.worldEdits = new Map(stored?.edits ?? []);
    });
    await this.worldReady;
  }

  private worldSnapshot() {
    return { type: 'world', seed: this.worldSeed, edits: [...this.worldEdits] };
  }

  private async saveWorld() {
    await this.ctx.storage.put('world-v1', { seed: this.worldSeed, edits: [...this.worldEdits] } satisfies StoredWorld);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426, headers: corsHeaders });
    }
    await this.ensureWorld();
    const [client, server] = Object.values(new WebSocketPair());
    const playerId = crypto.randomUUID();
    const params = new URL(request.url).searchParams;
    const name = params.get('name')?.trim().slice(0, 24) || 'Joueur';
    const character = params.get('character') === 'girl' ? 'girl' : 'boy';
    const attachment: PlayerAttachment = { playerId, joinedAt: Date.now(), name, character, state: null };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: 'join', playerId, name, character, players: this.players(playerId) }));
    server.send(JSON.stringify(this.worldSnapshot()));
    this.broadcast({ type: 'join', playerId, joinedAt: attachment.joinedAt, name, character, state: null }, server);
    return new Response(null, { status: 101, webSocket: client, headers: corsHeaders });
  }

  private attachment(ws: WebSocket): PlayerAttachment | null {
    const attachment = ws.deserializeAttachment() as PlayerAttachment | undefined;
    return attachment && typeof attachment.playerId === 'string' ? attachment : null;
  }

  private players(excludeId?: string) {
    return this.ctx.getWebSockets().flatMap((ws) => {
      const attachment = this.attachment(ws);
      return attachment && attachment.playerId !== excludeId ? [attachment] : [];
    });
  }

  private broadcast(message: unknown, sender?: WebSocket) {
    const payload = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === sender || ws.readyState !== 1) continue;
      try {
        ws.send(payload);
      } catch {
        continue;
      }
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string' || message.length > 512000) return;
    let data: unknown;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }
    if (!data || typeof data !== 'object') return;
    const type = (data as { type?: unknown }).type;
    await this.ensureWorld();
    if (type === 'world-init') {
      const seed = (data as { seed?: unknown }).seed;
      const edits = parseEdits((data as { edits?: unknown }).edits);
      if (typeof seed !== 'number' || !Number.isSafeInteger(seed) || Math.abs(seed) > 1000000000 || !edits) return;
      if (this.worldSeed === null || (data as { force?: unknown }).force === true) {
        this.worldSeed = seed;
        this.worldEdits = new Map(edits);
        await this.saveWorld();
        const snapshot = JSON.stringify(this.worldSnapshot());
        if ((data as { force?: unknown }).force === true) this.broadcast(this.worldSnapshot());
        else ws.send(snapshot);
      } else {
        ws.send(JSON.stringify(this.worldSnapshot()));
      }
      return;
    }
    if (type === 'edits') {
      const edits = parseEdits((data as { edits?: unknown }).edits);
      if (!edits || this.worldSeed === null) return;
      for (const [position, edit] of edits) this.worldEdits.set(position, edit);
      await this.saveWorld();
      this.broadcast({ type: 'edits', edits }, ws);
      return;
    }
    if (type !== 'state') return;
    const state = parseState((data as { state?: unknown }).state);
    const attachment = this.attachment(ws);
    if (!state || !attachment) return;
    attachment.state = state;
    ws.serializeAttachment(attachment);
    this.broadcast({ type: 'state', playerId: attachment.playerId, state }, ws);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const playerId = this.attachment(ws)?.playerId;
    if (playerId) this.broadcast({ type: 'leave', playerId }, ws);
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('Multiplayer WebSocket error', error);
    const playerId = this.attachment(ws)?.playerId;
    if (playerId) this.broadcast({ type: 'leave', playerId }, ws);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room') || 'main-room';
      const id = env.GAME_ROOM.idFromName(roomId);
      return env.GAME_ROOM.get(id).fetch(request);
    }
    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
