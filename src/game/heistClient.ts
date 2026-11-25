import { create } from 'zustand';
import type { Camera } from 'three';
import type { World as KootaWorld } from 'koota';
import { Vector3 } from 'three';
import { useGameStore } from './store';
import { useMultiplayerStore, useRemotePlayerStore } from './multiplayerStore';
import { useBattleStore, respawnAtBase } from './battle';
import { Player, PlayerPosition } from './traits';
import { HEIST_DEPOSIT, HEIST_HIDEOUT, HEIST_LOOT, HEIST_PRISON_SPAWN, HEIST_TUNNEL_EXIT } from './heistCity';
import type { HeistLoot } from './heistCity';
import { addVoxel, getBlockIndex } from './chunks';
import { BlockKind, raycastVoxel } from './voxel';
import { translate } from './language';
import { isDown } from './input';
import { moveVoxelCharacter } from './systems/collisionSystem';
import { world } from './world';

export type HeistRole = 'thief' | 'guard';
type HeistPhase = 'prep' | 'running' | 'finished';
type Trap = { x: number; y: number; z: number };

const initial = {
  role: null as HeistRole | null,
  roles: {} as Record<string, HeistRole>,
  phase: 'prep' as HeistPhase,
  endsAt: 0,
  score: 0,
  carried: 0,
  carriedLootIds: [] as string[],
  lootRespawns: {} as Record<string, number>,
  prison: [] as string[],
  winner: null as 'thieves' | 'guards' | null,
  coins: 500,
  alarmUntil: 0,
  alarmPosition: null as { x: number; y: number; z: number } | null,
  slowUntil: 0,
  grappleReadyAt: 0,
  smokeUntil: 0,
  traps: [] as Trap[],
};
export const useHeistStore = create<typeof initial>(() => ({ ...initial, roles: {}, lootRespawns: {}, carriedLootIds: [], prison: [], traps: [] }));
let socket: WebSocket | null = null;
export function setHeistSocket(next: WebSocket | null) { socket = next; }
export function clearHeist() {
  socket = null;
  useHeistStore.setState({ ...initial, roles: {}, lootRespawns: {}, carriedLootIds: [], prison: [], traps: [] });
}
function send(message: unknown) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
function localId() { return useBattleStore.getState().localPlayerId ?? ''; }
function offline() { return socket?.readyState !== WebSocket.OPEN; }
function loadout(role: HeistRole, prison = false) {
  const slots = prison
    ? ['hand', 'pickaxe_wood', null, null, null, null, null, null, null, null]
    : role === 'guard'
      ? ['handcuffs', 'taser', 'heist_trap', 'security_key', null, null, null, null, null, null]
      : ['pickaxe_wood', 'grappling_hook', 'gallery_projectiles_smoke_grenade', BlockKind.Tnt, null, null, null, null, null, null];
  useGameStore.setState({ hotbarSlots: slots as import('./items').SelectedKind[], selected: prison ? 'pickaxe_wood' : (slots as import('./items').SelectedKind[])[0]!, selectedSlot: prison ? 1 : 0 });
}
export function chooseHeistRole(role: HeistRole) {
  if (offline()) {
    useHeistStore.setState({ role, endsAt: Date.now() + 30000 });
    loadout(role);
    respawnAtBase(world, null, HEIST_HIDEOUT);
  } else send({ type: 'heist-team', role });
  useGameStore.getState().setMode('play');
}

