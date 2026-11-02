import type { PlayerAttachment } from './index';

type Team = 'red' | 'blue';
type Phase = 'waiting' | 'countdown' | 'running' | 'restart' | 'penalty' | 'finished';
type Ball = { x: number; y: number; z: number; vx: number; vy: number; vz: number };
type PlayerSocket = { socket: WebSocket; attachment: PlayerAttachment };
type FootballRoom = { mode: () => string; players: () => PlayerSocket[]; broadcast: (message: unknown) => void; save: () => Promise<void>; owner: (playerId: string) => boolean };

const other = (team: Team): Team => team === 'red' ? 'blue' : 'red';
const initialBall = (): Ball => ({ x: 0, y: 9, z: 0, vx: 0, vy: 0, vz: 0 });

export class FootballEngine {
  private phase: Phase = 'waiting';
  private phaseUntil = 0;
  private score = { red: 0, blue: 0 };
  private ball = initialBall();
  private endsAt = 0;
  private overtime = false;
  private winner: Team | null = null;
  private cards: Record<string, { yellow: number; redUntil: number }> = {};
  private lastTouchTeam: Team | null = null;
  private lastKick: { playerId: string; team: Team; offside: boolean } | null = null;
  private penaltyTeam: Team | null = null;
  private penaltyShooterId: string | null = null;
  private notice = 'Choisis ton équipe';
  private whistle?: 'short' | 'long' | 'goal';
  private whistleToken = 0;
  private lastTick = Date.now();
  private lastSent = 0;

  constructor(private room: FootballRoom) {}

  reset() {
    this.phase = 'waiting';
    this.phaseUntil = 0;
    this.score = { red: 0, blue: 0 };
    this.ball = initialBall();
    this.endsAt = 0;
    this.overtime = false;
    this.winner = null;
    this.cards = {};
    this.lastTouchTeam = null;
    this.lastKick = null;
    this.penaltyTeam = null;
    this.penaltyShooterId = null;
    this.notice = 'Choisis ton équipe';
    this.whistle = undefined;
    this.lastTick = Date.now();
    this.lastSent = 0;
  }

  restore(value: unknown) {
    if (!value || typeof value !== 'object') return;
    const state = value as Partial<ReturnType<FootballEngine['snapshot']>>;
    this.phase = state.phase ?? 'waiting';
    this.phaseUntil = state.phaseUntil ?? 0;
    this.score = state.score ?? { red: 0, blue: 0 };
    this.ball = state.ball ?? initialBall();
    this.endsAt = state.endsAt ?? 0;
    this.overtime = state.overtime === true;
    this.winner = state.winner ?? null;
    this.cards = state.cards ?? {};
    this.lastTouchTeam = state.lastTouchTeam ?? null;
    this.lastKick = state.lastKick ?? null;
    this.penaltyTeam = state.penaltyTeam ?? null;
    this.penaltyShooterId = state.penaltyShooterId ?? null;
    this.notice = state.notice ?? 'Choisis ton équipe';
    this.whistleToken = state.whistleToken ?? 0;
    this.lastTick = Date.now();
  }

  snapshot() {
    return { phase: this.phase, phaseUntil: this.phaseUntil, score: this.score, ball: this.ball, endsAt: this.endsAt, overtime: this.overtime, winner: this.winner, cards: this.cards, lastTouchTeam: this.lastTouchTeam, lastKick: this.lastKick, penaltyTeam: this.penaltyTeam, penaltyShooterId: this.penaltyShooterId, notice: this.notice, whistle: this.whistle, whistleToken: this.whistleToken };
  }

  message() {
    return { type: 'football-state', ...this.snapshot() };
  }

