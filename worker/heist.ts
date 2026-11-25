import { HEIST_DEPOSIT, HEIST_LOOT, HEIST_PRISON_SPAWN, HEIST_TUNNEL_EXIT } from '../src/game/heistCity';
import type { PlayerAttachment } from './index';

type Role = 'thief' | 'guard';
type PlayerSocket = { socket: WebSocket; attachment: PlayerAttachment };
type HeistRoom = {
  mode: () => string;
  players: () => PlayerSocket[];
  broadcast: (message: unknown) => void;
  save: () => Promise<void>;
};

const PREPARATION_MS = 30000;
const ROUND_MS = 600000;

export class HeistEngine {
  private roles = new Map<string, Role>();
  private carried = new Map<string, number>();
  private lootRespawns = new Map<string, number>();
  private prison = new Set<string>();
  private arrestHits = new Map<string, number>();
  private lootOpenings = new Map<string, { id: string; since: number }>();
  private depositStarts = new Map<string, number>();
  private taserReady = new Map<string, number>();
  private score = 0;
  private phase: 'prep' | 'running' | 'finished' = 'prep';
  private endsAt = Date.now() + PREPARATION_MS;
  private winner: 'thieves' | 'guards' | null = null;
  private prisonSince = 0;
  private syncAt = 0;
  private alarmUntil = 0;
  private alarmPosition: { x: number; y: number; z: number } | null = null;

  constructor(private room: HeistRoom) {}

  reset() {
    this.roles.clear();
    this.carried.clear();
    this.lootRespawns.clear();
    this.prison.clear();
    this.arrestHits.clear();
    this.lootOpenings.clear();
    this.depositStarts.clear();
    this.taserReady.clear();
    this.score = 0;
    this.phase = 'prep';
    this.endsAt = Date.now() + PREPARATION_MS;
    this.winner = null;
    this.prisonSince = 0;
    this.alarmUntil = 0;
    this.alarmPosition = null;
  }

  restore(value: unknown) {
    if (!value || typeof value !== 'object') return;
    const state = value as { roles?: Array<[string, Role]>; carried?: Array<[string, number]>; lootRespawns?: Array<[string, number]>; prison?: string[]; score?: number; phase?: 'prep' | 'running' | 'finished'; endsAt?: number; winner?: 'thieves' | 'guards' };
    this.roles = new Map(state.roles ?? []);
    this.carried = new Map(state.carried ?? []);
    this.lootRespawns = new Map(state.lootRespawns ?? []);
    this.prison = new Set(state.prison ?? []);
    this.score = state.score ?? 0;
    this.phase = state.phase ?? 'prep';
    this.endsAt = state.endsAt ?? Date.now() + PREPARATION_MS;
    this.winner = state.winner ?? null;
  }

  snapshot() {
    return { roles: [...this.roles], carried: [...this.carried], lootRespawns: [...this.lootRespawns], prison: [...this.prison], score: this.score, phase: this.phase, endsAt: this.endsAt, winner: this.winner };
  }

  message() {
    return { type: 'heist-state', roles: Object.fromEntries(this.roles), carried: Object.fromEntries(this.carried), lootRespawns: Object.fromEntries(this.lootRespawns), prison: [...this.prison], score: this.score, phase: this.phase, endsAt: this.endsAt, winner: this.winner, alarmUntil: this.alarmUntil, alarmPosition: this.alarmPosition };
  }

  private update() {
    this.room.broadcast(this.message());
  }

  chooseRole(player: PlayerAttachment, requested: unknown): Role | null {
    if (this.room.mode() !== 'heist' || this.phase === 'finished') return null;
    if (requested !== 'thief' && requested !== 'guard' && requested !== 'auto' && requested !== undefined) return null;
    let thieves = 0;
    let guards = 0;
    for (const { attachment } of this.room.players()) {
      if (attachment.playerId === player.playerId) continue;
      if (this.roles.get(attachment.playerId) === 'thief') thieves += 1;
      if (this.roles.get(attachment.playerId) === 'guard') guards += 1;
    }
    if (requested === 'thief' && thieves >= 5 || requested === 'guard' && guards >= 5) return null;
    if (requested === 'thief' || requested === 'guard') return requested;
    return thieves <= guards ? 'thief' : 'guard';
  }

