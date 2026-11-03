import { generatePirateChunk } from '../src/game/pirates';
import { BlockKind } from '../src/game/voxel';
import type { PlayerAttachment } from './index';

type PirateKit = 'defender' | 'gunner' | 'raider';
type Team = 'red' | 'blue';
type HitKind = 'bullet' | 'rifle' | 'arrow' | 'bomb' | 'melee';
type PlayerSocket = { socket: WebSocket; attachment: PlayerAttachment };

type PirateRoom = {
  mode: () => string;
  players: () => PlayerSocket[];
  health: Map<string, number>;
  scores: Map<string, number>;
  hits: Map<string, number>;
  broadcast: (message: unknown) => void;
  broadcastBattle: () => void;
  setEdit: (key: string, value: number | null) => void;
  save: () => Promise<void>;
};

const objectives: Record<Team, { x: number; y: number; z: number }> = {
  red: { x: -16, y: 7, z: 0 },
  blue: { x: 16, y: 7, z: 0 },
};
const prices: Record<string, number> = { sword_diamond: 12, bow: 6, pistol_bomb: 10, Tnt: 5, OakPlanks: 3, apple: 2 };

function spawn(team: Team) {
  return { x: team === 'red' ? -18 : 18, y: 8.51, z: 3 };
}

export class PirateEngine {
  private kits = new Map<string, PirateKit>();
  private coins = new Map<string, number>();
  private objectives: Record<Team, number> = { red: 6, blue: 6 };
  private eliminated = new Set<string>();
  private winner: Team | null = null;
  private coinsAt = 0;

  constructor(private room: PirateRoom) {}

  reset() {
    this.kits.clear();
    this.coins.clear();
    this.objectives = { red: 6, blue: 6 };
    this.eliminated.clear();
    this.winner = null;
    this.coinsAt = 0;
  }

  restore(value: unknown) {
    if (!value || typeof value !== 'object') return;
    const state = value as { kits?: Array<[string, PirateKit]>; coins?: Array<[string, number]>; objectives?: Record<Team, number>; eliminated?: string[]; winner?: Team; coinsAt?: number };
    this.kits = new Map(state.kits ?? []);
    this.coins = new Map(state.coins ?? []);
    if (state.objectives) this.objectives = { red: Math.max(0, state.objectives.red ?? 6), blue: Math.max(0, state.objectives.blue ?? 6) };
    this.eliminated = new Set(state.eliminated ?? []);
    this.winner = state.winner === 'red' || state.winner === 'blue' ? state.winner : null;
    this.coinsAt = state.coinsAt ?? 0;
  }

  snapshot() {
    return { kits: [...this.kits], coins: [...this.coins], objectives: this.objectives, eliminated: [...this.eliminated], winner: this.winner, coinsAt: this.coinsAt };
  }

  message() {
    return { type: 'pirates-state', ...this.snapshot(), prices };
  }

  private update() {
    this.room.broadcast(this.message());
  }

  chooseTeam(player: PlayerAttachment, requested: unknown): Team | null {
    if (this.room.mode() !== 'pirates') return null;
    if (requested === 'red' || requested === 'blue') return requested;
    if (requested !== 'auto') return null;
    const counts = { red: 0, blue: 0 };
    for (const { attachment } of this.room.players()) {
      if (attachment.playerId !== player.playerId && (attachment.team === 'red' || attachment.team === 'blue')) counts[attachment.team] += 1;
    }
    return counts.red <= counts.blue ? 'red' : 'blue';
  }

  private eliminate(target: PlayerSocket, killerName: string, killer?: PlayerAttachment) {
    const player = target.attachment;
    if (player.team !== 'red' && player.team !== 'blue') return;
    const team = player.team;
    this.room.health.set(player.playerId, 0);
    if (killer) {
      this.room.scores.set(killer.playerId, (this.room.scores.get(killer.playerId) ?? 0) + 1);
      this.coins.set(killer.playerId, (this.coins.get(killer.playerId) ?? 0) + 10);
    }
    this.room.broadcast({ type: 'battle-elimination', messageId: crypto.randomUUID(), killerName, victimName: player.name, killerId: killer?.playerId, victimId: player.playerId });
    if (this.objectives[team] > 0) {
      this.room.health.set(player.playerId, 10);
      target.socket.send(JSON.stringify({ type: 'battle-respawn', team, position: spawn(team) }));
    } else {
      this.eliminated.add(player.playerId);
      target.socket.send(JSON.stringify({ type: 'pirates-final-death', playerId: player.playerId }));
    }
    this.checkVictory();
    this.room.broadcastBattle();
    this.update();
  }

  private checkVictory() {
    if (this.winner) return;
    for (const team of ['red', 'blue'] as const) {
      if (this.objectives[team] > 0) continue;
      const players = this.room.players().filter(({ attachment }) => attachment.team === team);
      if (players.every(({ attachment }) => this.eliminated.has(attachment.playerId))) this.winner = team === 'red' ? 'blue' : 'red';
    }
  }

