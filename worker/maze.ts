import type { PlayerAttachment } from './index';
import { MAZE_PLAYGROUND_BOUNDS, mazePlaygroundSpawn } from '../src/game/mazePlayground';

type Phase = 'playground' | 'waiting' | 'ready' | 'countdown' | 'running' | 'finished';
type PlayerSocket = { socket: WebSocket; attachment: PlayerAttachment };
type MazeRoom = { mode: () => string; players: () => PlayerSocket[]; broadcast: (message: unknown) => void; owner: (playerId: string) => boolean; barriers: (open: boolean) => void; save: () => Promise<void> };
const lanes = [-18, -14, -10, -6, -2, 2, 6, 10, 14, 18];

export class MazeEngine {
  static barrierKeys = lanes.flatMap((x) => [`${x},9,21`, `${x},10,21`]);
  private phase: Phase = 'playground';
  private phaseUntil = 0;
  private startedAt = 0;
  private winner: string | null = null;
  private winnerName: string | null = null;
  private finishMs = 0;
  private notice = 'The referee is preparing the start';
  private whistleToken = 0;
  private barriersOpen = false;
  private course = 0;
  private lanes = new Map<string, number>();

  constructor(private room: MazeRoom) {}

  reset() {
    this.phase = 'playground';
    this.phaseUntil = 0;
    this.startedAt = 0;
    this.winner = null;
    this.winnerName = null;
    this.finishMs = 0;
    this.notice = 'The referee is preparing the start';
    this.barriersOpen = false;
    this.course = 0;
    this.lanes.clear();
    if (this.room.mode() === 'maze') this.room.barriers(false);
    this.spawnAll();
    this.update();
  }

  restore(value: unknown) {
    if (!value || typeof value !== 'object') return;
    const data = value as Partial<ReturnType<MazeEngine['snapshot']>>;
    this.phase = data.phase ?? 'playground';
    this.phaseUntil = data.phaseUntil ?? 0;
    this.startedAt = data.startedAt ?? 0;
    this.winner = data.winner ?? null;
    this.winnerName = data.winnerName ?? null;
    this.finishMs = data.finishMs ?? 0;
    this.notice = data.notice ?? 'The referee is preparing the start';
    this.whistleToken = data.whistleToken ?? 0;
    this.barriersOpen = data.barriersOpen === true;
    this.course = data.course ?? 0;
    this.lanes = new Map(Object.entries(data.lanes ?? {}));
  }

  snapshot() {
    return { phase: this.phase, phaseUntil: this.phaseUntil, startedAt: this.startedAt, winner: this.winner, winnerName: this.winnerName, finishMs: this.finishMs, notice: this.notice, whistleToken: this.whistleToken, barriersOpen: this.barriersOpen, course: this.course, lanes: Object.fromEntries(this.lanes) };
  }

  message() {
    return { type: 'maze-state', ...this.snapshot() };
  }

  private update() {
    this.room.broadcast(this.message());
  }

  private laneFor(playerId: string) {
    let lane = this.lanes.get(playerId);
    if (lane !== undefined) return lane;
    lane = 0;
    const occupied = new Set(this.lanes.values());
    while (occupied.has(lane)) lane += 1;
    this.lanes.set(playerId, lane);
    return lane;
  }

  leave(playerId: string) {
    this.lanes.delete(playerId);
  }

  private position(index: number) {
    if (this.phase === 'playground') return mazePlaygroundSpawn(index);
    return { x: lanes[Math.abs(index) % lanes.length], y: 8.51, z: 23, yaw: 0 };
  }

  private spawnAll() {
    if (this.room.mode() !== 'maze') return;
    const positions: Record<string, { x: number; y: number; z: number; yaw: number }> = {};
    for (const { attachment } of this.room.players()) positions[attachment.playerId] = this.position(this.laneFor(attachment.playerId));
    this.room.broadcast({ type: 'maze-spawn', positions });
  }

  join(player: PlayerAttachment) {
    if (this.room.mode() !== 'maze') return;
    const position = this.phase === 'finished' ? mazePlaygroundSpawn(this.laneFor(player.playerId)) : this.position(this.laneFor(player.playerId));
    this.room.broadcast({ type: 'maze-spawn', positions: { [player.playerId]: position } });
  }