  chooseTeam(player: PlayerAttachment, requested: unknown): Team | null {
    if (this.room.mode() !== 'football') return null;
    if (requested === 'red' || requested === 'blue') return requested;
    if (requested !== 'auto') return null;
    const counts = { red: 0, blue: 0 };
    for (const { attachment } of this.room.players()) {
      if (attachment.playerId !== player.playerId && (attachment.team === 'red' || attachment.team === 'blue')) counts[attachment.team] += 1;
    }
    return counts.red <= counts.blue ? 'red' : 'blue';
  }

  private update(force = false) {
    const now = Date.now();
    if (!force && now - this.lastSent < 80) return;
    this.lastSent = now;
    this.room.broadcast(this.message());
  }

  private whistleSound(kind: 'short' | 'long' | 'goal') {
    this.whistle = kind;
    this.whistleToken += 1;
  }

  private spawnPositions() {
    const positions: Record<string, { x: number; y: number; z: number; yaw: number }> = {};
    for (const { attachment } of this.room.players()) {
      if (attachment.team !== 'red' && attachment.team !== 'blue') continue;
      positions[attachment.playerId] = { x: attachment.team === 'red' ? -10 : 10, y: 8.51, z: 0, yaw: attachment.team === 'red' ? -Math.PI / 2 : Math.PI / 2 };
    }
    this.room.broadcast({ type: 'football-spawn', positions });
  }

  private kickoff() {
    this.phase = 'countdown';
    this.phaseUntil = Date.now() + 3000;
    this.ball = initialBall();
    this.lastTouchTeam = null;
    this.lastKick = null;
    this.penaltyTeam = null;
    this.penaltyShooterId = null;
    this.notice = 'Coup d’envoi dans 3 secondes';
    this.spawnPositions();
    this.whistleSound('short');
    this.update(true);
  }

  private isOffside(player: PlayerAttachment) {
    if (!player.state || player.team !== 'red' && player.team !== 'blue') return false;
    const defenders = this.room.players().filter(({ attachment }) => attachment.team !== player.team && attachment.state);
    if (defenders.length === 0) return false;
    if (player.team === 'red') {
      const lastDefender = Math.max(...defenders.map(({ attachment }) => attachment.state!.x));
      return player.state.x > lastDefender && player.state.x > 0;
    }
    const lastDefender = Math.min(...defenders.map(({ attachment }) => attachment.state!.x));
    return player.state.x < lastDefender && player.state.x < 0;
  }

  private touch(player: PlayerAttachment) {
    if (!player.state || player.team !== 'red' && player.team !== 'blue') return;
    if (this.lastKick && this.lastKick.offside && this.lastKick.team === player.team && this.lastKick.playerId !== player.playerId) {
      this.notice = `Hors-jeu de ${player.name}`;
      this.ball.x = player.state.x;
      this.ball.z = player.state.z;
      this.ball.vx = this.ball.vy = this.ball.vz = 0;
      this.lastTouchTeam = other(player.team);
      this.lastKick = null;
      this.phase = 'restart';
      this.phaseUntil = Date.now() + 2000;
      this.whistleSound('short');
      this.update(true);
      return;
    }
    this.lastTouchTeam = player.team;
  }

  private kick(player: PlayerAttachment, style: 'shot' | 'power' | 'pass' | 'tackle' = 'shot') {
    if (this.phase !== 'running' || !player.state || !this.canPlay(player)) return;
    if (this.penaltyShooterId && !this.lastKick && player.playerId !== this.penaltyShooterId) return;
    const distance = Math.hypot(player.state.x - this.ball.x, player.state.z - this.ball.z, player.state.y + 0.5 - this.ball.y);
    if (distance > 3) return;
    const yaw = player.state.yaw;
    const pitch = player.state.pitch;
    const horizontal = Math.cos(pitch);
    const speed = style === 'power' ? 18 : style === 'shot' ? 12 : style === 'tackle' ? 9 : 7;
    this.ball.vx = -Math.sin(yaw) * horizontal * speed;
    this.ball.vz = -Math.cos(yaw) * horizontal * speed;
    this.ball.vy = style === 'pass' ? Math.max(1.2, Math.sin(pitch) * speed) : Math.max(2.2, Math.sin(pitch) * speed + (style === 'power' ? 3 : 0));
    this.lastTouchTeam = player.team as Team;
    this.lastKick = { playerId: player.playerId, team: player.team as Team, offside: this.isOffside(player) };
    this.notice = style === 'power' ? 'Tir puissant' : style === 'pass' ? 'Passe' : style === 'tackle' ? 'Tacle réussi' : 'Tir';
    this.update(true);
  }