  private target(targetId: unknown) {
    return this.room.players().find(({ attachment }) => attachment.playerId === targetId);
  }

  private checkVictory() {
    if (this.phase === 'finished') return;
    const now = Date.now();
    if (this.phase === 'prep' && now >= this.endsAt) {
      this.phase = 'running';
      this.endsAt = now + ROUND_MS;
    }
    if (this.score >= 10000) {
      this.phase = 'finished';
      this.winner = 'thieves';
      return;
    }
    if (this.phase === 'running' && now >= this.endsAt) {
      this.phase = 'finished';
      this.winner = 'guards';
      return;
    }
    const thieves = this.room.players().filter(({ attachment }) => this.roles.get(attachment.playerId) === 'thief');
    const allInPrison = this.phase === 'running' && thieves.length > 1 && thieves.every(({ attachment }) => this.prison.has(attachment.playerId));
    if (!allInPrison) this.prisonSince = 0;
    else {
      if (!this.prisonSince) this.prisonSince = now;
      if (now - this.prisonSince >= 5000) {
        this.phase = 'finished';
        this.winner = 'guards';
      }
    }
  }

  tick() {
    if (this.room.mode() !== 'heist') return;
    const previous = this.phase;
    this.checkVictory();
    const now = Date.now();
    if (previous !== this.phase || now - this.syncAt >= 1000) {
      this.syncAt = now;
      this.update();
    }
  }

  private triggerAlarm(position: { x: number; y: number; z: number }) {
    this.alarmUntil = Date.now() + 10000;
    this.alarmPosition = position;
    this.update();
  }

