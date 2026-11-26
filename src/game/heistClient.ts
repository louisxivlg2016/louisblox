import { create } from 'zustand';
import type { Camera } from 'three';
import type { World as KootaWorld } from 'koota';
import { Vector3 } from 'three';
import { useGameStore } from './store';
import { useMultiplayerStore, useRemotePlayerStore } from './multiplayerStore';
import { useBattleStore, respawnAtBase } from './battle';
import { Player, PlayerBody, PlayerPosition, PlayerVelocity } from './traits';
import { HEIST_DEPOSIT, HEIST_ENTRIES, HEIST_GUARD_SPAWN, HEIST_HIDEOUT, HEIST_LOOT, HEIST_PRISON_SPAWN, HEIST_TUNNEL_EXIT } from './heistCity';
import type { HeistEntry, HeistLoot } from './heistCity';
import { addVoxel, getBlockIndex, loadChunk, removeVoxel, replaceVoxel } from './chunks';
import { BlockKind, raycastVoxel, voxelKey } from './voxel';
import { isDoor, isTrapdoor } from './extraBlocks';
import { translate } from './language';
import { isDown } from './input';
import { moveVoxelCharacter } from './systems/collisionSystem';
import { fireProjectile } from './systems/projectileSystem';
import { world } from './world';
import type { SelectedKind } from './items';
import { playHeistAlarm, stopHeistAlarm } from './heistAlarm';
import { useCharacterStore } from './characterStore';
import { clearHeistLife, heistLifeSystem } from './heistLife';

export type HeistRole = 'thief' | 'guard';
type HeistPhase = 'prep' | 'running' | 'finished';
type Trap = { x: number; y: number; z: number };
type GuardBot = { enabled: boolean; x: number; y: number; z: number; yaw: number; waypoint: number; hits: number; nextArrestAt: number; detecting: boolean; health: number; stunnedUntil: number };
type Gadget = 'grappling_hook' | 'gallery_projectiles_smoke_grenade' | 'taser' | 'heist_trap' | typeof BlockKind.Tnt | typeof BlockKind.Ladder;

const initial = {
  role: null as HeistRole | null,
  roleDeadline: 0,
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
  taserUntil: 0,
  taserReadyAt: 0,
  grappleReadyAt: 0,
  smokeUntil: 0,
  gadgets: {} as Record<string, number>,
  traps: [] as Trap[],
  bot: { enabled: false, x: -35, y: 8.51, z: -25, yaw: 0, waypoint: 0, hits: 0, nextArrestAt: 0, detecting: false, health: 5, stunnedUntil: 0 } as GuardBot,
};
export const useHeistStore = create<typeof initial>(() => ({ ...initial, roles: {}, lootRespawns: {}, carriedLootIds: [], prison: [], gadgets: {}, traps: [] }));
let socket: WebSocket | null = null;
export function setHeistSocket(next: WebSocket | null) { socket = next; }
export function clearHeist() {
  socket = null;
  stopHeistAlarm();
  clearHeistLife();
  useHeistStore.setState({ ...initial, roles: {}, lootRespawns: {}, carriedLootIds: [], prison: [], gadgets: {}, traps: [], bot: { ...initial.bot } });
}
function send(message: unknown) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
function localId() { return useBattleStore.getState().localPlayerId ?? ''; }
function offline() { return socket?.readyState !== WebSocket.OPEN; }
function gadgetCount(kind: Gadget) { return useHeistStore.getState().gadgets[String(kind)] ?? 0; }
export function hasHeistGadget(kind: Gadget) { return gadgetCount(kind) > 0; }
export function consumeHeistGadget(kind: Gadget, amount = 1) {
  const gadgets = { ...useHeistStore.getState().gadgets };
  const count = Math.max(0, (gadgets[String(kind)] ?? 0) - amount);
  if (count) gadgets[String(kind)] = count;
  else delete gadgets[String(kind)];
  useHeistStore.setState({ gadgets });
}
function loadout(role: HeistRole, prison = false) {
  useCharacterStore.getState().setOutfit(role === 'guard' ? 'police' : 'thief');
  const base: Array<SelectedKind | null> = prison
    ? ['hand', 'pickaxe_wood']
    : role === 'guard'
      ? ['handcuffs', 'security_key']
      : ['pickaxe_wood', 'pistol_iron', 'rifle_auto', 'bow'];
  if (!prison) {
    for (const [key, count] of Object.entries(useHeistStore.getState().gadgets)) {
      if (count <= 0) continue;
      const kind = String(Number(key)) === key ? Number(key) as SelectedKind : key as SelectedKind;
      if (!base.includes(kind)) base.push(kind);
    }
  }
  const slots = [...base, ...Array<SelectedKind | null>(10).fill(null)].slice(0, 10);
  const selected = prison ? 'pickaxe_wood' : slots[0]!;
  useGameStore.setState({ hotbarSlots: slots, selected, selectedSlot: prison ? 1 : 0 });
}
export function chooseHeistRole(role: HeistRole) {
  if (offline()) {
    useHeistStore.setState({ role, endsAt: Date.now() + 30000 });
    loadout(role);
    respawnAtBase(world, null, role === 'guard' ? HEIST_GUARD_SPAWN : HEIST_HIDEOUT);
  } else send({ type: 'heist-team', role });
  useGameStore.getState().setMode('play');
}

