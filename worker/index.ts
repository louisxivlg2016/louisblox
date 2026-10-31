import { DurableObject } from 'cloudflare:workers';
import { json, parseAppearance, parseSocialPlayer } from './directory';
import type { Appearance, PlayerDirectory } from './directory';
export { PlayerDirectory } from './directory';

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
  text?: string;
} | null;
type EditEntry = [string, VoxelEdit];
type StoredWorld = { seed: number | null; edits: EditEntry[]; gameplayMode?: 'survival' | 'creative' };
type SharedVehicle = {
  id: string;
  kind: 'car' | 'plane' | 'train' | 'boat';
  color: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  driver: boolean;
};

type PlayerAttachment = {
  playerId: string;
  joinedAt: number;
  name: string;
  character: 'boy' | 'girl';
  outfit: string;
  wig: string;
  appearance: Appearance;
  room: string;
  presenceAt: number;
  state: PlayerState | null;
  worldInitAccepted?: boolean;
};

interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  PLAYER_DIRECTORY: DurableObjectNamespace<PlayerDirectory>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const facings = new Set(['north', 'south', 'east', 'west']);
const outfits = new Set(['default', 'king', 'military', 'knight', 'explorer', 'princess', 'louis14', 'louis15']);
const wigs = new Set(['auto', 'none', 'louis14', 'louis15']);

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
    if (typeof data.text === 'string') result.text = data.text.replace(/\r/g, '').slice(0, 120);
    if (Array.isArray(data.items)) {
      result.items = data.items.slice(0, 64).filter((item): item is string | number => typeof item === 'string' && item.length <= 96 || typeof item === 'number' && Number.isFinite(item));
    }
    edits.push([key, result]);
  }
  return edits;
}

function parseVehicle(value: unknown): SharedVehicle | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.id !== 'string' || data.id.length < 1 || data.id.length > 80) return null;
  if (data.kind !== 'car' && data.kind !== 'plane' && data.kind !== 'train' && data.kind !== 'boat') return null;
  if (typeof data.color !== 'string' || data.color.length < 1 || data.color.length > 32) return null;
  if (!['x', 'y', 'z', 'yaw'].every((key) => typeof data[key] === 'number' && Number.isFinite(data[key]) && Math.abs(data[key] as number) <= 10000000)) return null;
  return {
    id: data.id,
    kind: data.kind,
    color: data.color,
    x: data.x as number,
    y: data.y as number,
    z: data.z as number,
    yaw: data.yaw as number,
    driver: data.driver === true,
  };
}

export class GameRoom extends DurableObject<Env> {
  private worldSeed: number | null = null;
  private worldEdits = new Map<string, VoxelEdit>();
  private vehicles = new Map<string, SharedVehicle>();
  private gameplayMode: 'survival' | 'creative' = 'creative';
  private worldReady?: Promise<void>;

