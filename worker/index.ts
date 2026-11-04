import { DurableObject } from 'cloudflare:workers';
import { json, parseAppearance, parseSocialPlayer } from './directory';
import type { Appearance, PlayerDirectory } from './directory';
import { PirateEngine } from './pirates';
import { FootballEngine } from './football';
import { MazeEngine } from './maze';
export { PlayerDirectory } from './directory';

export type PlayerState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  flying: boolean;
  moving: boolean;
  airborne?: boolean;
  mounted?: boolean;
  vehicleKind?: 'car' | 'horse' | 'plane' | 'train' | 'boat';
  vehicleId?: string;
  horse?: { id: string; x: number; y: number; z: number; yaw: number };
  emote?: 'sit' | 'lie' | 'wave' | null;
  selected?: string | number;
  effects?: string[];
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
type GameplayMode = 'survival' | 'creative' | 'battle' | 'city-ancient' | 'city-modern' | 'pirates' | 'football' | 'maze';
type WorldTemplate = 'nature' | 'city-ancient' | 'city-modern';
type BattleTeam = 'red' | 'blue' | `solo:${string}`;

function soloSpawn() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 11 + Math.random() * 8;
  return { x: Math.round(Math.cos(angle) * radius * 10) / 10, y: 8.51, z: Math.round(Math.sin(angle) * radius * 10) / 10 };
}
type WorldProtection = { ownerId: string; centerX: number; centerZ: number; radius: 500; enabled: boolean; allowedPlayerIds: string[]; canBreak?: boolean; canPlace?: boolean; bannedPlayerIds?: string[]; bannedPlayerNames?: Record<string, string> };
type StoredWorld = { seed: number | null; edits: EditEntry[]; gameplayMode?: GameplayMode; worldId?: string; template?: WorldTemplate; protection?: WorldProtection; pirates?: ReturnType<PirateEngine['snapshot']>; football?: ReturnType<FootballEngine['snapshot']>; maze?: ReturnType<MazeEngine['snapshot']> };
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

export type PlayerAttachment = {
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
  lastChatAt?: number;
  team?: BattleTeam;
  lastHealAt?: number;
  regenerationNextAt?: number;
  poisonNextAt?: number;
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
const potionEffects = new Set(['speed', 'slowness', 'jump', 'doubleJump', 'haste', 'strength', 'weakness', 'defence', 'regeneration', 'poison', 'invisibility', 'heatResistance', 'knockback']);

function parseHorse(value: unknown): PlayerState['horse'] {
  if (!value || typeof value !== 'object') return undefined;
  const horse = value as Record<string, unknown>;
  if (typeof horse.id !== 'string' || horse.id.length === 0 || horse.id.length > 80) return undefined;
  if (!['x', 'y', 'z', 'yaw'].every((key) => typeof horse[key] === 'number' && Number.isFinite(horse[key]))) return undefined;
  return { id: horse.id, x: horse.x as number, y: horse.y as number, z: horse.z as number, yaw: horse.yaw as number };
}

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
    airborne: state.airborne === true,
    mounted: state.mounted === true,
    vehicleKind: state.vehicleKind === 'car' || state.vehicleKind === 'horse' || state.vehicleKind === 'plane' || state.vehicleKind === 'train' || state.vehicleKind === 'boat' ? state.vehicleKind : undefined,
    vehicleId: state.vehicleKind === 'car' && typeof state.vehicleId === 'string' && state.vehicleId.length > 0 && state.vehicleId.length <= 80 ? state.vehicleId : undefined,
    horse: state.vehicleKind === 'horse' ? parseHorse(state.horse) : undefined,
    emote: state.emote === 'sit' || state.emote === 'lie' || state.emote === 'wave' ? state.emote : null,
    selected: typeof state.selected === 'string' && state.selected.length > 0 && state.selected.length <= 96
      ? state.selected
      : typeof state.selected === 'number' && Number.isInteger(state.selected) && state.selected >= 0 && state.selected <= 200 ? state.selected : undefined,
    effects: Array.isArray(state.effects) ? state.effects.filter((effect): effect is string => typeof effect === 'string' && potionEffects.has(effect)).slice(0, potionEffects.size) : undefined,
  };
}