function collectLoot(loot: HeistLoot) {
  const state = useHeistStore.getState();
  if (state.carried > 0) {
    useGameStore.getState().setNotice(translate('Dépose d’abord ton butin au repaire.', 'Deposit your loot at the hideout first.'));
    return;
  }
  useHeistStore.setState({ carried: loot.value, carriedLootIds: [loot.id], lootRespawns: { ...state.lootRespawns, [loot.id]: Date.now() + 120000 } });
  useGameStore.getState().setNotice(translate(`${loot.name} volé · ${loot.value} pièces. Retourne au repaire !`, `${loot.name} stolen · ${loot.value} coins. Return to the hideout!`));
  send({ type: 'heist-loot', id: loot.id });
}
function deposit() {
  const state = useHeistStore.getState();
  if (state.carried <= 0) return;
  const score = state.score + state.carried;
  useHeistStore.setState({ score, carried: 0, carriedLootIds: [], coins: state.coins + Math.floor(state.carried / 10) });
  send({ type: 'heist-deposit' });
  if (score >= 10000) useHeistStore.setState({ phase: 'finished', winner: 'thieves' });
  useGameStore.getState().setNotice(translate(`Butin déposé · ${score}/10 000 pièces.`, `Loot deposited · ${score}/10,000 coins.`));
}
function release() {
  const id = localId();
  useHeistStore.setState({ prison: useHeistStore.getState().prison.filter((playerId) => playerId !== id) });
  loadout('thief');
  respawnAtBase(world, null, HEIST_HIDEOUT);
  send({ type: 'heist-release' });
  useGameStore.getState().setNotice(translate('Évasion réussie ! Ton équipement est récupéré.', 'Escape successful! Your equipment is restored.'));
}

const openings = new WeakMap<KootaWorld, { id: string; since: number; duration: number }>();
const deposits = new WeakMap<KootaWorld, number>();
const tunnelResets = new WeakMap<KootaWorld, number>();
const grappleDown = new WeakMap<KootaWorld, boolean>();
const direction = new Vector3();

function nearestLoot(position: Vector3) {
  const respawns = useHeistStore.getState().lootRespawns;
  return HEIST_LOOT.find((loot) => (respawns[loot.id] ?? 0) <= Date.now() && Math.hypot(position.x - loot.x, position.y - loot.y, position.z - loot.z) <= 3);
}
function restoreTunnel(world: KootaWorld) {
  const now = Date.now();
  const last = tunnelResets.get(world) ?? 0;
  if (now - last < 60000) return;
  tunnelResets.set(world, now);
  for (let x = 24; x <= 42; x += 1) for (let z = 40; z <= 52; z += 1) for (let y = 1; y <= 3; y += 1) {
    const pillar = x % 7 === 0 && z % 5 === 0;
    if (pillar) continue;
    const gravel = (x * 13 + z * 7) % 10 < 2;
    addVoxel(world, x, y, z, gravel ? BlockKind.Sand : BlockKind.Dirt, undefined, undefined, 0, undefined, undefined, false, true);
  }
}
function useGrapple(world: KootaWorld, camera: Camera) {
  const state = useHeistStore.getState();
  if (state.role !== 'thief' || state.grappleReadyAt > Date.now() || state.prison.includes(localId())) return;
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return;
  camera.getWorldDirection(direction);
  moveVoxelCharacter(getBlockIndex(world), player, { x: direction.x * 12, y: Math.max(2, direction.y * 12), z: direction.z * 12 }, false);
  useHeistStore.setState({ grappleReadyAt: Date.now() + 15000 });
  useGameStore.getState().setNotice(translate('Grappin utilisé · recharge 15 secondes.', 'Grapple used · 15-second cooldown.'));
}
function nearestThief(position: Vector3) {
  const roles = useHeistStore.getState().roles;
  return Object.entries(useRemotePlayerStore.getState().players)
    .filter(([id, state]) => roles[id] === 'thief' && Math.hypot(position.x - state.x, position.y - state.y, position.z - state.z) <= 3)
    .sort((a, b) => Math.hypot(position.x - a[1].x, position.y - a[1].y, position.z - a[1].z) - Math.hypot(position.x - b[1].x, position.y - b[1].y, position.z - b[1].z))[0]?.[0];
}