  canMove(player: PlayerAttachment) {
    if (this.room.mode() !== 'football' || player.team !== 'red' && player.team !== 'blue') return false;
    if (this.phase === 'waiting' || this.phase === 'finished') return false;
    if ((this.cards[player.playerId]?.redUntil ?? 0) > Date.now()) return false;
    return this.phase === 'running' || Date.now() >= this.phaseUntil;
  }

  constrainState(player: PlayerAttachment, state: NonNullable<PlayerAttachment['state']>) {
    if (!this.canMove(player) && player.state) {
      state.x = player.state.x;
      state.y = player.state.y;
      state.z = player.state.z;
    }
    if ((this.cards[player.playerId]?.redUntil ?? 0) > Date.now()) {
      state.x = player.team === 'blue' ? 10 : -10;
      state.y = 8.51;
      state.z = 18;
      return;
    }
    if (this.phase === 'penalty' && this.penaltyShooterId) {
      const direction = this.penaltyTeam === 'red' ? 1 : -1;
      if (player.playerId === this.penaltyShooterId) {
        state.x = Math.max(direction * 18 - 3, Math.min(direction * 18 + 3, state.x));
        state.z = Math.max(-5, Math.min(5, state.z));
      } else if (player.team !== this.penaltyTeam) {
        state.x = Math.max(direction * 26.5 - 1.5, Math.min(direction * 26.5 + 1.5, state.x));
        state.z = Math.max(-4, Math.min(4, state.z));
      } else {
        state.x = Math.max(-16, Math.min(16, state.x));
        state.z = Math.max(-14.5, Math.min(14.5, state.z));
      }
      return;
    }
    state.x = Math.max(-26.5, Math.min(26.5, state.x));
    state.z = Math.max(-14.5, Math.min(14.5, state.z));
  }

  private canPlay(player: PlayerAttachment) {
    return (this.cards[player.playerId]?.redUntil ?? 0) <= Date.now();
  }

  private foul(attacker: PlayerAttachment, targetId: unknown, violent = false) {
    if (this.phase !== 'running' || !attacker.state || !attacker.team || typeof targetId !== 'string') return;
    const target = this.room.players().find(({ attachment }) => attachment.playerId === targetId)?.attachment;
    if (!target?.state || !target.team || target.playerId === attacker.playerId || target.team === attacker.team) return;
    if (Math.hypot(target.state.x - attacker.state.x, target.state.z - attacker.state.z) > 3) return;
    const card = this.cards[attacker.playerId] ?? { yellow: 0, redUntil: 0 };
    card.yellow += 1;
    if (violent || card.yellow >= 2) card.redUntil = Date.now() + 60000;
    this.cards[attacker.playerId] = card;
    const inPenaltyArea = Math.abs(target.state.z) < 8 && (attacker.team === 'red' ? target.state.x < -18 : target.state.x > 18);
    if (inPenaltyArea) {
      this.lastKick = null;
      this.phase = 'penalty';
      this.phaseUntil = Date.now() + 3000;
      this.penaltyTeam = other(attacker.team as Team);
      this.penaltyShooterId = target.playerId;
      const direction = this.penaltyTeam === 'red' ? 1 : -1;
      this.ball = { x: direction * 18, y: 9, z: 0, vx: 0, vy: 0, vz: 0 };
      const positions: Record<string, { x: number; y: number; z: number; yaw: number }> = {};
      for (const { attachment } of this.room.players()) {
        if (attachment.playerId === target.playerId) positions[attachment.playerId] = { x: this.ball.x, y: 8.51, z: 0, yaw: target.team === 'red' ? -Math.PI / 2 : Math.PI / 2 };
        else if (attachment.team === attacker.team) positions[attachment.playerId] = { x: direction * 26, y: 8.51, z: 0, yaw: target.team === 'red' ? -Math.PI / 2 : Math.PI / 2 };
        else positions[attachment.playerId] = { x: 0, y: 8.51, z: 0, yaw: 0 };
      }
      this.room.broadcast({ type: 'football-spawn', positions });
      this.notice = `Penalty pour ${this.penaltyTeam} · ${card.redUntil > Date.now() ? 'carton rouge' : 'carton jaune'}`;
    } else {
      this.phase = 'restart';
      this.phaseUntil = Date.now() + 1500;
      this.ball = { x: target.state.x, y: 9, z: target.state.z, vx: 0, vy: 0, vz: 0 };
      this.notice = `Faute · ${card.redUntil > Date.now() ? 'carton rouge' : 'carton jaune'}`;
    }
    this.whistleSound(card.redUntil > Date.now() ? 'long' : 'short');
    this.update(true);
  }