function parseEdits(value: unknown): EditEntry[] | null {
  if (!Array.isArray(value) || value.length > 512) return null;
  const edits: EditEntry[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [x, y, z] = String(entry[0]).split(',').map(Number);
    if (![x, y, z].every(Number.isInteger) || Math.abs(x) > 10000000 || Math.abs(z) > 10000000 || y < -64 || !Number.isSafeInteger(y)) return null;
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

function parseProjectile(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.id !== 'string' || data.id.length < 1 || data.id.length > 80) return null;
  if (data.kind !== 'arrow' && data.kind !== 'bullet' && data.kind !== 'bomb') return null;
  if (!['x', 'y', 'z'].every((key) => typeof data[key] === 'number' && Number.isFinite(data[key]) && Math.abs(data[key] as number) <= 10000000)) return null;
  if (!['vx', 'vy', 'vz'].every((key) => typeof data[key] === 'number' && Number.isFinite(data[key]) && Math.abs(data[key] as number) <= 10000)) return null;
  if (typeof data.life !== 'number' || !Number.isFinite(data.life) || data.life < 0 || data.life > 30) return null;
  if (typeof data.damage !== 'number' || !Number.isFinite(data.damage) || data.damage < 0 || data.damage > 100) return null;
  return {
    id: data.id,
    kind: data.kind,
    x: data.x as number,
    y: data.y as number,
    z: data.z as number,
    vx: data.vx as number,
    vy: data.vy as number,
    vz: data.vz as number,
    life: data.life,
    damage: data.damage,
    color: typeof data.color === 'string' && /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : undefined,
  };
}

function parseExplosion(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') return null;
  const position = value as Record<string, unknown>;
  if (!['x', 'y', 'z'].every((key) => typeof position[key] === 'number' && Number.isFinite(position[key]) && Math.abs(position[key] as number) <= 10000000)) return null;
  return { x: position.x as number, y: position.y as number, z: position.z as number };
}

function parsePaint(value: unknown) {
  const position = parseExplosion(value);
  if (position === undefined || position === null) return position;
  const data = value as Record<string, unknown>;
  if (!['nx', 'ny', 'nz'].every((key) => typeof data[key] === 'number' && Number.isFinite(data[key]) && Math.abs(data[key] as number) <= 1)) return null;
  if (typeof data.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(data.color)) return null;
  return { ...position, nx: data.nx as number, ny: data.ny as number, nz: data.nz as number, color: data.color };
}

function parseWorldProtection(value: unknown, ownerId: string): WorldProtection | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const data = value as Record<string, unknown>;
  if (data.ownerId !== ownerId || typeof data.centerX !== 'number' || !Number.isFinite(data.centerX) || typeof data.centerZ !== 'number' || !Number.isFinite(data.centerZ) || data.radius !== 500 || typeof data.enabled !== 'boolean') return undefined;
  if (!Array.isArray(data.allowedPlayerIds) || data.allowedPlayerIds.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 80)) return undefined;
  const banned = Array.isArray(data.bannedPlayerIds) ? data.bannedPlayerIds.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 80 && id !== ownerId).slice(0, 100) : [];
  const bannedPlayerNames: Record<string, string> = {};
  const savedNames = data.bannedPlayerNames && typeof data.bannedPlayerNames === 'object' ? data.bannedPlayerNames as Record<string, unknown> : {};
  for (const id of banned) {
    const name = savedNames[id];
    if (typeof name === 'string') bannedPlayerNames[id] = name.trim().slice(0, 24) || 'Joueur';
  }
  return {
    ownerId,
    centerX: data.centerX,
    centerZ: data.centerZ,
    radius: 500,
    enabled: data.enabled,
    allowedPlayerIds: [...new Set([ownerId, ...data.allowedPlayerIds])].slice(0, 50),
    canBreak: data.canBreak === true,
    canPlace: data.canPlace === true,
    bannedPlayerIds: banned,
    bannedPlayerNames,
  };
}

