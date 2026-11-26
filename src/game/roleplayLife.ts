import { create } from 'zustand';
import type { World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex } from './chunks';
import { groundAt } from './vehicles';
import { moveVoxelCharacter } from './systems/collisionSystem';
import { isNight } from './dayNight';
import { Fire, Player, PlayerPosition } from './traits';
import { addVoxel } from './chunks';
import { BlockKind } from './voxel';
import { selectionInfo } from './items';
import { releasePointerForOverlay } from './input';
import { useGameStore } from './store';
import { earnRoleplayCoins, useRoleplayStore } from './roleplayClient';
import { translate } from './language';

export type RoleplayNpc = {
  id: string;
  kind: 'customer' | 'pedestrian' | 'thief';
  outfit: 'trader' | 'worker' | 'police' | 'king' | 'princess' | 'explorer' | 'pirate';
  x: number;
  y: number;
  z: number;
  waypoint: number;
  action: 'walking' | 'shopping' | 'waiting' | 'leaving' | 'stealing' | 'attacking';
  wait: number;
};

type Stock = { apple: number; bread: number; ironOre: number; diamondOre: number };
const initialStock = (): Stock => ({ apple: 12, bread: 8, ironOre: 6, diamondOre: 2 });
const initialNpcs = (): RoleplayNpc[] => [
  { id: 'customer-1', kind: 'customer', outfit: 'princess', x: 0, y: 8.51, z: -4, waypoint: 0, action: 'shopping', wait: 0 },
  { id: 'customer-2', kind: 'customer', outfit: 'worker', x: -8, y: 8.51, z: -8, waypoint: 0, action: 'shopping', wait: 0 },
  { id: 'walker-1', kind: 'pedestrian', outfit: 'explorer', x: -12, y: 8.51, z: -16, waypoint: 0, action: 'walking', wait: 0 },
  { id: 'walker-2', kind: 'pedestrian', outfit: 'king', x: 12, y: 8.51, z: -16, waypoint: 1, action: 'walking', wait: 0 },
  { id: 'walker-3', kind: 'pedestrian', outfit: 'police', x: -8, y: 8.51, z: -24, waypoint: 2, action: 'walking', wait: 0 },
  { id: 'walker-4', kind: 'pedestrian', outfit: 'worker', x: 8, y: 8.51, z: -24, waypoint: 3, action: 'walking', wait: 0 },
];
const initial = () => ({ npcs: initialNpcs(), stock: initialStock(), sales: 0, arrests: 0, activeCustomerId: null as string | null, nextThiefAt: 0, nextFireAt: Date.now() + 8000, restockAt: Date.now() + 30000 });
export const useRoleplayLifeStore = create<ReturnType<typeof initial>>(() => initial());
let loadedWorld = '';
let noticeAt = 0;

const MARKET = { x: 0, y: 8.51, z: -16 };
const WALK_ROUTE = [
  { x: -16, z: -20 },
  { x: 16, z: -20 },
  { x: 16, z: -16 },
  { x: -16, z: -16 },
];

export function clearRoleplayLife() {
  loadedWorld = '';
  useRoleplayLifeStore.setState(initial());
}

function notice(fr: string, en: string) {
  if (Date.now() - noticeAt < 4000) return;
  noticeAt = Date.now();
  useGameStore.getState().setNotice(translate(fr, en));
}

function move(world: World, npc: RoleplayNpc, target: { x: number; z: number }, dt: number, speed: number) {
  const dx = target.x - npc.x;
  const dz = target.z - npc.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.2) return true;
  const step = Math.min(distance, speed * dt);
  const position = new Vector3(npc.x, npc.y, npc.z);
  moveVoxelCharacter(getBlockIndex(world), position, { x: dx / distance * step, y: 0, z: dz / distance * step }, false);
  const ground = groundAt(world, position.x, position.z, position.y + 0.49);
  npc.x = position.x;
  npc.z = position.z;
  npc.y = ground + 0.01;
  return false;
}

const FIRE_POINTS = [{ x: -8, z: -8 }, { x: 8, z: -8 }, { x: 0, z: 8 }];