  private tackle(attacker: PlayerAttachment, targetId: unknown, violent: boolean) {
    if (this.phase !== 'running' || !attacker.state || !attacker.team || typeof targetId !== 'string') return;
    const target = this.room.players().find(({ attachment }) => attachment.playerId === targetId)?.attachment;
    if (!target?.state || !target.team || target.playerId === attacker.playerId || target.team === attacker.team) return;
    const targetDistance = Math.hypot(target.state.x - attacker.state.x, target.state.z - attacker.state.z);
    const ballAtTarget = Math.hypot(target.state.x - this.ball.x, target.state.z - this.ball.z) < 1.8;
    const ballInReach = Math.hypot(attacker.state.x - this.ball.x, attacker.state.z - this.ball.z, attacker.state.y + 0.5 - this.ball.y) <= 3;
    if (!violent && targetDistance <= 3 && ballAtTarget && ballInReach) {
      this.kick(attacker, 'tackle');
      return;
    }
    this.foul(attacker, targetId, violent);
  }

  tick(player: PlayerAttachment) {
    if (this.room.mode() !== 'football') return;
    const now = Date.now();
    if (this.phase === 'waiting') {
      if (this.room.players().some(({ attachment }) => attachment.team === 'red' || attachment.team === 'blue')) {
        this.endsAt = now + 300000;
        this.kickoff();
      }
      return;
    }
    if (this.phase === 'finished') return;
    if ((this.phase === 'countdown' || this.phase === 'restart' || this.phase === 'penalty') && now < this.phaseUntil) return;
    if (this.phase !== 'running') {
      this.phase = 'running';
      this.notice = this.phaseUntil > 0 ? 'Jouez !' : this.notice;
      this.update(true);
    }
    const dt = Math.min(0.2, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;
    if (this.overtime === false && now >= this.endsAt) {
      if (this.score.red === this.score.blue) {
        this.overtime = true;
        this.notice = 'Prolongation : le prochain but gagne';
        this.whistleSound('long');
      } else {
        this.winner = this.score.red > this.score.blue ? 'red' : 'blue';
        this.phase = 'finished';
        this.notice = `Victoire de l’équipe ${this.winner === 'red' ? 'rouge' : 'bleue'}`;
        this.whistleSound('long');
      }
      this.update(true);
      return;
    }
    this.ball.vy -= 12 * dt;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.ball.z += this.ball.vz * dt;
    const friction = Math.exp(-dt * 0.65);
    this.ball.vx *= friction;
    this.ball.vz *= friction;
    if (this.ball.y < 9) {
      this.ball.y = 9;
      this.ball.vy = Math.abs(this.ball.vy) > 1 ? Math.abs(this.ball.vy) * 0.35 : 0;
    }
    for (const { attachment } of this.room.players()) {
      if (!attachment.state || attachment.team !== 'red' && attachment.team !== 'blue' || !this.canPlay(attachment)) continue;
      if (Math.hypot(attachment.state.x - this.ball.x, attachment.state.z - this.ball.z) < 1.15 && this.ball.y < attachment.state.y + 1.4) {
        this.touch(attachment);
        this.ball.vx = -Math.sin(attachment.state.yaw) * 3.2;
        this.ball.vz = -Math.cos(attachment.state.yaw) * 3.2;
      }
    }
    if (Math.abs(this.ball.x) > 26 && Math.abs(this.ball.z) < 4 && this.ball.y < 12.5) {
      const team: Team = this.ball.x > 0 ? 'red' : 'blue';
      this.score[team] += 1;
      this.notice = `But de l’équipe ${team === 'red' ? 'rouge' : 'bleue'} !`;
      this.whistleSound('goal');
      if (this.overtime) {
        this.winner = team;
        this.phase = 'finished';
        this.notice = `But en or · victoire de l’équipe ${team === 'red' ? 'rouge' : 'bleue'}`;
        this.update(true);
      } else this.kickoff();
      return;
    }
    if (Math.abs(this.ball.z) > 15) {
      const team = this.lastTouchTeam ? other(this.lastTouchTeam) : 'red';
      this.notice = `Touche pour ${team === 'red' ? 'rouge' : 'bleu'}`;
      this.ball = { x: Math.max(-22, Math.min(22, this.ball.x)), y: 9, z: Math.sign(this.ball.z) * 14, vx: 0, vy: 0, vz: 0 };
      this.phase = 'restart';
      this.phaseUntil = now + 1500;
      this.lastTouchTeam = team;
      this.lastKick = null;
      this.whistleSound('short');
      this.update(true);
      return;
    }
    if (Math.abs(this.ball.x) > 28) {
      const defending: Team = this.ball.x > 0 ? 'blue' : 'red';
      if (this.lastTouchTeam === defending) {
        this.notice = `Corner pour ${other(defending) === 'red' ? 'rouge' : 'bleu'}`;
        this.ball = { x: Math.sign(this.ball.x) * 25, y: 9, z: Math.sign(this.ball.z || 1) * 13, vx: 0, vy: 0, vz: 0 };
        this.lastTouchTeam = other(defending);
      } else {
        this.notice = `Six-mètres pour ${defending === 'red' ? 'rouge' : 'bleu'}`;
        this.ball = { x: Math.sign(this.ball.x) * 22, y: 9, z: 0, vx: 0, vy: 0, vz: 0 };
        this.lastTouchTeam = defending;
      }
      this.phase = 'restart';
      this.phaseUntil = now + 1500;
      this.lastKick = null;
      this.whistleSound('short');
      this.update(true);
    }
    this.update();
  }

  handle(player: PlayerAttachment, data: Record<string, unknown>) {
    if (this.room.mode() !== 'football') return false;
    if (data.type === 'football-kick') {
      this.kick(player, data.power === true ? 'power' : 'shot');
      return true;
    }
    if (data.type === 'football-pass') {
      this.kick(player, 'pass');
      return true;
    }
    if (data.type === 'football-tackle') {
      this.tackle(player, data.targetId, data.violent === true);
      return true;
    }
    if (data.type === 'football-foul') {
      this.foul(player, data.targetId, data.violent === true);
      return true;
    }
    if (data.type === 'football-whistle') {
      if (this.room.owner?.(player.playerId) === false) return true;
      this.notice = 'Arrêt de jeu par l’arbitre';
      this.phase = 'restart';
      this.phaseUntil = Date.now() + 1500;
      this.whistleSound('short');
      this.update(true);
      return true;
    }
    return false;
  }
}
