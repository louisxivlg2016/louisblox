import { HEIST_LOOT, HEIST_PRISON_SPAWN } from '../src/game/heistCity';
import type { PlayerAttachment } from './index';

type Role = 'thief' | 'guard';
type PlayerSocket = { socket: WebSocket; attachment: PlayerAttachment };
type HeistRoom = {
  mode: () => string;
  players: () => PlayerSocket[];
  broadcast: (message: unknown) => void;
  save: () => Promise<void>;
};

export class HeistEngine {
  private roles = new Map<string, Role>();
  private carried = new Map<string, number>();
  private lootRespawns = new Map<string, number>();
  private prison = new Set<string>();
  private arrestHits = new Map<string, number>();
  private score = 0;
  private phase: 'prep' | 'running' | 'finished' = 'prep';
  private endsAt = Date.now() + 30000;
  private winner: 'thieves' | 'guards' | null = null;
  private prisonSince = 0;
  private syncAt = 0;

  constructor(private room: HeistRoom) {}

  reset() {
    this.roles.clear();
    this.carried.clear();
    this.lootRespawns.clear();
    this.prison.clear();
    this.arrestHits.clear();
    this.score = 0;
    this.phase = 'prep';
    this.endsAt = Date.now() + 30000;
    this.winner = null;
    this.prisonSince = 0;
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
    this.endsAt = state.endsAt ?? Date.now() + 30000;
    this.winner = state.winner ?? null;
  }

  snapshot() {
    return { roles: [...this.roles], carried: [...this.carried], lootRespawns: [...this.lootRespawns], prison: [...this.prison], score: this.score, phase: this.phase, endsAt: this.endsAt, winner: this.winner };
  }

  message() {
    return { type: 'heist-state', roles: Object.fromEntries(this.roles), carried: Object.fromEntries(this.carried), lootRespawns: Object.fromEntries(this.lootRespawns), prison: [...this.prison], score: this.score, phase: this.phase, endsAt: this.endsAt, winner: this.winner };
  }

  private update() {
    this.room.broadcast(this.message());
  }

  chooseRole(player: PlayerAttachment, requested: unknown): Role | null {
    if (this.room.mode() !== 'heist' || this.phase === 'finished') return null;
    if (requested === 'thief' || requested === 'guard') return requested;
    if (requested !== 'auto' && requested !== undefined) return null;
    let thieves = 0;
    let guards = 0;
    for (const { attachment } of this.room.players()) {
      if (attachment.playerId === player.playerId) continue;
      if (this.roles.get(attachment.playerId) === 'thief') thieves += 1;
      if (this.roles.get(attachment.playerId) === 'guard') guards += 1;
    }
    return thieves < guards * 2 ? 'thief' : 'guard';
  }

  private target(targetId: unknown) {
    return this.room.players().find(({ attachment }) => attachment.playerId === targetId);
  }

  private checkVictory() {
    if (this.phase === 'finished') return;
    const now = Date.now();
    if (this.phase === 'prep' && now >= this.endsAt) this.phase = 'running';
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
    const allInPrison = thieves.length > 0 && thieves.every(({ attachment }) => this.prison.has(attachment.playerId));
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
    if (data.type === 'heist-loot' && role === 'thief' && !this.prison.has(player.playerId)) {
      const loot = HEIST_LOOT.find((entry) => entry.id === data.id);
      if (!loot || (this.lootRespawns.get(loot.id) ?? 0) > Date.now() || (this.carried.get(player.playerId) ?? 0) > 0 || !player.state || Math.hypot(player.state.x - loot.x, player.state.y - loot.y, player.state.z - loot.z) > 4) return true;
      this.carried.set(player.playerId, loot.value);
      this.lootRespawns.set(loot.id, Date.now() + 120000);
      this.update();
      return true;
    }
    if (data.type === 'heist-deposit' && role === 'thief') {
      const value = this.carried.get(player.playerId) ?? 0;
      if (value > 0) {
        this.score += value;
        this.carried.set(player.playerId, 0);
        this.checkVictory();
        this.update();
        void this.room.save();
      }
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
      if (!target || this.roles.get(target.attachment.playerId) !== 'thief') return true;
      target.socket.send(JSON.stringify({ type: 'heist-taser' }));
      return true;
    }
    if (data.type === 'heist-release' && role === 'thief') {
      this.prison.delete(player.playerId);
      this.update();
      return true;
    }
    return true;
  }
}