export function scheduleNextRoleplayFire() {
  useRoleplayLifeStore.setState({ nextFireAt: Date.now() + 20000 });
}

function updateFires(world: World) {
  const state = useRoleplayLifeStore.getState();
  if (useRoleplayStore.getState().job !== 'firefighter' || Date.now() < state.nextFireAt || world.query(Fire).length > 0) return;
  const point = FIRE_POINTS[Math.floor(Date.now() / 20000) % FIRE_POINTS.length];
  addVoxel(world, point.x, 8, point.z, BlockKind.Wildfire);
  scheduleNextRoleplayFire();
  notice('Incendie signalé ! Prends ton extincteur et va éteindre les flammes.', 'Fire reported! Take your extinguisher and put out the flames.');
}

function spawnThief() {
  const npc: RoleplayNpc = { id: `thief-${Date.now()}`, kind: 'thief', outfit: 'pirate', x: 0, y: 8.51, z: -6, waypoint: 0, action: 'stealing', wait: 0 };
  useRoleplayLifeStore.setState((state) => ({ npcs: [...state.npcs, npc], nextThiefAt: Date.now() + 25000 }));
  notice('Un voleur tente de voler le marché !', 'A thief is trying to rob the market!');
}

export function arrestRoleplayThief() {
  const player = gameWorldPlayer();
  if (!player) return false;
  const state = useRoleplayLifeStore.getState();
  const thief = state.npcs.find((npc) => npc.kind === 'thief' && Math.hypot(player.x - npc.x, player.y - npc.y, player.z - npc.z) <= 3);
  if (!thief) return false;
  useRoleplayLifeStore.setState({ npcs: state.npcs.filter((npc) => npc.id !== thief.id), arrests: state.arrests + 1, nextThiefAt: Date.now() + 25000 });
  earnRoleplayCoins(50);
  useGameStore.getState().setNotice(translate('Voleur arrêté avant qu’il ne blesse quelqu’un · +50 pièces.', 'Thief arrested before anyone was hurt · +50 coins.'));
  return true;
}

export function roleplayCustomerRequest() {
  const stock = useRoleplayLifeStore.getState().stock;
  const item: keyof Stock | null = stock.diamondOre > 0 ? 'diamondOre' : stock.ironOre > 0 ? 'ironOre' : stock.bread > 0 ? 'bread' : stock.apple > 0 ? 'apple' : null;
  if (!item) return null;
  const selection = item === 'apple' ? 'apple' : item === 'bread' ? 'bread' : item === 'ironOre' ? BlockKind.IronOre : BlockKind.DiamondOre;
  const price = item === 'diamondOre' ? 25 : item === 'ironOre' ? 8 : item === 'bread' ? 5 : 3;
  return { item, name: selectionInfo(selection).name, price };
}

export function talkRoleplayCustomer() {
  const player = gameWorldPlayer();
  if (!player) return false;
  const customer = useRoleplayLifeStore.getState().npcs.find((npc) => npc.kind === 'customer' && npc.action === 'waiting' && Math.hypot(player.x - npc.x, player.y - npc.y, player.z - npc.z) <= 4);
  if (!customer || !roleplayCustomerRequest()) return false;
  useRoleplayLifeStore.setState({ activeCustomerId: customer.id });
  useGameStore.getState().setMode('pause');
  releasePointerForOverlay();
  return true;
}

export function closeRoleplayCustomer() {
  useRoleplayLifeStore.setState({ activeCustomerId: null });
}

export function serveRoleplayCustomer() {
  const state = useRoleplayLifeStore.getState();
  const customer = state.npcs.find((npc) => npc.id === state.activeCustomerId && npc.action === 'waiting');
  const request = roleplayCustomerRequest();
  if (!customer || !request) return false;
  useRoleplayLifeStore.setState({ activeCustomerId: null, stock: { ...state.stock, [request.item]: state.stock[request.item] - 1 }, sales: state.sales + 1 });
  customer.action = 'leaving';
  customer.wait = 2;
  earnRoleplayCoins(request.price);
  useGameStore.getState().setNotice(translate(`Le client paie ${request.price} pièces pour ${request.name}. Merci !`, `The customer pays ${request.price} coins for ${request.name}. Thank you!`));
  return true;
}