export function notifyHeistAlarm(position: { x: number; y: number; z: number }) {
  playHeistAlarm();
  useHeistStore.setState({ alarmUntil: Date.now() + 10000, alarmPosition: { ...position } });
  send({ type: 'heist-alarm', position });
}
function collectLoot(loot: HeistLoot) {
  const state = useHeistStore.getState();
  if (state.carried > 0) {
    useGameStore.getState().setNotice(translate('Dépose d’abord ton butin au repaire.', 'Deposit your loot at the hideout first.'));
    return;
  }
  useHeistStore.setState({ carried: loot.value, carriedLootIds: [loot.id], lootRespawns: { ...state.lootRespawns, [loot.id]: Date.now() + 120000 } });
  useGameStore.getState().setNotice(translate(`${loot.name} volé · ${loot.value} pièces. Retourne au repaire !`, `${loot.name} stolen · ${loot.value} coins. Return to the hideout!`));
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (player) notifyHeistAlarm(player);
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
const entryOpenings = new WeakMap<KootaWorld, { id: string; since: number; duration: number }>();
const openedEntries = new WeakMap<KootaWorld, Set<string>>();
const deposits = new WeakMap<KootaWorld, number>();
const tunnelResets = new WeakMap<KootaWorld, number>();
const grappleDown = new WeakMap<KootaWorld, boolean>();
const direction = new Vector3();

function nearestLoot(position: Vector3) {
  const respawns = useHeistStore.getState().lootRespawns;
  return HEIST_LOOT.find((loot) => (respawns[loot.id] ?? 0) <= Date.now() && Math.hypot(position.x - loot.x, position.y - loot.y, position.z - loot.z) <= 3);
}
function nearestEntry(world: KootaWorld, position: Vector3) {
  const opened = openedEntries.get(world);
  return HEIST_ENTRIES.find((entry) => !opened?.has(entry.id) && Math.hypot(position.x - entry.x, position.y - entry.y, position.z - entry.z) <= 3);
}
const preloadedTunnels = new WeakSet<KootaWorld>();
export function preloadHeistTunnel(world: KootaWorld) {
  if (preloadedTunnels.has(world)) return;
  for (let cx = -3; cx <= 3; cx += 1) for (let cz = 1; cz <= 3; cz += 1) loadChunk(world, cx, cz);
  preloadedTunnels.add(world);
}

function restoreTunnel(world: KootaWorld) {
  if (useHeistStore.getState().prison.length > 0) return;
  const now = Date.now();
  const last = tunnelResets.get(world) ?? 0;
  if (now - last < 60000) return;
  tunnelResets.set(world, now);
  for (let x = 24; x <= 45; x += 1) for (let z = 34; z <= 52; z += 1) for (let y = 1; y <= 3; y += 1) {
    const existing = getBlockIndex(world).get(voxelKey(x, y, z));
    if (existing?.protected) continue;
    const value = ((x * 13 + z * 7 + y * 31) % 10 + 10) % 10;
    addVoxel(world, x, y, z, value <= 2 ? BlockKind.Sand : BlockKind.Dirt, undefined, undefined, 0, undefined, undefined, false, true);
  }
  for (let y = 2; y <= 3; y += 1) {
    const block = getBlockIndex(world).get(voxelKey(24, y, 47));
    if (block) replaceVoxel(world, { block, x: 24, y, z: 47, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, BlockKind.GrayBrick, undefined, undefined, undefined, undefined, undefined, undefined, false, true);
    else addVoxel(world, 24, y, 47, BlockKind.GrayBrick, undefined, undefined, 0, undefined, undefined, false, true);
  }
  for (const [x, z] of [[31, 34], [37, 34], [43, 34], [31, 42], [37, 42], [43, 42]] as const) for (let y = 1; y <= 4; y += 1) {
    const block = getBlockIndex(world).get(voxelKey(x, y, z));
    if (block) replaceVoxel(world, { block, x, y, z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, BlockKind.Dirt, undefined, undefined, undefined, undefined, undefined, undefined, false, true);
    else addVoxel(world, x, y, z, BlockKind.Dirt, undefined, undefined, 0, undefined, undefined, false, true);
  }
}
function useGrapple(world: KootaWorld, camera: Camera) {
  const state = useHeistStore.getState();
  if (state.role !== 'thief' || state.grappleReadyAt > Date.now() || state.prison.includes(localId()) || !hasHeistGadget('grappling_hook')) return;
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return;
  camera.getWorldDirection(direction);
  moveVoxelCharacter(getBlockIndex(world), player, { x: direction.x * 12, y: Math.max(2, direction.y * 12), z: direction.z * 12 }, false);
  useHeistStore.setState({ grappleReadyAt: Date.now() + 15000 });
  useGameStore.getState().setNotice(translate('Grappin utilisé · recharge 15 secondes.', 'Grapple used · 15-second cooldown.'));
}
function nearestThief(position: Vector3, maxDistance = 3) {
  const roles = useHeistStore.getState().roles;
  return Object.entries(useRemotePlayerStore.getState().players)
    .filter(([id, state]) => roles[id] === 'thief' && Math.hypot(position.x - state.x, position.y - state.y, position.z - state.z) <= maxDistance)
    .sort((a, b) => Math.hypot(position.x - a[1].x, position.y - a[1].y, position.z - a[1].z) - Math.hypot(position.x - b[1].x, position.y - b[1].y, position.z - b[1].z))[0]?.[0];
}
function openEntry(world: KootaWorld, entry: HeistEntry) {
  const opened = openedEntries.get(world) ?? new Set<string>();
  opened.add(entry.id);
  openedEntries.set(world, opened);
  const blocks = getBlockIndex(world);
  for (const position of entry.blocks) {
    const block = blocks.get(voxelKey(position.x, position.y, position.z));
    if (!block) continue;
    const hit = { block, ...position, normal: { x: 0, y: 1, z: 0 }, distance: 0 };
    if (isDoor(block.kind) || isTrapdoor(block.kind)) replaceVoxel(world, hit, block.kind, true, undefined, undefined, undefined, undefined, undefined, undefined, true);
    else removeVoxel(world, hit, true);
  }
  if (entry.requiresTnt) consumeHeistGadget(BlockKind.Tnt);
  if (entry.destination) {
    const player = world.queryFirst(Player);
    const position = player?.get(PlayerPosition);
    if (position) {
      position.set(entry.destination.x, entry.destination.y, entry.destination.z);
      player!.get(PlayerBody)!.value!.setNextKinematicTranslation(position);
    }
  }
  useGameStore.getState().setNotice(translate(`${entry.name} ouvert.`, `${entry.name} opened.`));
}
function toggleDoor(world: KootaWorld, camera: Camera, player: Vector3, actions: { place: number; harvest: number; tap: number; interact: number }) {
  if (actions.harvest <= 0 && actions.interact <= 0 && actions.tap <= 0) return;
  const origin = player.clone();
  origin.y += 1.62;
  camera.getWorldDirection(direction);
  const hit = raycastVoxel(getBlockIndex(world), origin, direction, 4, true);
  if (!hit || !isDoor(hit.block.kind) && !isTrapdoor(hit.block.kind)) return;
  if (HEIST_ENTRIES.some((entry) => entry.blocks.some((position) => position.x === hit.x && position.y === hit.y && position.z === hit.z))) return;
  replaceVoxel(world, hit, hit.block.kind, !hit.block.open, undefined, undefined, undefined, undefined, undefined, undefined, true);
}

function updateEntries(world: KootaWorld, player: Vector3, role: HeistRole | null, selected: SelectedKind, actions: { place: number; harvest: number; tap: number; interact: number }) {
  const entry = nearestEntry(world, player);
  const current = entryOpenings.get(world);
  if (!entry || !role) {
    if (current) entryOpenings.delete(world);
    return;
  }
  const activated = actions.harvest > 0 || actions.interact > 0 || actions.tap > 0;
  if (role === 'guard') {
    if (activated && selected === 'security_key') openEntry(world, entry);
    else if (activated) useGameStore.getState().setNotice(translate('Utilise la clé de sécurité pour ouvrir cette porte.', 'Use the security key to open this door.'));
    return;
  }
  if (entry.requiresTnt && (selected !== BlockKind.Tnt || !hasHeistGadget(BlockKind.Tnt))) {
    if (activated) useGameStore.getState().setNotice(translate('Il faut une dynamite pour ouvrir ce mur.', 'You need dynamite to open this wall.'));
    return;
  }
  if (activated && current?.id !== entry.id) {
    entryOpenings.set(world, { id: entry.id, since: Date.now(), duration: entry.duration });
    if (entry.alarm) notifyHeistAlarm(player);
  }
  const opening = entryOpenings.get(world);
  if (!opening || opening.id !== entry.id) return;
  const elapsed = Date.now() - opening.since;
  if (elapsed >= opening.duration) {
    openEntry(world, entry);
    entryOpenings.delete(world);
  } else useGameStore.getState().setNotice(translate(`${entry.name} · ${Math.ceil((opening.duration - elapsed) / 1000)} s`, `${entry.name} · ${Math.ceil((opening.duration - elapsed) / 1000)} s`));
}
function keepGuardsOutsideHideout(world: KootaWorld, role: HeistRole | null) {
  if (role !== 'guard') return;
  const entity = world.queryFirst(Player);
  const player = entity?.get(PlayerPosition);
  if (!player || player.x < -50 || player.x > -35 || player.z < 34 || player.z > 49 || player.y > 17) return;
  const sides = [
    { distance: Math.abs(player.x + 50), axis: 'x' as const, value: -50.6 },
    { distance: Math.abs(player.x + 35), axis: 'x' as const, value: -34.4 },
    { distance: Math.abs(player.z - 34), axis: 'z' as const, value: 33.4 },
    { distance: Math.abs(player.z - 49), axis: 'z' as const, value: 49.6 },
  ].sort((a, b) => a.distance - b.distance);
  const side = sides[0];
  player[side.axis] = side.value;
  entity?.get(PlayerVelocity)?.set(0, 0, 0);
  entity!.get(PlayerBody)!.value!.setNextKinematicTranslation(player);
  useGameStore.getState().setNotice(translate('Zone sûre des voleurs : les gardiens ne peuvent pas entrer.', 'Thief safe zone: guards cannot enter.'));
}
function useSmoke(world: KootaWorld, camera: Camera, player: Vector3) {
  if (!hasHeistGadget('gallery_projectiles_smoke_grenade')) return;
  camera.getWorldDirection(direction);
  fireProjectile(world, player.clone().add(new Vector3(0, 1.62, 0)), direction, 'bomb', 0, undefined, 'smoke');
  consumeHeistGadget('gallery_projectiles_smoke_grenade');
}

function singleHuman() {
  return Object.keys(useRemotePlayerStore.getState().players).length === 0;
}
const botWaypoints = [
  { x: -42, y: 8.51, z: -22 },
  { x: -28, y: 8.51, z: -22 },
  { x: -6, y: 8.51, z: -24 },
  { x: 6, y: 8.51, z: -24 },
  { x: 30, y: 8.51, z: -30 },
  { x: 40, y: 8.51, z: -30 },
];

function insideShop(point: { x: number; y: number; z: number }) {
  if (point.y < 6 || point.y > 18) return false;
  return point.x >= -46 && point.x <= -25 && point.z >= -34 && point.z <= -17
    || point.x >= -14 && point.x <= 14 && point.z >= -42 && point.z <= -18
    || point.x >= 18 && point.x <= 52 && point.z >= -40 && point.z <= -10;
}

function shopIdAt(point: { x: number; y: number; z: number }) {
  if (point.y < 6 || point.y > 18) return null;
  if (point.x >= -46 && point.x <= -25 && point.z >= -34 && point.z <= -17) return 'jewelry';
  if (point.x >= -14 && point.x <= 14 && point.z >= -42 && point.z <= -18) return 'museum';
  if (point.x >= 18 && point.x <= 52 && point.z >= -40 && point.z <= -10) return 'bank';
  return null;
}
const shopAlarmAt = new WeakMap<KootaWorld, Record<string, number>>();
const playerShops = new WeakMap<KootaWorld, string | null>();
const prisonWaypoints = [
  { x: 29, y: 8.51, z: 38 },
  { x: 46, y: 8.51, z: 38 },
  { x: 46, y: 8.51, z: 46 },
  { x: 29, y: 8.51, z: 46 },
];
const botWasImprisoned = new WeakMap<KootaWorld, boolean>();

function detectedByGuard(world: KootaWorld, bot: GuardBot, player: Vector3, distance: number) {
  if (distance > 10 || Math.abs(player.y - bot.y) > 4) return false;
  const dx = player.x - bot.x;
  const dz = player.z - bot.z;
  const facing = (Math.sin(bot.yaw) * dx + Math.cos(bot.yaw) * dz) / Math.max(distance, 0.001);
  if (distance > 2.2 && facing < Math.cos(Math.PI / 3)) return false;
  const origin = new Vector3(bot.x, bot.y + 1.55, bot.z);
  const sight = new Vector3(player.x - origin.x, player.y + 0.9 - origin.y, player.z - origin.z).normalize();
  const obstruction = raycastVoxel(getBlockIndex(world), origin, sight, distance, false);
  return !obstruction || obstruction.distance >= distance - 0.6;
}

function updateHeistBot(world: KootaWorld, dt: number, current: typeof initial, player: Vector3) {
  const enabled = singleHuman() && current.role === 'thief' && current.phase !== 'finished';
  if (!enabled) {
    if (current.bot.enabled) useHeistStore.setState({ bot: { ...current.bot, enabled: false, detecting: false } });
    return;
  }
  const bot = current.bot;
  if (bot.stunnedUntil > Date.now()) {
    if (bot.detecting) useHeistStore.setState({ bot: { ...bot, enabled: true, detecting: false } });
    return;
  }
  if (bot.health <= 0) useHeistStore.setState({ bot: { ...bot, health: 5 } });
  const id = localId();
  const imprisoned = current.prison.includes(id);
  const wasImprisoned = botWasImprisoned.get(world) ?? false;
  if (imprisoned !== wasImprisoned) {
    botWasImprisoned.set(world, imprisoned);
    if (imprisoned) {
      bot.x = 38;
      bot.y = 8.51;
      bot.z = 38;
      bot.nextArrestAt = Date.now() + 2500;
    } else {
      bot.x = -35;
      bot.y = 8.51;
      bot.z = -25;
    }
    bot.waypoint = 0;
    bot.hits = 0;
  }
  const inHideout = player.x >= -50 && player.x <= -35 && player.z >= 34 && player.z <= 49;
  const distanceToPlayer = Math.hypot(player.x - bot.x, player.z - bot.z);
  const detecting = current.phase === 'running' && !inHideout && (imprisoned ? detectedByGuard(world, bot, player, distanceToPlayer) : insideShop(bot) && insideShop(player) && distanceToPlayer <= 14);
  const alarm = !imprisoned && current.alarmUntil > Date.now() ? current.alarmPosition : null;
  const chasing = (detecting || alarm !== null) && (!imprisoned || player.y >= 6);
  const waypoints = imprisoned ? prisonWaypoints : botWaypoints;
  const target = detecting ? player : alarm ?? waypoints[bot.waypoint % waypoints.length];
  const position = new Vector3(bot.x, bot.y, bot.z);
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const distance = Math.hypot(dx, dz);
  let waypoint = bot.waypoint;
  let hits = bot.hits;
  let nextArrestAt = bot.nextArrestAt;
  if (alarm) for (let x = -2; x <= 2; x += 1) for (let z = -2; z <= 2; z += 1) for (let y = 8; y <= 10; y += 1) {
    const block = getBlockIndex(world).get(voxelKey(Math.round(position.x) + x, y, Math.round(position.z) + z));
    if (block && (isDoor(block.kind) || isTrapdoor(block.kind)) && !block.open) replaceVoxel(world, { block, x: block.x, y: block.y, z: block.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, block.kind, true, undefined, undefined, undefined, undefined, undefined, undefined, true);
  }
  if (distance > 0.35) {
    const movement = Math.min(distance, (chasing ? alarm ? 9 : imprisoned ? 7.5 : 4 : 2.4) * dt);
    moveVoxelCharacter(getBlockIndex(world), position, { x: dx / distance * movement, y: 0, z: dz / distance * movement }, false);
  } else if (!chasing) {
    waypoint = (waypoint + 1) % waypoints.length;
    if (!imprisoned && (waypoint === 0 || waypoint === 2 || waypoint === 4)) {
      const next = waypoints[waypoint];
      position.set(next.x, next.y, next.z);
    }
  }
  if (chasing && distanceToPlayer <= 2 && Date.now() >= nextArrestAt) {
    hits += 1;
    nextArrestAt = Date.now() + 1500;
    if (hits >= 2) {
      hits = 0;
      nextArrestAt = Date.now() + 5000;
      if (offline()) {
        useHeistStore.setState({ carried: 0, prison: [...current.prison.filter((playerId) => playerId !== id), id] });
        receiveHeistPrison();
      } else send({ type: 'heist-bot-arrest' });
      useGameStore.getState().setNotice(translate('Le gardien bot t’a arrêté !', 'The guard bot arrested you!'));
    } else useGameStore.getState().setNotice(translate('Menottes du gardien bot · 1/2', 'Guard bot handcuffs · 1/2'));
  }
  useHeistStore.setState({ bot: { enabled: true, x: position.x, y: position.y, z: position.z, yaw: Math.atan2(dx, dz), waypoint, hits, nextArrestAt, detecting: chasing, health: bot.health, stunnedUntil: bot.stunnedUntil } });
}

export function heistControlSystem(world: KootaWorld, camera: Camera, actions: { place: number; harvest: number; tap: number; interact: number }, dt = 0.05) {
  if (useGameStore.getState().gameplayMode !== 'heist') return false;
  const state = useHeistStore.getState();
  if (!state.role && state.roleDeadline === 0) useHeistStore.setState({ roleDeadline: Date.now() + 20000 });
  if (!state.role && Date.now() >= useHeistStore.getState().roleDeadline) chooseHeistRole('thief');
  const current = useHeistStore.getState();
  if (current.alarmUntil <= Date.now()) stopHeistAlarm();
  if (current.phase === 'prep' && Date.now() >= current.endsAt) useHeistStore.setState({ phase: 'running', endsAt: Date.now() + 600000 });
  else if (current.phase === 'running' && Date.now() >= current.endsAt) useHeistStore.setState({ phase: 'finished', winner: 'guards' });
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return true;
  updateHeistBot(world, dt, current, player);
  heistLifeSystem(world, dt);
  keepGuardsOutsideHideout(world, current.role);
  preloadHeistTunnel(world);
  restoreTunnel(world);
  const pressedGrapple = isDown('KeyG');
  if (pressedGrapple && !grappleDown.get(world)) useGrapple(world, camera);
  grappleDown.set(world, pressedGrapple);
  toggleDoor(world, camera, player, actions);

  if (current.role === 'thief' && current.phase === 'running') {
    updateEntries(world, player, current.role, useGameStore.getState().selected, actions);
    const shop = shopIdAt(player);
    const previousShop = playerShops.get(world) ?? null;
    if (previousShop && previousShop !== shop) stopHeistAlarm();
    playerShops.set(world, shop);
    if (shop) {
      const alarms = shopAlarmAt.get(world) ?? {};
      if (Date.now() - (alarms[shop] ?? 0) >= 30000) {
        alarms[shop] = Date.now();
        shopAlarmAt.set(world, alarms);
        notifyHeistAlarm(player);
      }
    }
    const openingLoot = nearestLoot(player);
    const opening = openings.get(world);
    if (openingLoot) {
      if (opening?.id !== openingLoot.id && (actions.harvest > 0 || actions.interact > 0 || actions.tap > 0)) {
        const duration = openingLoot.building === 'bank' ? 15000 : openingLoot.building === 'museum' ? 5000 : 3000;
        openings.set(world, { id: openingLoot.id, since: Date.now(), duration });
        send({ type: 'heist-loot-start', id: openingLoot.id });
        if (openingLoot.building === 'bank') notifyHeistAlarm(player);
      }
      const currentOpening = openings.get(world);
      if (currentOpening && Date.now() - currentOpening.since >= currentOpening.duration) {
        collectLoot(openingLoot);
        openings.delete(world);
      } else if (currentOpening) useGameStore.getState().setNotice(translate(`Ouverture de ${openingLoot.name} · ${Math.ceil((currentOpening.duration - Date.now() + currentOpening.since) / 1000)} s`, `Opening ${openingLoot.name} · ${Math.ceil((currentOpening.duration - Date.now() + currentOpening.since) / 1000)} s`));
    } else if (opening) openings.delete(world);
    if (Math.hypot(player.x - HEIST_DEPOSIT.x, player.y - HEIST_DEPOSIT.y, player.z - HEIST_DEPOSIT.z) <= 2.5 && current.carried > 0) {
      const since = deposits.get(world) ?? Date.now();
      if (!deposits.has(world)) {
        deposits.set(world, since);
        send({ type: 'heist-deposit-start' });
      }
      if (Date.now() - since >= 2000) {
        deposit();
        deposits.delete(world);
      } else useGameStore.getState().setNotice(translate('Dépôt en cours · reste 2 secondes.', 'Depositing · stay for 2 seconds.'));
    } else deposits.delete(world);
    if (current.prison.includes(localId()) && Math.hypot(player.x - HEIST_TUNNEL_EXIT.x, player.y - HEIST_TUNNEL_EXIT.y, player.z - HEIST_TUNNEL_EXIT.z) <= 3) release();
    if (Math.abs(player.y - 9) <= 1 && Math.abs(player.x) <= 10 && [-35, -33, -31, -29].some((z) => Math.abs(player.z - z) < 0.55)) {
      if (current.alarmUntil < Date.now()) notifyHeistAlarm(player);
    }
    if (player.x >= 30 && player.x <= 40 && player.z >= -16 && player.z <= -12 && player.y >= 8 && player.y <= 11 && current.alarmUntil < Date.now()) notifyHeistAlarm(player);
    for (const trap of current.traps) {
      if (Math.hypot(player.x - trap.x, player.y - trap.y, player.z - trap.z) < 1.2) useHeistStore.setState({ slowUntil: Date.now() + 4000 });
    }
  }
  if (current.role === 'guard') {
    updateEntries(world, player, current.role, useGameStore.getState().selected, actions);
    if (actions.harvest > 0 || actions.interact > 0 || actions.tap > 0) {
      const target = nearestThief(player);
      if (target && useGameStore.getState().selected === 'handcuffs') send({ type: 'heist-arrest', targetId: target });
      if (target && useGameStore.getState().selected === 'taser' && current.taserReadyAt <= Date.now()) {
        useHeistStore.setState({ taserReadyAt: Date.now() + 20000 });
        send({ type: 'heist-taser', targetId: target });
      }
      if (useGameStore.getState().selected === 'heist_trap' && hasHeistGadget('heist_trap')) {
        useHeistStore.setState({ traps: [...current.traps.filter((trap) => Math.hypot(player.x - trap.x, player.z - trap.z) > 1), { x: Math.round(player.x), y: Math.round(player.y), z: Math.round(player.z) }] });
        consumeHeistGadget('heist_trap');
        useGameStore.getState().setNotice(translate('Bloc piège placé.', 'Trap block placed.'));
      }
    }
  }
  if (current.role === 'thief' && actions.place > 0 && useGameStore.getState().selected === 'gallery_projectiles_smoke_grenade') useSmoke(world, camera, player);
  return true;
}

export function heistMovementMultiplier() {
  const state = useHeistStore.getState();
  if (state.taserUntil > Date.now()) return 0;
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
  if (typeof data.alarmUntil === 'number' && data.alarmUntil > previous.alarmUntil && data.alarmUntil > Date.now()) playHeistAlarm();
  const role = roles[localId()] ?? previous.role;
  if (role && role !== previous.role) loadout(role, prison.includes(localId()));
  const alarmPosition = data.alarmPosition && typeof data.alarmPosition === 'object' ? data.alarmPosition as { x: number; y: number; z: number } : previous.alarmPosition;
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
    alarmUntil: typeof data.alarmUntil === 'number' ? data.alarmUntil : previous.alarmUntil,
    alarmPosition,
  });
}
export function receiveHeistPrison() {
  preloadHeistTunnel(world);
  loadout('thief', true);
  respawnAtBase(world, null, HEIST_PRISON_SPAWN);
  useGameStore.getState().setNotice(translate('Pour t’évader, creuse la terre sous ton lit avec la pioche, puis suis les égouts jusqu’au repaire. Le tunnel ne se rebouche plus pendant ton évasion.', 'To escape, dig the dirt under your bed with the pickaxe, then follow the sewers to the hideout. The tunnel will not refill during your escape.'));
}
export function receiveHeistRelease() {
  release();
}
export function receiveHeistTaser() {
  useHeistStore.setState({ taserUntil: Date.now() + 2500 });
  useGameStore.getState().setNotice(translate('Taser · immobilisé pendant 2,5 secondes.', 'Taser · immobilized for 2.5 seconds.'));
}

export function buyHeistItem(kind: Gadget, price: number) {
  const state = useHeistStore.getState();
  if (state.coins < price) {
    useGameStore.getState().setNotice(translate(`Il te manque ${price - state.coins} pièces.`, `You need ${price - state.coins} more coins.`));
    return;
  }
  const quantity = kind === BlockKind.Ladder ? 4 : kind === 'heist_trap' ? 3 : 1;
  const gadgets = { ...state.gadgets, [String(kind)]: gadgetCount(kind) + quantity };
  useHeistStore.setState({ coins: state.coins - price, gadgets });
  if (state.role) loadout(state.role);
  useGameStore.getState().setNotice(translate(`${quantity > 1 ? `${quantity} objets ajoutés` : 'Gadget ajouté'} dans ta barre rapide.`, `${quantity > 1 ? `${quantity} items added` : 'Gadget added'} to your hotbar.`));
}

export function useHeistRadar() {
  const state = useHeistStore.getState();
  if (state.role !== 'guard' || state.coins < 700) return;
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return;
  const target = nearestThief(player, Number.POSITIVE_INFINITY);
  if (!target) {
    useGameStore.getState().setNotice(translate('Aucun voleur à proximité.', 'No thief nearby.'));
    return;
  }
  const remote = useRemotePlayerStore.getState().players[target];
  useHeistStore.setState({ coins: state.coins - 700, alarmUntil: Date.now() + 5000, alarmPosition: { x: remote.x, y: remote.y, z: remote.z } });
}

export function heistMiningDuration(kind: BlockKind, selected: SelectedKind, position?: { x: number; y: number; z: number }) {
  if (selected === 'pickaxe_stone') return 0.5;
  if (kind === BlockKind.Glass) return 0.18;
  if (kind === BlockKind.TrapdoorIron) return 4;
  if (kind === BlockKind.Dirt) return (position?.y ?? 1) >= 4 ? 4 : 2;
  if (kind === BlockKind.Sand) return 2;
  if (kind === BlockKind.GrayBrick) return 3;
  return 4;
}

export function collapseHeistGravel(world: KootaWorld, position: { x: number; y: number; z: number }) {
  if (position.x < 24 || position.x > 41 || position.z < 41 || position.z > 52 || position.y >= 3) return;
  const above = getBlockIndex(world).get(voxelKey(position.x, position.y + 1, position.z));
  if (above?.kind !== BlockKind.Sand) return;
  removeVoxel(world, { block: above, x: above.x, y: above.y, z: above.z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, true);
  addVoxel(world, position.x, position.y, position.z, BlockKind.Sand, undefined, undefined, 0, undefined, undefined, false, true);
}