export class GameRoom extends DurableObject<Env> {
  private worldSeed: number | null = null;
  private worldId?: string;
  private protection?: WorldProtection;
  private worldEdits = new Map<string, VoxelEdit>();
  private vehicles = new Map<string, SharedVehicle>();
  private gameplayMode: GameplayMode = 'creative';
  private worldTemplate: WorldTemplate = 'nature';
  private battleHealth = new Map<string, number>();
  private battleScores = { red: 0, blue: 0 };
  private playerScores = new Map<string, number>();
  private battleHits = new Map<string, number>();
  private pirates = new PirateEngine({
    mode: () => this.gameplayMode,
    players: () => this.ctx.getWebSockets().flatMap((socket) => {
      const attachment = this.attachment(socket);
      return attachment ? [{ socket, attachment }] : [];
    }),
    health: this.battleHealth,
    scores: this.playerScores,
    hits: this.battleHits,
    broadcast: (message) => this.broadcast(message),
    broadcastBattle: () => this.broadcastBattleState(),
    setEdit: (key, value) => this.worldEdits.set(key, value),
    save: () => this.saveWorld(),
  });
  private football = new FootballEngine({
    mode: () => this.gameplayMode,
    players: () => this.ctx.getWebSockets().flatMap((socket) => {
      const attachment = this.attachment(socket);
      return attachment ? [{ socket, attachment }] : [];
    }),
    broadcast: (message) => this.broadcast(message),
    save: () => this.saveWorld(),
    owner: (playerId) => this.protection?.ownerId === playerId,
  });
  private maze = new MazeEngine({
    mode: () => this.gameplayMode,
    players: () => this.ctx.getWebSockets().flatMap((socket) => {
      const attachment = this.attachment(socket);
      return attachment ? [{ socket, attachment }] : [];
    }),
    broadcast: (message) => this.broadcast(message),
    owner: (playerId) => this.protection?.ownerId === playerId,
    barriers: (open) => {
      const edits = MazeEngine.barrierKeys.map((key): EditEntry => [key, open ? null : { kind: 63, open: false, facing: 'north' }]);
      for (const [key, value] of edits) this.worldEdits.set(key, value);
      this.broadcast({ type: 'edits', edits });
    },
    save: () => this.saveWorld(),
  });
  private worldReady?: Promise<void>;