  hit(attacker: PlayerAttachment, targetId: unknown, kind: unknown) {
    if (this.room.mode() !== 'pirates' || !attacker.team || !attacker.state || (kind !== 'bullet' && kind !== 'rifle' && kind !== 'arrow' && kind !== 'bomb' && kind !== 'melee')) return;
    const now = Date.now();
    if (now - (this.room.hits.get(attacker.playerId) ?? 0) < (kind === 'bomb' ? 0 : kind === 'rifle' ? 80 : 150)) return;
    const target = this.room.players().find(({ attachment }) => attachment.playerId === targetId);
    if (!target || !target.attachment.team || !target.attachment.state || target.attachment.team === attacker.team || target.attachment.state.effects?.includes('invisibility')) return;
    const distance = Math.hypot(target.attachment.state.x - attacker.state.x, target.attachment.state.y - attacker.state.y, target.attachment.state.z - attacker.state.z);
    if (distance > (kind === 'melee' ? 6 : 90)) return;
    this.room.hits.set(attacker.playerId, now);
    const base = kind === 'bomb' ? 3 : kind === 'melee' || kind === 'rifle' ? 2 : 1;
    const attack = (attacker.state.effects?.includes('strength') ? 2 : 1) * (attacker.state.effects?.includes('weakness') ? 0.5 : 1);
    const defence = target.attachment.state.effects?.includes('defence') ? 0.5 : 1;
    const damage = Math.max(1, Math.round(base * attack * defence));
    const remaining = Math.max(0, (this.room.health.get(target.attachment.playerId) ?? 10) - damage);
    if (remaining > 0) {
      this.room.health.set(target.attachment.playerId, remaining);
      this.room.broadcastBattle();
      return;
    }
    this.eliminate(target, attacker.name, attacker);
  }

  damageObjective(attacker: PlayerAttachment, kind: unknown, impact?: { x: number; y: number; z: number }) {
    const point = impact ?? attacker.state;
    if (this.room.mode() !== 'pirates' || !attacker.team || !point || (kind !== 'melee' && kind !== 'cannon')) return;
    const team = attacker.team === 'red' ? 'blue' : 'red';
    if (this.objectives[team] <= 0) return;
    const objective = objectives[team];
    const distance = Math.hypot(point.x - objective.x, point.y - objective.y, point.z - objective.z);
    if (distance > (impact ? 3.5 : kind === 'melee' ? 6 : 90)) return;
    this.objectives[team] -= 1;
    if (this.objectives[team] === 0) {
      this.room.setEdit(`${objective.x},${objective.y},${objective.z}`, null);
      this.room.broadcast({ type: 'edits', edits: [[`${objective.x},${objective.y},${objective.z}`, null]] });
      void this.room.save();
    }
    this.update();
  }

  explode(position: { x: number; y: number; z: number }) {
    if (this.room.mode() !== 'pirates') return;
    const radius = 2.8;
    const edits = new Map<string, null>();
    for (let cx = Math.floor((position.x - radius + 8) / 16); cx <= Math.floor((position.x + radius + 8) / 16); cx++) {
      for (let cz = Math.floor((position.z - radius + 8) / 16); cz <= Math.floor((position.z + radius + 8) / 16); cz++) {
        for (const block of generatePirateChunk(cx, cz).blocks) {
          if (block.kind === BlockKind.Sand || block.kind === BlockKind.Water || block.kind === BlockKind.Chest) continue;
          if (Math.hypot(block.x - position.x, block.y - position.y, block.z - position.z) > radius) continue;
          edits.set(`${block.x},${block.y},${block.z}`, null);
        }
      }
    }
    if (edits.size === 0) return;
    for (const [key, value] of edits) this.room.setEdit(key, value);
    this.room.broadcast({ type: 'edits', edits: [...edits] });
    void this.room.save();
  }

  tick(player: PlayerAttachment) {
    if (this.room.mode() !== 'pirates' || !player.state || !player.team) return;
    if (player.state.y < 4.45 && !this.eliminated.has(player.playerId)) {
      const socket = this.room.players().find(({ attachment }) => attachment.playerId === player.playerId);
      if (socket) this.eliminate(socket, 'Océan');
    }
    const now = Date.now();
    if (now - this.coinsAt < 30000) return;
    this.coinsAt = now;
    for (const { attachment } of this.room.players()) this.coins.set(attachment.playerId, (this.coins.get(attachment.playerId) ?? 0) + 1);
    this.update();
  }

  leave(playerId: string) {
    const attachment = this.room.players().find(({ attachment: player }) => player.playerId === playerId)?.attachment;
    if (attachment?.team === 'red' || attachment?.team === 'blue') {
      if (this.objectives[attachment.team] === 0) this.eliminated.add(playerId);
      this.checkVictory();
    }
    this.kits.delete(playerId);
    this.coins.delete(playerId);
    this.update();
  }

  handle(socket: WebSocket, player: PlayerAttachment, data: Record<string, unknown>) {
    if (this.room.mode() !== 'pirates') return false;
    if (data.type === 'pirates-kit') {
      if (data.kit !== 'defender' && data.kit !== 'gunner' && data.kit !== 'raider') return true;
      this.kits.set(player.playerId, data.kit);
      this.room.health.set(player.playerId, 10);
      socket.send(JSON.stringify({ type: 'pirates-loadout', kit: data.kit }));
      this.update();
      return true;
    }
    if (data.type === 'pirates-objective') {
      this.damageObjective(player, data.kind);
      return true;
    }
    if (data.type === 'pirates-buy') {
      const item = typeof data.item === 'string' ? data.item : '';
      const cost = prices[item];
      const coins = this.coins.get(player.playerId) ?? 0;
      if (!cost || coins < cost) return true;
      this.coins.set(player.playerId, coins - cost);
      socket.send(JSON.stringify({ type: 'pirates-inventory', item, amount: 1, coins: this.coins.get(player.playerId) }));
      this.update();
      return true;
    }
    return false;
  }
}
