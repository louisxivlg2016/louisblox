import type { Entity, World } from 'koota';
import { AnimalId, CamelLeash, ChunkData, Player, PlayerMount, Trader } from './traits';
import { useGameStore } from './store';
import { dismount } from './vehicles';
import { useTradeStore } from './trading';

const deadAnimals = new Set<string>();
const deadTraders = new Set<string>();
let deathWorldId: string | null = null;
let socket: WebSocket | null = null;

export function isDeathId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 80;
}

function scope() {
  const worldId = useGameStore.getState().worldId;
  if (worldId === deathWorldId) return;
  deathWorldId = worldId;
  deadAnimals.clear();
  deadTraders.clear();
}

export function setDeathSocket(next: WebSocket | null) {
  socket = next;
}

export function isAnimalDead(id: string) {
  scope();
  return deadAnimals.has(id);
}

export function isTraderDead(x: number, z: number) {
  scope();
  return deadTraders.has(`${x}:${z}`);
}

function reportDeath(type: 'animal-death' | 'trader-death', id: string, deaths: Set<string>) {
  scope();
  if (!isDeathId(id) || deaths.has(id)) return;
  deaths.add(id);
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, id, worldId: useGameStore.getState().worldId }));
}

export function reportAnimalDeath(entity: Entity) {
  reportDeath('animal-death', entity.get(AnimalId) ?? '', deadAnimals);
}

export function reportTraderDeath(entity: Entity) {
  const trader = entity.get(Trader);
  if (trader) reportDeath('trader-death', `${trader.homeX}:${trader.homeZ}`, deadTraders);
}

export function applyAnimalDeath(world: World, id: string) {
  scope();
  if (isDeathId(id)) deadAnimals.add(id);
  const localMount = world.queryFirst(Player)?.get(PlayerMount)?.vehicle;
  for (const entity of [...world.query(AnimalId)]) {
    if (entity.get(AnimalId) !== id) continue;
    if (entity === localMount) dismount(world);
    for (const chunkEntity of world.query(ChunkData)) {
      const data = chunkEntity.get(ChunkData)!;
      data.animals = data.animals.filter((animal) => animal !== entity);
    }
    entity.destroy();
  }
}

export function applyTraderDeath(world: World, id: string) {
  scope();
  if (isDeathId(id)) deadTraders.add(id);
  for (const entity of [...world.query(Trader)]) {
    const trader = entity.get(Trader)!;
    if (`${trader.homeX}:${trader.homeZ}` !== id) continue;
    for (const camel of world.query(CamelLeash)) {
      const leash = camel.get(CamelLeash)!;
      if (leash.trader !== entity) continue;
      leash.trader = null;
      camel.remove(CamelLeash);
    }
    for (const chunkEntity of world.query(ChunkData)) {
      const data = chunkEntity.get(ChunkData)!;
      data.animals = data.animals.filter((animal) => animal !== entity);
    }
    useTradeStore.setState((current) => current.traderId === entity ? { open: false, following: false, traderId: null, restaurantAvailable: false } : {});
    entity.destroy();
  }
}

export function applyDeathSnapshot(world: World, animals: unknown, traders: unknown) {
  if (Array.isArray(animals)) for (const id of animals) if (isDeathId(id)) applyAnimalDeath(world, id);
  if (Array.isArray(traders)) for (const id of traders) if (isDeathId(id)) applyTraderDeath(world, id);
}