  private async ensureWorld() {
    this.worldReady ??= this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<StoredWorld>('world-v1');
      this.worldSeed = stored?.seed ?? null;
      this.worldId = stored?.worldId;
      this.protection = stored?.protection;
      this.worldEdits = new Map(stored?.edits ?? []);
      this.gameplayMode = stored?.gameplayMode ?? 'creative';
      this.worldTemplate = stored?.template ?? (this.gameplayMode === 'city-ancient' || this.gameplayMode === 'city-modern' ? this.gameplayMode : 'nature');
      this.pirates.restore(stored?.pirates);
      this.football.restore(stored?.football);
      this.maze.restore(stored?.maze);
    });
    await this.worldReady;
  }

  private worldSnapshot() {
    return { type: 'world', seed: this.worldSeed, edits: [...this.worldEdits], gameplayMode: this.gameplayMode, worldId: this.worldId, template: this.worldTemplate, protection: this.protection };
  }

  private publisherId?: string;
  private publisherName?: string;

  private publishWorld(attachment?: PlayerAttachment) {
    const ownerId = this.protection?.ownerId ?? attachment?.playerId ?? this.publisherId;
    if (!ownerId) return;
    if (attachment) {
      this.publisherId = ownerId;
      this.publisherName = attachment.name;
    }
    const directory = this.env.PLAYER_DIRECTORY.get(this.env.PLAYER_DIRECTORY.idFromName('global'));
    this.ctx.waitUntil(directory.fetch('https://directory/world', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: this.worldId ?? attachment?.room ?? 'main-room', name: this.worldId ?? attachment?.room ?? 'main-room', ownerId, ownerName: this.publisherName ?? 'Créateur', gameplayMode: this.gameplayMode, template: this.worldTemplate, players: this.ctx.getWebSockets().length }),
    }));
  }

  private async saveWorld(publisher?: PlayerAttachment) {
    await this.ctx.storage.put('world-v1', { seed: this.worldSeed, edits: [...this.worldEdits], gameplayMode: this.gameplayMode, worldId: this.worldId, template: this.worldTemplate, protection: this.protection, pirates: this.pirates.snapshot(), football: this.football.snapshot(), maze: this.maze.snapshot() } satisfies StoredWorld);
    this.publishWorld(publisher);
  }

  private canEditAt(playerId: string, x: number, z: number, action: 'break' | 'place' | 'interact' = 'interact') {
    if (this.gameplayMode === 'pirates') return true;
    if (this.gameplayMode === 'football' || this.gameplayMode === 'maze') return false;
    const protection = this.protection;
    if (protection?.ownerId === playerId) return true;
    if (protection?.bannedPlayerIds?.includes(playerId)) return false;
    if (!protection?.enabled || Math.hypot(x - protection.centerX, z - protection.centerZ) > protection.radius) return true;
    if (protection.allowedPlayerIds.includes(playerId)) return true;
    if (action === 'break') return protection.canBreak === true;
    if (action === 'place') return protection.canPlace === true;
    return true;
  }

  private battleSnapshot(excludeId?: string) {
    const teams: Record<string, BattleTeam> = {};
    const health: Record<string, number> = {};
    const playerScores: Record<string, number> = {};
    const names: Record<string, string> = {};
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachment(ws);
      if (!attachment?.team || attachment.playerId === excludeId) continue;
      teams[attachment.playerId] = attachment.team;
      health[attachment.playerId] = this.battleHealth.get(attachment.playerId) ?? 10;
      playerScores[attachment.playerId] = this.playerScores.get(attachment.playerId) ?? 0;
      names[attachment.playerId] = attachment.name;
    }
    return { type: 'battle-state', teams, health, scores: this.battleScores, playerScores, names };
  }

  private broadcastBattleState(excludeId?: string) {
    this.broadcast(this.battleSnapshot(excludeId));
  }

  private removeBattlePlayer(playerId: string) {
    this.maze.leave(playerId);
    this.battleHealth.delete(playerId);
    this.battleHits.delete(playerId);
    this.playerScores.delete(playerId);
    this.broadcastBattleState(playerId);
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

  private async deleteRoom() {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachment(ws);
      if (attachment) this.removePresence(attachment);
      try {
        ws.send(JSON.stringify({ type: 'room-deleted' }));
        ws.close(4004, 'room deleted');
      } catch {
        continue;
      }
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.worldSeed = null;
    this.protection = undefined;
    this.worldEdits.clear();
    this.vehicles.clear();
    this.gameplayMode = 'creative';
    this.battleHealth.clear();
    this.battleHits.clear();
    this.battleScores = { red: 0, blue: 0 };
    this.playerScores.clear();
    this.pirates.reset();
    this.football.reset();
    this.maze.reset();
    this.worldReady = undefined;
    const directory = this.env.PLAYER_DIRECTORY.get(this.env.PLAYER_DIRECTORY.idFromName('global'));
    this.ctx.waitUntil(directory.fetch('https://directory/world', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: this.worldId ?? 'main-room' }) }));
    return json({ deleted: true });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/apple-gift') {
      try {
        const data = await request.json() as { targetId?: unknown; from?: unknown; name?: unknown };
        if (typeof data.from !== 'string' || data.from.length < 1 || data.from.length > 80 || typeof data.targetId !== 'string') return json({ sent: false }, 400);
        const name = typeof data.name === 'string' ? data.name.trim().slice(0, 24) || 'Joueur' : 'Joueur';
        return json({ sent: this.sendToPlayer(data.targetId, { type: 'apple-gift', from: data.from, name, count: 1 }) });
      } catch {
        return json({ sent: false }, 400);
      }
    }
    if (url.pathname === '/friend-request' || url.pathname === '/friend-accept') return this.friendRequest(request);
    if (url.pathname === '/room' && request.method === 'DELETE') return this.deleteRoom();
    if (url.pathname === '/room' && request.method === 'GET') {
      await this.ensureWorld();
      return json({ gameplayMode: this.worldSeed === null ? null : this.gameplayMode, players: this.ctx.getWebSockets().length });
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426, headers: corsHeaders });
    }
    await this.ensureWorld();
    const [client, server] = Object.values(new WebSocketPair());
    const params = url.searchParams;
    const requestedPlayerId = params.get('playerId');
    const playerId = requestedPlayerId && /^[0-9a-f-]{36}$/.test(requestedPlayerId) ? requestedPlayerId : crypto.randomUUID();
    if (this.protection?.bannedPlayerIds?.includes(playerId)) return new Response('Banned from this world', { status: 403, headers: corsHeaders });
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
    server.send(JSON.stringify(this.battleSnapshot()));
    if (this.gameplayMode === 'pirates') server.send(JSON.stringify(this.pirates.message()));
    if (this.gameplayMode === 'football') server.send(JSON.stringify(this.football.message()));
    if (this.gameplayMode === 'maze') {
      server.send(JSON.stringify(this.maze.message()));
      this.maze.join(attachment);
    }
    this.publishWorld(attachment);
    this.broadcast({ type: 'join', playerId, joinedAt: attachment.joinedAt, name, character, outfit, wig, appearance, state: null }, server);
    return new Response(null, { status: 101, webSocket: client, headers: corsHeaders });
  }

  private publishPresence(attachment: PlayerAttachment) {
    const now = Date.now();
    if (now - attachment.presenceAt < 60000) return;
    attachment.presenceAt = now;
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

  private messageQueue: Promise<void> = Promise.resolve();

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    this.messageQueue = this.messageQueue.then(() => this.handleMessage(ws, message)).catch((error) => {
      console.error('WebSocket message error', error);
    });
    await this.messageQueue;
  }

  private async handleMessage(ws: WebSocket, message: string | ArrayBuffer) {
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
    if (type === 'presence') {
      const attachment = this.attachment(ws);
      if (attachment) this.publishPresence(attachment);
      return;
    }
    if (type === 'battle-team') {
      const attachment = this.attachment(ws);
      const requestedTeam = (data as { team?: unknown }).team;
      if (!attachment || (this.gameplayMode !== 'battle' && this.gameplayMode !== 'pirates' && this.gameplayMode !== 'football') || (requestedTeam !== 'red' && requestedTeam !== 'blue' && requestedTeam !== 'solo' && requestedTeam !== 'auto')) return;
      let team: BattleTeam;
      if (this.gameplayMode === 'pirates') {
        const selected = this.pirates.chooseTeam(attachment, requestedTeam);
        if (!selected) return;
        team = selected;
      } else if (this.gameplayMode === 'football') {
        const selected = this.football.chooseTeam(attachment, requestedTeam);
        if (!selected) return;
        team = selected;
      } else {
        if (requestedTeam === 'auto') return;
        team = requestedTeam === 'solo' ? `solo:${attachment.playerId}` : requestedTeam;
      }
      const changed = attachment.team !== team;
      attachment.team = team;
      if (changed) {
        this.battleHealth.set(attachment.playerId, 10);
        attachment.lastHealAt = undefined;
        attachment.regenerationNextAt = undefined;
        attachment.poisonNextAt = undefined;
        if (attachment.state) attachment.state.effects = [];
      }
      ws.serializeAttachment(attachment);
      this.broadcastBattleState();
      return;
    }
    if (type === 'battle-heal') {
      const attachment = this.attachment(ws);
      const amount = (data as { amount?: unknown }).amount;
      if (this.gameplayMode !== 'battle' || !attachment?.team || typeof amount !== 'number' || !Number.isInteger(amount) || amount < -3 || amount > 6 || amount === 0) return;
      const now = Date.now();
      if (now - (attachment.lastHealAt ?? 0) < 2000) return;
      const current = this.battleHealth.get(attachment.playerId) ?? 10;
      const remaining = Math.max(1, Math.min(10, current + amount));
      if (remaining === current) return;
      attachment.lastHealAt = now;
      ws.serializeAttachment(attachment);
      this.battleHealth.set(attachment.playerId, remaining);
      this.broadcastBattleState();
      return;
    }
    if (type === 'battle-hit') {
      const attacker = this.attachment(ws);
      const targetId = (data as { targetId?: unknown }).targetId;
      const kind = (data as { kind?: unknown }).kind;
      if (this.gameplayMode === 'pirates') {
        if (attacker) this.pirates.hit(attacker, targetId, kind);
        return;
      }
      if (this.gameplayMode !== 'battle' || !attacker?.team || typeof targetId !== 'string') return;
      if (kind !== 'bullet' && kind !== 'rifle' && kind !== 'arrow' && kind !== 'bomb' && kind !== 'melee') return;
      const now = Date.now();
      if (now - (this.battleHits.get(attacker.playerId) ?? 0) < (kind === 'bomb' ? 0 : kind === 'rifle' ? 80 : 150)) return;
      const targetSocket = this.ctx.getWebSockets().find((socket) => this.attachment(socket)?.playerId === targetId);
      const target = targetSocket ? this.attachment(targetSocket) : null;
      if (!targetSocket || !target?.team || target.playerId === attacker.playerId || !target.state || !attacker.state) return;
      if (target.team === attacker.team || target.state.effects?.includes('invisibility')) return;
      const distance = Math.hypot(target.state.x - attacker.state.x, target.state.y - attacker.state.y, target.state.z - attacker.state.z);
      if (distance > (kind === 'melee' ? 6 : 90)) return;
      this.battleHits.set(attacker.playerId, now);
      const baseDamage = kind === 'bomb' ? 3 : kind === 'melee' || kind === 'rifle' ? 2 : 1;
      const attack = (attacker.state.effects?.includes('strength') ? 2 : 1) * (attacker.state.effects?.includes('weakness') ? 0.5 : 1);
      const defence = target.state.effects?.includes('defence') ? 0.5 : 1;
      const damage = Math.max(1, Math.round(baseDamage * attack * defence));
      const remaining = Math.max(0, (this.battleHealth.get(targetId) ?? 10) - damage);
      if (remaining > 0) {
        this.battleHealth.set(targetId, remaining);
        if (kind === 'melee' && attacker.state.effects?.includes('knockback')) {
          const x = target.state.x - attacker.state.x;
          const z = target.state.z - attacker.state.z;
          const length = Math.hypot(x, z) || 1;
          targetSocket.send(JSON.stringify({ type: 'battle-knockback', direction: { x: x / length, y: 4, z: z / length } }));
        }
        this.broadcastBattleState();
        return;
      }
      this.playerScores.set(attacker.playerId, (this.playerScores.get(attacker.playerId) ?? 0) + 1);
      if (attacker.team === 'red' || attacker.team === 'blue') this.battleScores[attacker.team] += 1;
      this.battleHealth.set(targetId, 10);
      this.broadcast({
        type: 'battle-elimination',
        messageId: crypto.randomUUID(),
        killerId: attacker.playerId,
        victimId: targetId,
        killerName: attacker.name,
        victimName: target.name,
      });
      const position = target.team === 'red' ? { x: -16, y: 8.51, z: 0 } : target.team === 'blue' ? { x: 16, y: 8.51, z: 0 } : soloSpawn();
      target.state.effects = [];
      target.regenerationNextAt = undefined;
      target.poisonNextAt = undefined;
      targetSocket.serializeAttachment(target);
      targetSocket.send(JSON.stringify({ type: 'battle-respawn', team: target.team, position }));
      this.broadcastBattleState();
      return;
    }
    if (typeof type === 'string' && type.startsWith('football-')) {
      const attachment = this.attachment(ws);
      if (attachment) this.football.handle(attachment, data as Record<string, unknown>);
      return;
    }
    if (typeof type === 'string' && type.startsWith('maze-')) {
      const attachment = this.attachment(ws);
      if (attachment) this.maze.handle(attachment, data as Record<string, unknown>);
      return;
    }
    if (typeof type === 'string' && type.startsWith('pirates-')) {
      const attachment = this.attachment(ws);
      if (attachment) this.pirates.handle(ws, attachment, data as Record<string, unknown>);
      return;
    }
    if (type === 'chat') {
      const attachment = this.attachment(ws);
      const value = (data as { text?: unknown }).text;
      if (!attachment || typeof value !== 'string') return;
      const text = value.replace(/[\r\n\0]/g, ' ').trim().slice(0, 200);
      const sentAt = Date.now();
      if (!text || sentAt - (attachment.lastChatAt ?? 0) < 750) return;
      attachment.lastChatAt = sentAt;
      ws.serializeAttachment(attachment);
      this.broadcast({ type: 'chat', messageId: crypto.randomUUID(), playerId: attachment.playerId, name: attachment.name, text, sentAt });
      return;
    }
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
    if (type === 'projectile-spawn' || type === 'projectile-state') {
      if (this.gameplayMode === 'football' || this.gameplayMode === 'maze') return;
      const projectile = parseProjectile((data as { projectile?: unknown }).projectile);
      if (projectile) this.broadcast({ type, projectile }, ws);
      return;
    }
    if (type === 'projectile-remove') {
      const projectileId = (data as { projectileId?: unknown }).projectileId;
      if (typeof projectileId !== 'string' || projectileId.length < 1 || projectileId.length > 80) return;
      const explosion = parseExplosion((data as { explosion?: unknown }).explosion);
      if (explosion === null) return;
      const paint = parsePaint((data as { paint?: unknown }).paint);
      if (paint === null) return;
      const attacker = this.attachment(ws);
      if (explosion && attacker && this.gameplayMode === 'pirates') {
        this.pirates.explode(explosion);
        this.pirates.damageObjective(attacker, 'cannon', explosion);
      }
      this.broadcast({ type, projectileId, explosion, paint }, ws);
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
      const driverId = this.vehicleDrivers.get(vehicle.id);
      if (driverId && driverId !== playerId) {
        if (!vehicle.driver) {
          const current = this.vehicles.get(vehicle.id);
          if (current) ws.send(JSON.stringify({ type: 'vehicle-state', vehicle: current }));
        }
        return;
      }
      if (vehicle.driver) this.vehicleDrivers.set(vehicle.id, playerId);
      else this.vehicleDrivers.delete(vehicle.id);
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
    if (type === 'protection') {
      const attachment = this.attachment(ws);
      const current = this.protection;
      if (!attachment || !current || current.ownerId !== attachment.playerId) return;
      const protection = parseWorldProtection((data as { protection?: unknown }).protection, current.ownerId);
      if (!protection || protection.centerX !== current.centerX || protection.centerZ !== current.centerZ) return;
      this.protection = protection;
      await this.saveWorld();
      this.broadcast({ type: 'protection', protection: this.protection });
      return;
    }
    if (type === 'moderation-unban') {
      const attachment = this.attachment(ws);
      const targetId = (data as { targetId?: unknown }).targetId;
      if (!attachment || !this.protection || this.protection.ownerId !== attachment.playerId || typeof targetId !== 'string') return;
      this.protection.bannedPlayerIds = (this.protection.bannedPlayerIds ?? []).filter((id) => id !== targetId);
      if (this.protection.bannedPlayerNames) delete this.protection.bannedPlayerNames[targetId];
      await this.saveWorld();
      this.broadcast({ type: 'protection', protection: this.protection });
      return;
    }
    if (type === 'moderation-ban') {
      const attachment = this.attachment(ws);
      const targetId = (data as { targetId?: unknown }).targetId;
      if (!attachment || !this.protection || this.protection.ownerId !== attachment.playerId || typeof targetId !== 'string' || targetId === attachment.playerId) return;
      const target = this.ctx.getWebSockets().find((socket) => this.attachment(socket)?.playerId === targetId);
      const name = target ? this.attachment(target)?.name : undefined;
      this.protection.bannedPlayerIds = [...new Set([...(this.protection.bannedPlayerIds ?? []), targetId])].slice(0, 100);
      this.protection.bannedPlayerNames = { ...this.protection.bannedPlayerNames, [targetId]: name ?? this.protection.bannedPlayerNames?.[targetId] ?? 'Joueur' };
      await this.saveWorld();
      this.broadcast({ type: 'protection', protection: this.protection });
      if (target) {
        target.send(JSON.stringify({ type: 'banned', message: 'Le créateur t’a exclu de ce monde. Il peut te réadmettre ensuite.' }));
        target.close(4003, 'Banned by world owner');
        const targetAttachment = this.attachment(target);
        if (targetAttachment) this.removePresence(targetAttachment);
      }
      return;
    }
    if (type === 'world-init') {
      const attachment = this.attachment(ws);
      const seed = (data as { seed?: unknown }).seed;
      const edits = parseEdits((data as { edits?: unknown }).edits);
      if (!attachment || typeof seed !== 'number' || !Number.isSafeInteger(seed) || Math.abs(seed) > 1000000000 || !edits) return;
      const replace = this.worldSeed === null || (data as { force?: unknown }).force === true;
      if ((data as { force?: unknown }).force === true && this.protection && this.protection.ownerId !== attachment.playerId) {
        attachment.worldInitAccepted = false;
        ws.serializeAttachment(attachment);
        ws.send(JSON.stringify({ type: 'protection-denied' }));
        return;
      }
      attachment.worldInitAccepted = replace;
      ws.serializeAttachment(attachment);
      if (replace) {
        const newWorld = this.worldSeed === null;
        const worldId = (data as { worldId?: unknown }).worldId;
        this.worldId = typeof worldId === 'string' && worldId.length <= 80 ? worldId : undefined;
        this.worldSeed = seed;
        this.worldEdits = new Map(edits);
        const mode = (data as { gameplayMode?: unknown }).gameplayMode;
        this.gameplayMode = mode === 'survival' || mode === 'battle' || mode === 'city-ancient' || mode === 'city-modern' || mode === 'pirates' || mode === 'football' || mode === 'maze' ? mode : 'creative';
        const template = (data as { template?: unknown }).template;
        this.worldTemplate = template === 'city-ancient' || template === 'city-modern' ? template : 'nature';
        if (this.gameplayMode === 'battle') this.protection = undefined;
        else if (newWorld && !this.protection) this.protection = parseWorldProtection((data as { protection?: unknown }).protection, attachment.playerId) ?? { ownerId: attachment.playerId, centerX: 0, centerZ: 0, radius: 500, enabled: true, allowedPlayerIds: [attachment.playerId], canBreak: false, canPlace: false, bannedPlayerIds: [] };
        if (this.gameplayMode === 'pirates') this.pirates.reset();
        if (this.gameplayMode === 'football') this.football.reset();
        if (this.gameplayMode === 'maze') this.maze.reset();
        if (this.gameplayMode === 'battle') {
          this.battleScores = { red: 0, blue: 0 };
          this.playerScores.clear();
          for (const playerId of this.battleHealth.keys()) this.battleHealth.set(playerId, 10);
        } else {
          this.battleHealth.clear();
        }
        this.battleHits.clear();
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
      if (attachment.worldInitAccepted) {
        await this.saveWorld(attachment);
        this.broadcastBattleState();
        if (this.gameplayMode === 'maze') this.maze.join(attachment);
      }
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
      const attachment = this.attachment(ws);
      const edits = parseEdits((data as { edits?: unknown }).edits);
      if (!attachment || !edits || this.worldSeed === null) return;
      const permitted = edits.filter(([position, edit]) => {
        const [x, y, z] = position.split(',').map(Number);
        if (this.canEditAt(attachment.playerId, x, z, edit === null ? 'break' : 'place')) return true;
        ws.send(JSON.stringify({ type: 'protection-denied', x, y, z }));
        return false;
      });
      if (permitted.length === 0) return;
      for (const [position, edit] of permitted) this.worldEdits.set(position, edit);
      await this.saveWorld();
      this.broadcast({ type: 'edits', edits: permitted }, ws);
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
    if (this.gameplayMode === 'football') this.football.constrainState(attachment, state);
    if (this.gameplayMode === 'maze') this.maze.constrainState(attachment, state);
    attachment.state = state;
    ws.serializeAttachment(attachment);
    if (this.gameplayMode === 'pirates') this.pirates.tick(attachment);
    if (this.gameplayMode === 'football') this.football.tick(attachment);
    if (this.gameplayMode === 'maze') this.maze.tick(attachment);
    if (this.gameplayMode === 'battle' && attachment.team) {
      const now = Date.now();
      let changed = false;
      for (const kind of ['regeneration', 'poison'] as const) {
        const key = kind === 'regeneration' ? 'regenerationNextAt' : 'poisonNextAt';
        if (!state.effects?.includes(kind)) {
          attachment[key] = undefined;
          continue;
        }
        if (now < (attachment[key] ?? 0)) continue;
        attachment[key] = now + 2000;
        const health = this.battleHealth.get(attachment.playerId) ?? 10;
        if (kind === 'regeneration' && health < 10) {
          this.battleHealth.set(attachment.playerId, health + 1);
          changed = true;
        } else if (kind === 'poison' && health > 1) {
          this.battleHealth.set(attachment.playerId, health - 1);
          changed = true;
        }
      }
      ws.serializeAttachment(attachment);
      if (changed) this.broadcastBattleState();
    }
    this.broadcast({ type: 'state', playerId: attachment.playerId, state }, ws);
    if (Date.now() - attachment.presenceAt > 60000) this.publishPresence(attachment);
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
      this.removeBattlePlayer(attachment.playerId);
      this.pirates.leave(attachment.playerId);
      this.removePresence(attachment);
      this.publishWorld();
      this.broadcast({ type: 'leave', playerId: attachment.playerId }, ws);
    }
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('Multiplayer WebSocket error', error);
    const attachment = this.attachment(ws);
    if (attachment) {
      this.releaseDriver(attachment.playerId, ws);
      this.removeBattlePlayer(attachment.playerId);
      this.pirates.leave(attachment.playerId);
      this.removePresence(attachment);
      this.publishWorld();
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
    if (url.pathname === '/players' || url.pathname === '/username' || url.pathname === '/presence' || url.pathname === '/friend-request' || url.pathname === '/friend-accept' || url.pathname === '/friend-requests' || url.pathname === '/apple-gift') {
      const id = env.PLAYER_DIRECTORY.idFromName('global');
      return env.PLAYER_DIRECTORY.get(id).fetch(request);
    }
    if (url.pathname === '/room' && (request.method === 'DELETE' || request.method === 'GET')) {
      const roomId = url.searchParams.get('room')?.slice(0, 48);
      if (!roomId) return new Response('Missing room', { status: 400, headers: corsHeaders });
      const response = await env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomId)).fetch(request);
      return new Response(response.body, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/worlds') {
      const directory = env.PLAYER_DIRECTORY.get(env.PLAYER_DIRECTORY.idFromName('global'));
      const response = await directory.fetch(request);
      return new Response(response.body, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room') || 'main-room';
      const playerId = url.searchParams.get('playerId') ?? '';
      const name = url.searchParams.get('name')?.trim() || 'Joueur';
      if (!/^[0-9a-f-]{36}$/.test(playerId)) return json({ error: 'Identifiant joueur requis.' }, 400);
      const directory = env.PLAYER_DIRECTORY.get(env.PLAYER_DIRECTORY.idFromName('global'));
      const claim = await directory.fetch('https://directory/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          name,
          room: roomId,
          character: url.searchParams.get('character'),
          outfit: url.searchParams.get('outfit'),
          wig: url.searchParams.get('wig'),
          appearance: parseAppearance(null),
        }),
      });
      if (!claim.ok) return new Response(claim.body, { status: claim.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const id = env.GAME_ROOM.idFromName(roomId);
      return env.GAME_ROOM.get(id).fetch(request);
    }
    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