let worldForPlayer: World;
function gameWorldPlayer() {
  return worldForPlayer.queryFirst(Player)?.get(PlayerPosition);
}

export function roleplayLifeSystem(world: World, dt: number) {
  if (loadedWorld !== useGameStore.getState().worldId) {
    loadedWorld = useGameStore.getState().worldId;
    useRoleplayLifeStore.setState(initial());
  }
  worldForPlayer = world;
  const game = useGameStore.getState();
  const state = useRoleplayLifeStore.getState();
  const player = gameWorldPlayer();
  if (!player) return;
  const night = isNight(world);
  if (night && !state.npcs.some((npc) => npc.kind === 'thief') && Date.now() >= state.nextThiefAt) spawnThief();
  if (!night && state.npcs.some((npc) => npc.kind === 'thief')) useRoleplayLifeStore.setState({ npcs: state.npcs.filter((npc) => npc.kind !== 'thief') });
  if (Date.now() >= state.restockAt) useRoleplayLifeStore.setState({ stock: initialStock(), restockAt: Date.now() + 30000 });
  updateFires(world);

  for (const npc of useRoleplayLifeStore.getState().npcs) {
    if (npc.kind === 'customer' && useRoleplayStore.getState().job !== 'merchant') {
      npc.action = 'walking';
      const target = WALK_ROUTE[npc.waypoint % WALK_ROUTE.length];
      if (move(world, npc, target, dt, 1.5)) npc.waypoint = (npc.waypoint + 1) % WALK_ROUTE.length;
      continue;
    }
    if (npc.kind === 'customer') {
      if (npc.action === 'leaving') {
        if (move(world, npc, { x: npc.id === 'customer-1' ? 0 : -8, z: npc.id === 'customer-1' ? -4 : -8 }, dt, 2)) {
          npc.action = 'shopping';
          npc.wait = 8;
        }
        continue;
      }
      if (npc.action === 'waiting') continue;
      if (npc.wait > 0) {
        npc.wait -= dt;
        continue;
      }
      const arrived = move(world, npc, MARKET, dt, 2.2);
      if (!arrived) continue;
      npc.action = 'waiting';
      notice('Un client attend au stand. Approche-toi et appuie sur E pour lui parler.', 'A customer is waiting at the stand. Come closer and press E to talk to them.');
      continue;
    }
    if (npc.kind === 'thief') {
      if (npc.action === 'stealing') {
        if (move(world, npc, MARKET, dt, 2.4)) {
          npc.wait += dt;
          if (npc.wait >= 3) {
            npc.action = 'attacking';
            npc.wait = 0;
            notice('Le voleur attaque un passant ! Arrête-le avec les menottes !', 'The thief is attacking a pedestrian! Arrest them with handcuffs!');
          }
        }
        continue;
      }
      const pedestrians = useRoleplayLifeStore.getState().npcs.filter((entry) => entry.kind !== 'thief').sort((a, b) => Math.hypot(a.x - npc.x, a.z - npc.z) - Math.hypot(b.x - npc.x, b.z - npc.z));
      const target = pedestrians[0];
      if (!target) continue;
      if (move(world, npc, target, dt, 3)) {
        npc.wait += dt;
        if (npc.wait >= 4) {
          useRoleplayLifeStore.setState((current) => ({ npcs: current.npcs.filter((entry) => entry.id !== target.id) }));
          npc.action = 'stealing';
          npc.wait = 0;
          notice('Un passant a été blessé. Arrête le voleur avant le prochain !', 'A pedestrian was hurt. Arrest the thief before the next one!');
        }
      }
      continue;
    }
    const target = WALK_ROUTE[npc.waypoint % WALK_ROUTE.length];
    if (move(world, npc, target, dt, 1.5)) npc.waypoint = (npc.waypoint + 1) % WALK_ROUTE.length;
  }
}