  handle(socket: WebSocket, player: PlayerAttachment, data: Record<string, unknown>) {
    if (this.room.mode() !== 'heist' || typeof data.type !== 'string' || !data.type.startsWith('heist-')) return false;
    this.checkVictory();
    if (data.type === 'heist-team') {
      const role = this.chooseRole(player, data.role);
      if (!role) return true;
      this.roles.set(player.playerId, role);
      this.update();
      return true;
    }
    const role = this.roles.get(player.playerId);
    if (data.type === 'heist-alarm' && role === 'thief' && data.position && typeof data.position === 'object') {
      const position = data.position as Record<string, unknown>;
      if (['x', 'y', 'z'].every((key) => typeof position[key] === 'number' && Number.isFinite(position[key]))) this.triggerAlarm({ x: position.x as number, y: position.y as number, z: position.z as number });
      return true;
    }
    if (data.type === 'heist-loot-start' && role === 'thief' && !this.prison.has(player.playerId)) {
      const loot = HEIST_LOOT.find((entry) => entry.id === data.id);
      if (!loot || (this.lootRespawns.get(loot.id) ?? 0) > Date.now() || !player.state || Math.hypot(player.state.x - loot.x, player.state.y - loot.y, player.state.z - loot.z) > 4) return true;
      this.lootOpenings.set(player.playerId, { id: loot.id, since: Date.now() });
      if (loot.building === 'bank') this.triggerAlarm({ x: player.state.x, y: player.state.y, z: player.state.z });
      return true;
    }
    if (data.type === 'heist-loot' && role === 'thief' && !this.prison.has(player.playerId)) {
      const loot = HEIST_LOOT.find((entry) => entry.id === data.id);
      const opening = this.lootOpenings.get(player.playerId);
      const duration = loot?.building === 'bank' ? 15000 : loot?.building === 'museum' ? 5000 : 3000;
      if (!loot || opening?.id !== loot.id || Date.now() - opening.since < duration || (this.lootRespawns.get(loot.id) ?? 0) > Date.now() || (this.carried.get(player.playerId) ?? 0) > 0 || !player.state || Math.hypot(player.state.x - loot.x, player.state.y - loot.y, player.state.z - loot.z) > 4) return true;
      this.lootOpenings.delete(player.playerId);
      this.carried.set(player.playerId, loot.value);
      this.lootRespawns.set(loot.id, Date.now() + 120000);
      this.update();
      return true;
    }
    if (data.type === 'heist-deposit-start' && role === 'thief' && player.state && Math.hypot(player.state.x - HEIST_DEPOSIT.x, player.state.y - HEIST_DEPOSIT.y, player.state.z - HEIST_DEPOSIT.z) <= 3) {
      this.depositStarts.set(player.playerId, Date.now());
      return true;
    }
    if (data.type === 'heist-deposit' && role === 'thief' && !this.prison.has(player.playerId) && player.state && Math.hypot(player.state.x - HEIST_DEPOSIT.x, player.state.y - HEIST_DEPOSIT.y, player.state.z - HEIST_DEPOSIT.z) <= 3) {
      const started = this.depositStarts.get(player.playerId) ?? 0;
      const value = this.carried.get(player.playerId) ?? 0;
      if (value > 0 && Date.now() - started >= 2000) {
        this.depositStarts.delete(player.playerId);
        this.score += value;
        this.carried.set(player.playerId, 0);
        this.checkVictory();
        this.update();
        void this.room.save();
      }
      return true;
    }
    if (data.type === 'heist-bot-arrest' && role === 'thief' && this.room.players().length === 1) {
      this.prison.add(player.playerId);
      this.carried.set(player.playerId, 0);
      socket.send(JSON.stringify({ type: 'heist-prison', position: HEIST_PRISON_SPAWN }));
      this.checkVictory();
      this.update();
      return true;
    }
    if (data.type === 'heist-arrest' && role === 'guard') {
      const target = this.target(data.targetId);
      if (!target || this.roles.get(target.attachment.playerId) !== 'thief' || !target.attachment.state || !player.state || target.attachment.state.effects?.includes('invisibility') || Math.hypot(player.state.x - target.attachment.state.x, player.state.y - target.attachment.state.y, player.state.z - target.attachment.state.z) > 3) return true;
      const hits = (this.arrestHits.get(target.attachment.playerId) ?? 0) + 1;
      if (hits < 2) {
        this.arrestHits.set(target.attachment.playerId, hits);
        return true;
      }
      this.arrestHits.delete(target.attachment.playerId);
      this.prison.add(target.attachment.playerId);
      this.carried.set(target.attachment.playerId, 0);
      target.attachment.state.dead = false;
      target.socket.send(JSON.stringify({ type: 'heist-prison', position: HEIST_PRISON_SPAWN }));
      this.checkVictory();
      this.update();
      return true;
    }
    if (data.type === 'heist-taser' && role === 'guard') {
      const target = this.target(data.targetId);
      const now = Date.now();
      if (!target || this.roles.get(target.attachment.playerId) !== 'thief' || !target.attachment.state || !player.state || (this.taserReady.get(player.playerId) ?? 0) > now || Math.hypot(player.state.x - target.attachment.state.x, player.state.y - target.attachment.state.y, player.state.z - target.attachment.state.z) > 8) return true;
      this.taserReady.set(player.playerId, now + 20000);
      target.socket.send(JSON.stringify({ type: 'heist-taser' }));
      return true;
    }
    if (data.type === 'heist-release' && role === 'thief' && player.state && Math.hypot(player.state.x - HEIST_TUNNEL_EXIT.x, player.state.y - HEIST_TUNNEL_EXIT.y, player.state.z - HEIST_TUNNEL_EXIT.z) <= 4) {
      this.prison.delete(player.playerId);
      this.update();
      return true;
    }
    return true;
  }
}