  private async ensureWorld() {
    this.worldReady ??= this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<StoredWorld>('world-v1');
      this.worldSeed = stored?.seed ?? null;
      this.worldEdits = new Map(stored?.edits ?? []);
      this.gameplayMode = stored?.gameplayMode ?? 'creative';
    });
    await this.worldReady;
  }

  private worldSnapshot() {
    return { type: 'world', seed: this.worldSeed, edits: [...this.worldEdits], gameplayMode: this.gameplayMode };
  }

  private async saveWorld() {
    await this.ctx.storage.put('world-v1', { seed: this.worldSeed, edits: [...this.worldEdits], gameplayMode: this.gameplayMode } satisfies StoredWorld);
  }

  private async friendRequest(request: Request) {
    const url = new URL(request.url);
    try {
      const data = await request.json() as { targetId?: unknown; requestId?: unknown; from?: unknown };
      const from = parseSocialPlayer(data.from);
      if (!from || typeof data.targetId !== 'string') return json({ sent: false }, 400);
      const requestId = typeof data.requestId === 'string' && data.requestId.length <= 80 ? data.requestId : crypto.randomUUID();
      const type = url.pathname === '/friend-request' ? 'friend-request' : 'friend-accept';
      return json({ sent: this.sendToPlayer(data.targetId, { type, requestId, from }) });
    } catch {
      return json({ sent: false }, 400);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/friend-request' || url.pathname === '/friend-accept') return this.friendRequest(request);
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426, headers: corsHeaders });
    }
    await this.ensureWorld();
    const [client, server] = Object.values(new WebSocketPair());
    const playerId = crypto.randomUUID();
    const params = url.searchParams;
    const room = params.get('room')?.slice(0, 48) || 'main-room';
    const name = params.get('name')?.trim().slice(0, 24) || 'Joueur';
    const character = params.get('character') === 'girl' ? 'girl' : 'boy';
    const requestedOutfit = params.get('outfit') ?? 'default';
    const outfit = outfits.has(requestedOutfit) ? requestedOutfit : 'default';
    const requestedWig = params.get('wig') ?? 'auto';
    const wig = wigs.has(requestedWig) ? requestedWig : 'auto';
    let appearance: Appearance;
    try {
      appearance = parseAppearance(JSON.parse(params.get('appearance') ?? 'null'), character);
    } catch {
      appearance = parseAppearance(null, character);
    }
    const attachment: PlayerAttachment = { playerId, joinedAt: Date.now(), name, character, outfit, wig, appearance, room, presenceAt: 0, state: null };
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server);
    this.publishPresence(attachment);
    server.send(JSON.stringify({ type: 'join', playerId, name, character, outfit, wig, appearance, players: this.players(playerId) }));
    server.send(JSON.stringify(this.worldSnapshot()));
    server.send(JSON.stringify({ type: 'vehicles', vehicles: [...this.vehicles.values()] }));
    this.broadcast({ type: 'join', playerId, joinedAt: attachment.joinedAt, name, character, outfit, wig, appearance, state: null }, server);
    return new Response(null, { status: 101, webSocket: client, headers: corsHeaders });
  }

  private publishPresence(attachment: PlayerAttachment) {
    attachment.presenceAt = Date.now();
    const directory = this.env.PLAYER_DIRECTORY.get(this.env.PLAYER_DIRECTORY.idFromName('global'));
    this.ctx.waitUntil(directory.fetch('https://directory/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: attachment.playerId,
        name: attachment.name,
        room: attachment.room,
        character: attachment.character,
        outfit: attachment.outfit,
        wig: attachment.wig,
        appearance: attachment.appearance,
        lastSeen: attachment.presenceAt,
      }),
    }));
  }

  private removePresence(attachment: PlayerAttachment) {
    const directory = this.env.PLAYER_DIRECTORY.get(this.env.PLAYER_DIRECTORY.idFromName('global'));
    this.ctx.waitUntil(directory.fetch('https://directory/presence', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: attachment.playerId }),
    }));
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

  private sendToPlayer(playerId: string, message: unknown) {
    const payload = JSON.stringify(message);
    let sent = false;
    for (const ws of this.ctx.getWebSockets()) {
      if (this.attachment(ws)?.playerId !== playerId || ws.readyState !== 1) continue;
      try {
        ws.send(payload);
        sent = true;
      } catch {
        continue;
      }
    }
    return sent;
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
    if (type === 'teleport-request' || type === 'teleport-accept' || type === 'teleport-decline') {
      const attachment = this.attachment(ws);
      const targetId = (data as { targetId?: unknown }).targetId;
      const requestId = (data as { requestId?: unknown }).requestId;
      if (!attachment || typeof targetId !== 'string' || targetId.length > 80 || typeof requestId !== 'string' || requestId.length < 1 || requestId.length > 80) return;
      if (type === 'teleport-request') {
        if (targetId === attachment.playerId) return;
        const sent = this.sendToPlayer(targetId, { type, requestId, from: attachment.playerId, name: attachment.name });
        if (!sent) ws.send(JSON.stringify({ type: 'teleport-unavailable', requestId }));
        return;
      }
      if (type === 'teleport-accept') {
        if (!attachment.state) return;
        const { x, y, z } = attachment.state;
        this.sendToPlayer(targetId, { type, requestId, from: attachment.playerId, name: attachment.name, position: { x, y, z } });
        return;
      }
      this.sendToPlayer(targetId, { type, requestId, from: attachment.playerId, name: attachment.name });
      return;
    }
    if (type === 'vehicle-spawn') {
      const vehicle = parseVehicle((data as { vehicle?: unknown }).vehicle);
      if (!vehicle) return;
      const existing = this.vehicles.get(vehicle.id);
      if (existing) {
        ws.send(JSON.stringify({ type: 'vehicle-state', vehicle: existing }));
        return;
      }
      this.vehicles.set(vehicle.id, vehicle);
      this.broadcast({ type, vehicle }, ws);
      return;
    }
    if (type === 'vehicle-state') {
      const vehicle = parseVehicle((data as { vehicle?: unknown }).vehicle);
      const playerId = this.attachment(ws)?.playerId;
      if (!vehicle || !playerId) return;
      if (vehicle.driver && this.vehicles.get(vehicle.id)?.driver !== true) this.vehicleDrivers.set(vehicle.id, playerId);
      if (!vehicle.driver && this.vehicleDrivers.get(vehicle.id) === playerId) this.vehicleDrivers.delete(vehicle.id);
      this.vehicles.set(vehicle.id, vehicle);
      this.broadcast({ type, vehicle }, ws);
      return;
    }
    if (type === 'vehicle-remove') {
      const vehicleId = (data as { vehicleId?: unknown }).vehicleId;
      if (typeof vehicleId !== 'string' || vehicleId.length > 80) return;
      this.vehicles.delete(vehicleId);
      this.vehicleDrivers.delete(vehicleId);
      this.broadcast({ type, vehicleId }, ws);
      return;
    }
    if (type === 'world-init') {
      const attachment = this.attachment(ws);
      const seed = (data as { seed?: unknown }).seed;
      const edits = parseEdits((data as { edits?: unknown }).edits);
      if (!attachment || typeof seed !== 'number' || !Number.isSafeInteger(seed) || Math.abs(seed) > 1000000000 || !edits) return;
      const replace = this.worldSeed === null || (data as { force?: unknown }).force === true;
      attachment.worldInitAccepted = replace;
      ws.serializeAttachment(attachment);
      if (replace) {
        this.worldSeed = seed;
        this.worldEdits = new Map(edits);
        this.gameplayMode = (data as { gameplayMode?: unknown }).gameplayMode === 'survival' ? 'survival' : 'creative';
      }
      return;
    }
    if (type === 'world-init-edits') {
      const attachment = this.attachment(ws);
      if (!attachment?.worldInitAccepted) return;
      const edits = parseEdits((data as { edits?: unknown }).edits);
      if (!edits) return;
      for (const [position, edit] of edits) this.worldEdits.set(position, edit);
      return;
    }
    if (type === 'world-init-complete') {
      const attachment = this.attachment(ws);
      if (!attachment) return;
      if (attachment.worldInitAccepted) await this.saveWorld();
      attachment.worldInitAccepted = false;
      ws.serializeAttachment(attachment);
      if ((data as { force?: unknown }).force === true) {
        this.vehicles.clear();
        this.broadcast({ type: 'vehicles', vehicles: [] });
        this.broadcast(this.worldSnapshot());
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
    if (type === 'outfit') {
      const attachment = this.attachment(ws);
      const outfit = (data as { outfit?: unknown }).outfit;
      if (!attachment || typeof outfit !== 'string' || !outfits.has(outfit)) return;
      attachment.outfit = outfit;
      ws.serializeAttachment(attachment);
      this.broadcast({ type: 'outfit', playerId: attachment.playerId, outfit }, ws);
      this.publishPresence(attachment);
      return;
    }
    if (type === 'wig') {
      const attachment = this.attachment(ws);
      const wig = (data as { wig?: unknown }).wig;
      if (!attachment || typeof wig !== 'string' || !wigs.has(wig)) return;
      attachment.wig = wig;
      ws.serializeAttachment(attachment);
      this.broadcast({ type: 'wig', playerId: attachment.playerId, wig }, ws);
      this.publishPresence(attachment);
      return;
    }
    if (type === 'appearance') {
      const attachment = this.attachment(ws);
      if (!attachment) return;
      attachment.appearance = parseAppearance((data as { appearance?: unknown }).appearance, attachment.character);
      ws.serializeAttachment(attachment);
      this.broadcast({ type: 'appearance', playerId: attachment.playerId, appearance: attachment.appearance }, ws);
      this.publishPresence(attachment);
      return;
    }
    if (type !== 'state') return;
    const state = parseState((data as { state?: unknown }).state);
    const attachment = this.attachment(ws);
    if (!state || !attachment) return;
    attachment.state = state;
    ws.serializeAttachment(attachment);
    this.broadcast({ type: 'state', playerId: attachment.playerId, state }, ws);
    if (Date.now() - attachment.presenceAt > 10000) this.publishPresence(attachment);
  }

  private vehicleDrivers = new Map<string, string>();

  private releaseDriver(playerId: string, sender: WebSocket) {
    for (const [vehicleId, driverId] of this.vehicleDrivers) {
      if (driverId !== playerId) continue;
      const vehicle = this.vehicles.get(vehicleId);
      this.vehicleDrivers.delete(vehicleId);
      if (!vehicle) continue;
      vehicle.driver = false;
      this.broadcast({ type: 'vehicle-state', vehicle }, sender);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const attachment = this.attachment(ws);
    if (attachment) {
      this.releaseDriver(attachment.playerId, ws);
      this.removePresence(attachment);
      this.broadcast({ type: 'leave', playerId: attachment.playerId }, ws);
    }
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('Multiplayer WebSocket error', error);
    const attachment = this.attachment(ws);
    if (attachment) {
      this.releaseDriver(attachment.playerId, ws);
      this.removePresence(attachment);
      this.broadcast({ type: 'leave', playerId: attachment.playerId }, ws);
    }
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
    if (url.pathname === '/players' || url.pathname === '/presence' || url.pathname === '/friend-request' || url.pathname === '/friend-accept') {
      const id = env.PLAYER_DIRECTORY.idFromName('global');
      return env.PLAYER_DIRECTORY.get(id).fetch(request);
    }
    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room') || 'main-room';
      const id = env.GAME_ROOM.idFromName(roomId);
      return env.GAME_ROOM.get(id).fetch(request);
    }
    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