export function heistControlSystem(world: KootaWorld, camera: Camera, actions: { place: number; harvest: number; tap: number; interact: number }) {
  if (useGameStore.getState().gameplayMode !== 'heist') return false;
  const state = useHeistStore.getState();
  if (!state.role && offline()) chooseHeistRole('thief');
  const current = useHeistStore.getState();
  if (current.phase === 'prep' && Date.now() >= current.endsAt) useHeistStore.setState({ phase: 'running' });
  if (current.phase !== 'finished' && current.phase !== 'prep' && Date.now() >= current.endsAt) useHeistStore.setState({ phase: 'finished', winner: 'guards' });
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return true;
  restoreTunnel(world);
  const pressedGrapple = isDown('KeyG');
  if (pressedGrapple && !grappleDown.get(world)) useGrapple(world, camera);
  grappleDown.set(world, pressedGrapple);

  if (current.role === 'thief' && current.phase === 'running') {
    const openingLoot = nearestLoot(player);
    const opening = openings.get(world);
    if (openingLoot) {
      if (opening?.id !== openingLoot.id && (actions.harvest > 0 || actions.interact > 0 || actions.tap > 0)) openings.set(world, { id: openingLoot.id, since: Date.now(), duration: openingLoot.building === 'bank' ? 15000 : openingLoot.building === 'museum' ? 5000 : 3000 });
      const currentOpening = openings.get(world);
      if (currentOpening && Date.now() - currentOpening.since >= currentOpening.duration) {
        collectLoot(openingLoot);
        openings.delete(world);
      } else if (currentOpening) useGameStore.getState().setNotice(translate(`Ouverture de ${openingLoot.name} · ${Math.ceil((currentOpening.duration - Date.now() + currentOpening.since) / 1000)} s`, `Opening ${openingLoot.name} · ${Math.ceil((currentOpening.duration - Date.now() + currentOpening.since) / 1000)} s`));
    } else if (opening) openings.delete(world);
    if (Math.hypot(player.x - HEIST_DEPOSIT.x, player.y - HEIST_DEPOSIT.y, player.z - HEIST_DEPOSIT.z) <= 2.5 && current.carried > 0) {
      const since = deposits.get(world) ?? Date.now();
      deposits.set(world, since);
      if (Date.now() - since >= 2000) {
        deposit();
        deposits.delete(world);
      } else useGameStore.getState().setNotice(translate('Dépôt en cours · reste 2 secondes.', 'Depositing · stay for 2 seconds.'));
    } else deposits.delete(world);
    if (current.prison.includes(localId()) && Math.hypot(player.x - HEIST_TUNNEL_EXIT.x, player.y - HEIST_TUNNEL_EXIT.y, player.z - HEIST_TUNNEL_EXIT.z) <= 3) release();
    if (Math.abs(player.y - 9) <= 1 && Math.abs(player.x) <= 10 && [-35, -33, -31, -29].some((z) => Math.abs(player.z - z) < 0.55)) {
      if (current.alarmUntil < Date.now()) useGameStore.getState().setNotice(translate('Laser déclenché ! Les gardiens voient ta position.', 'Laser triggered! Guards can see your position.'));
      useHeistStore.setState({ alarmUntil: Date.now() + 10000, alarmPosition: { x: player.x, y: player.y, z: player.z } });
    }
    for (const trap of current.traps) {
      if (Math.hypot(player.x - trap.x, player.y - trap.y, player.z - trap.z) < 1.2) useHeistStore.setState({ slowUntil: Date.now() + 4000 });
    }
  }
  if (current.role === 'guard' && (actions.harvest > 0 || actions.interact > 0 || actions.tap > 0)) {
    const target = nearestThief(player);
    if (target && useGameStore.getState().selected === 'handcuffs') send({ type: 'heist-arrest', targetId: target });
    if (target && useGameStore.getState().selected === 'taser') send({ type: 'heist-taser', targetId: target });
    if (useGameStore.getState().selected === 'heist_trap') {
      useHeistStore.setState({ traps: [...current.traps.filter((trap) => Math.hypot(player.x - trap.x, player.z - trap.z) > 1), { x: Math.round(player.x), y: Math.round(player.y), z: Math.round(player.z) }] });
      useGameStore.getState().setNotice(translate('Bloc piège placé.', 'Trap block placed.'));
    }
  }
  return true;
}