  private spawnPlayground() {
    if (this.room.mode() !== 'maze') return;
    const positions: Record<string, { x: number; y: number; z: number; yaw: number }> = {};
    for (const { attachment } of this.room.players()) positions[attachment.playerId] = mazePlaygroundSpawn(this.laneFor(attachment.playerId));
    this.room.broadcast({ type: 'maze-spawn', positions });
  }

  private whistle() {
    this.whistleToken += 1;
  }

  constrainState(player: PlayerAttachment, state: NonNullable<PlayerAttachment['state']>) {
    state.flying = false;
    if (this.phase === 'playground' || this.phase === 'finished' && this.course < 99) {
      state.x = Math.max(MAZE_PLAYGROUND_BOUNDS.minX, Math.min(MAZE_PLAYGROUND_BOUNDS.maxX, state.x));
      state.z = Math.max(MAZE_PLAYGROUND_BOUNDS.minZ, Math.min(MAZE_PLAYGROUND_BOUNDS.maxZ, state.z));
      return;
    }
    if (this.room.owner(player.playerId) && state.y > 15.5) {
      state.x = Math.max(-2, Math.min(2, state.x));
      state.z = Math.max(22, Math.min(26, state.z));
      return;
    }
    if (this.phase !== 'running') {
      const spawn = player.state ?? this.position(this.laneFor(player.playerId));
      state.x = spawn.x;
      state.y = spawn.y;
      state.z = spawn.z;
    }
    state.x = Math.max(-21.5, Math.min(21.5, state.x));
    state.z = Math.max(-24.5, Math.min(24.5, state.z));
  }

  tick(player: PlayerAttachment) {
    if (this.room.mode() !== 'maze') return;
    const now = Date.now();
    if (this.phase === 'playground') {
      if (!player.state || Math.abs(player.state.x - 128) > 4 || player.state.z < 90 || player.state.z > 99 || player.state.y >= 14) return;
      this.phase = 'waiting';
      this.notice = 'Maze unlocked! Take your places!';
      this.spawnAll();
      this.update();
      void this.room.save();
      return;
    }
    if (this.phase === 'countdown' && now >= this.phaseUntil) {
      this.phase = 'running';
      this.startedAt = now;
      this.notice = 'PARTEZ !';
      this.barriersOpen = true;
      this.room.barriers(true);
      this.whistle();
      this.update();
      void this.room.save();
      return;
    }
    if (this.phase !== 'running' || !player.state || player.state.y > 14) return;
    if (Math.abs(player.state.x - 18) > 1.8 || player.state.z >= -21.5) return;
    this.phase = 'finished';
    this.winner = player.playerId;
    this.winnerName = player.name;
    this.finishMs = Math.max(0, now - this.startedAt);
    const final = this.course === 99;
    this.notice = final ? 'All 100 courses complete!' : `${player.name} found the exit! Course ${this.course + 1}/100 unlocked!`;
    if (!final) this.course += 1;
    if (!final && this.course < 99) this.spawnPlayground();
    else {
      this.phase = final ? 'finished' : 'waiting';
      this.spawnAll();
    }
    this.whistle();
    this.update();
    void this.room.save();
  }

  handle(player: PlayerAttachment, data: Record<string, unknown>) {
    if (this.room.mode() !== 'maze' || !this.room.owner(player.playerId)) return false;
    if (data.type === 'maze-start' && (this.phase === 'waiting' || this.phase === 'ready')) {
      this.phase = this.phase === 'waiting' ? 'ready' : 'countdown';
      this.phaseUntil = this.phase === 'countdown' ? Date.now() + 3000 : 0;
      this.notice = this.phase === 'ready' ? 'Ready? Take your places!' : '3… 2… 1…';
      this.whistle();
      this.spawnAll();
      this.update();
      return true;
    }
    if (data.type === 'maze-continue' && this.phase === 'finished') {
      this.phase = this.course === 99 ? 'waiting' : 'playground';
      this.notice = this.course === 99 ? 'Final level · the Maze!' : `Course ${this.course + 1}/100 · reach the cake!`;
      this.spawnAll();
      this.update();
      void this.room.save();
      return true;
    }
    if (data.type === 'maze-reset') {
      this.reset();
      void this.room.save();
      return true;
    }
    return false;
  }
}