export function heistMovementMultiplier() {
  const state = useHeistStore.getState();
  return (state.carried >= 1500 ? 0.85 : 1) * (state.slowUntil > Date.now() ? 0.5 : 1);
}

export function receiveHeistState(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  const roles = data.roles && typeof data.roles === 'object' ? data.roles as Record<string, HeistRole> : {};
  const carried = data.carried && typeof data.carried === 'object' ? data.carried as Record<string, number> : {};
  const lootRespawns = data.lootRespawns && typeof data.lootRespawns === 'object' ? data.lootRespawns as Record<string, number> : {};
  const prison = Array.isArray(data.prison) ? data.prison.filter((id): id is string => typeof id === 'string') : [];
  const previous = useHeistStore.getState();
  const role = roles[localId()] ?? previous.role;
  if (role && role !== previous.role) loadout(role, prison.includes(localId()));
  useHeistStore.setState({
    role,
    roles,
    phase: data.phase === 'running' || data.phase === 'finished' ? data.phase : 'prep',
    endsAt: typeof data.endsAt === 'number' ? data.endsAt : previous.endsAt,
    score: typeof data.score === 'number' ? Math.max(0, data.score) : 0,
    carried: carried[localId()] ?? 0,
    lootRespawns,
    prison,
    winner: data.winner === 'thieves' || data.winner === 'guards' ? data.winner : null,
  });
}
export function receiveHeistPrison() {
  loadout('thief', true);
  respawnAtBase(world, null, HEIST_PRISON_SPAWN);
}
export function receiveHeistRelease() {
  release();
}

export function receiveHeistTaser() {
  useHeistStore.setState({ slowUntil: Date.now() + 2500 });
  useGameStore.getState().setNotice(translate('Taser · immobilisé pendant 2,5 secondes.', 'Taser · immobilized for 2.5 seconds.'));
}

export function buyHeistItem(kind: 'grappling_hook' | 'gallery_projectiles_smoke_grenade' | 'taser' | 'heist_trap' | typeof BlockKind.Tnt, price: number) {
  const state = useHeistStore.getState();
  if (state.coins < price) {
    useGameStore.getState().setNotice(translate(`Il te manque ${price - state.coins} pièces.`, `You need ${price - state.coins} more coins.`));
    return;
  }
  const game = useGameStore.getState();
  const slot = game.hotbarSlots.indexOf(kind) >= 0 ? game.hotbarSlots.indexOf(kind) : game.hotbarSlots.findIndex((item) => item === null);
  if (slot < 0) {
    game.setNotice(translate('Aucune case vide.', 'No empty slot.'));
    return;
  }
  game.setHotbarSlot(slot, kind);
  useHeistStore.setState({ coins: state.coins - price });
  game.setNotice(translate('Gadget acheté et placé dans une case.', 'Gadget purchased and placed in a slot.'));
}

export function useHeistRadar() {
  const state = useHeistStore.getState();
  if (state.role !== 'guard' || state.coins < 700) return;
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return;
  const target = nearestThief(player);
  if (!target) {
    useGameStore.getState().setNotice(translate('Aucun voleur à proximité.', 'No thief nearby.'));
    return;
  }
  const remote = useRemotePlayerStore.getState().players[target];
  useHeistStore.setState({ coins: state.coins - 700, alarmUntil: Date.now() + 5000, alarmPosition: { x: remote.x, y: remote.y, z: remote.z } });
}

export function heistMiningDuration(kind: BlockKind, selected: import('./items').SelectedKind) {
  if (selected === 'pickaxe_stone') return 0.5;
  if (kind === BlockKind.Dirt) return 2;
  if (kind === BlockKind.Sand || kind === BlockKind.GrayBrick) return 3;
  return 4;
}
