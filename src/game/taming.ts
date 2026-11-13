import type { Entity, World } from 'koota';
import type { Vector3 } from 'three';
import { Animal, AnimalHealth, AnimalId, AnimalLove, AnimalTame, AnimalPosition, CamelLeash, Environment } from './traits';
import type { AnimalKind } from './animals';
import type { SelectedKind } from './items';
import { useGameStore } from './store';
import { groundAt } from './vehicles';
import { changeInventory } from './inventory';

export const WILD_ANIMALS = new Set<AnimalKind>(['bear', 'wolf', 'snowWolf', 'snowBear', 'monkey', 'ocelot', 'giraffe', 'elephant', 'deer', 'snowDeer']);
export const FEED_INTERVAL_MS = 30 * 60 * 1000;
const FARM_FOOD = new Set<SelectedKind>(['corn', 'apple', 'wheat']);
const MEAT_FOOD = new Set<SelectedKind>(['raw_meat', 'cooked_meat']);
const kinds = new Set<AnimalKind>(['camel', 'cow', 'horse', 'pig', 'sheep', 'chicken', 'duck', 'bear', 'deer', 'wolf', 'snowWolf', 'snowBear', 'snowDeer', 'zombie', 'monkey', 'ocelot', 'giraffe', 'elephant']);
const names: Partial<Record<AnimalKind, string>> = { cow: 'Vache', sheep: 'Mouton', pig: 'Cochon', horse: 'Cheval', bear: 'Ours', wolf: 'Loup', snowWolf: 'Loup des neiges', snowBear: 'Ours des neiges', camel: 'Chameau', chicken: 'Poule', duck: 'Canard', monkey: 'Singe', ocelot: 'Ocelot', giraffe: 'Girafe', elephant: 'Éléphant', deer: 'Cerf', snowDeer: 'Cerf des neiges' };

type TameRecord = { id: string; kind: AnimalKind; tamedAt: number; giftDay: number; baby: boolean; babyBorn: boolean; lastFedAt: number; friendship: number };
const records = new WeakMap<World, Map<string, TameRecord>>();
const recordWorlds = new WeakMap<World, string>();

function storageKey() {
  return `louisblox-tamed-${useGameStore.getState().worldId}`;
}

function currentDay(world: World) {
  return Math.floor((world.queryFirst(Environment)?.get(Environment)?.elapsed ?? 0) / 1200);
}

function friendshipLevel(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.min(5, Math.floor(value))) : 1;
}

function save(world: World) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify([...(records.get(world)?.values() ?? [])]));
  } catch {
  }
}

export function initTaming(world: World) {
  const worldId = useGameStore.getState().worldId;
  if (records.has(world) && recordWorlds.get(world) === worldId) return;
  const saved = new Map<string, TameRecord>();
  try {
    const value = JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
    if (Array.isArray(value)) {
      for (const record of value.slice(0, 512) as Array<Partial<TameRecord>>) {
        if (!record || typeof record.id !== 'string' || !kinds.has(record.kind as AnimalKind) || !Number.isFinite(record.tamedAt) || !Number.isFinite(record.giftDay)) continue;
        saved.set(record.id, {
          id: record.id,
          kind: record.kind as AnimalKind,
          tamedAt: record.tamedAt!,
          giftDay: record.giftDay!,
          baby: record.baby === true,
          babyBorn: record.babyBorn === true,
          lastFedAt: typeof record.lastFedAt === 'number' && Number.isFinite(record.lastFedAt) && record.lastFedAt > 0 ? record.lastFedAt : Date.now(),
          friendship: friendshipLevel(record.friendship),
        });
      }
    }
  } catch {
  }
  records.set(world, saved);
  recordWorlds.set(world, worldId);
}

export function applyTameState(world: World, entity: Entity, state?: Partial<TameRecord> & { tamed?: boolean; happiness?: number }) {
  initTaming(world);
  const id = entity.get(AnimalId);
  const kind = entity.get(Animal)?.kind;
  if (!id || !kind) return;
  const saved = records.get(world)!;
  if (state?.tamed === false) {
    const changed = saved.delete(id) || entity.has(AnimalTame);
    entity.remove(AnimalTame);
    if (changed) save(world);
    return;
  }
  const existing = saved.get(id);
  if (!existing && !state?.tamed) return;
  const record: TameRecord = {
    id,
    kind,
    tamedAt: state?.tamedAt ?? existing?.tamedAt ?? currentDay(world) * 1200,
    giftDay: state?.giftDay ?? existing?.giftDay ?? currentDay(world),
    baby: state?.baby ?? existing?.baby ?? false,
    babyBorn: state?.babyBorn ?? existing?.babyBorn ?? existing?.baby ?? false,
    lastFedAt: state?.lastFedAt ?? existing?.lastFedAt ?? Date.now(),
    friendship: friendshipLevel(state?.friendship ?? existing?.friendship),
  };
  const changed = !existing || (Object.keys(record) as Array<keyof TameRecord>).some((key) => record[key] !== existing[key]);
  saved.set(id, record);
  const happiness = typeof state?.happiness === 'number' && Number.isFinite(state.happiness) ? Math.max(0, Math.min(100, Math.round(state.happiness))) : Math.max(0, Math.min(100, Math.ceil(100 * (1 - (Date.now() - record.lastFedAt) / FEED_INTERVAL_MS))));
  const tame = { tamed: true, giftDay: record.giftDay, baby: record.baby, babyBorn: record.babyBorn, friendship: record.friendship, happiness, lastFedAt: record.lastFedAt };
  if (entity.has(AnimalTame)) entity.set(AnimalTame, tame);
  else entity.add(AnimalTame(tame));
  if (changed) save(world);
}

export function isTamedAnimal(entity: Entity) {
  return entity.get(AnimalTame)?.tamed === true;
}

function hasFood(selected: SelectedKind) {
  const store = useGameStore.getState();
  if (store.gameplayMode !== 'survival') return true;
  return selected === 'apple' ? store.apples > 0 : (store.itemCounts[selected] ?? 0) > 0;
}

function consumeFood(selected: SelectedKind) {
  const store = useGameStore.getState();
  if (store.gameplayMode !== 'survival' || typeof selected === 'number') return;
  if (selected === 'apple') store.discardApple();
  else store.setItemCount(selected, (store.itemCounts[selected] ?? 0) - 1);
}

export function canFeedAnimal(kind: AnimalKind, selected: SelectedKind) {
  return WILD_ANIMALS.has(kind) ? MEAT_FOOD.has(selected) : FARM_FOOD.has(selected);
}

export function animalFoodNotice(kind: AnimalKind) {
  return WILD_ANIMALS.has(kind)
    ? `${names[kind] ?? 'Cet animal'} mange de la viande crue ou cuite.`
    : `${names[kind] ?? 'Cet animal'} mange du maïs, des pommes ou du blé.`;
}

export function feedAnimal(world: World, entity: Entity, selected: SelectedKind): 'fed' | 'handled' | false {
  initTaming(world);
  const kind = entity.get(Animal)?.kind;
  const id = entity.get(AnimalId);
  if (!kind || !id) return false;
  const store = useGameStore.getState();
  if (!canFeedAnimal(kind, selected)) {
    store.setNotice(animalFoodNotice(kind));
    return 'handled';
  }
  if (!hasFood(selected)) {
    store.setNotice(`Il te manque ${selected === 'apple' ? 'une pomme' : selected === 'wheat' ? 'du blé' : selected === 'corn' ? 'du maïs' : 'de la viande'} pour nourrir cet animal.`);
    return 'handled';
  }
  consumeFood(selected);
  const existing = records.get(world)!.get(id);
  const giftDay = existing?.giftDay ?? currentDay(world);
  const record: TameRecord = {
    id,
    kind,
    tamedAt: existing?.tamedAt ?? giftDay * 1200,
    giftDay,
    baby: existing?.baby ?? false,
    babyBorn: existing?.babyBorn ?? false,
    lastFedAt: Date.now(),
    friendship: existing ? Math.min(5, existing.friendship + 1) : 1,
  };
  records.get(world)!.set(id, record);
  const tame = { tamed: true, giftDay, baby: record.baby, babyBorn: record.babyBorn, friendship: record.friendship, happiness: 100, lastFedAt: record.lastFedAt };
  if (entity.has(AnimalTame)) entity.set(AnimalTame, tame);
  else entity.add(AnimalTame(tame));
  const love = entity.get(AnimalLove);
  if (love) entity.set(AnimalLove, { time: 2.4 });
  else entity.add(AnimalLove({ time: 2.4 }));
  const leash = entity.get(CamelLeash);
  if (leash) {
    leash.trader = null;
    entity.remove(CamelLeash);
  }
  save(world);
  store.setNotice(existing ? `${names[kind] ?? 'Cet animal'} est content ! Amitié niveau ${record.friendship} · Prochain repas dans 30 minutes.` : `${names[kind] ?? 'Cet animal'} est apprivoisé · Amitié niveau 1. Nourris-le au moins toutes les 30 minutes.`);
  return 'fed';
}

async function spawnBaby(world: World, parent: Entity, record: TameRecord) {
  const { spawnAnimal } = await import('./animals');
  if (!parent.isAlive()) return;
  const position = parent.get(AnimalPosition);
  const parentId = parent.get(AnimalId);
  if (!position || !parentId) return;
  const x = position.x + 1.2;
  const z = position.z + 1.2;
  const id = `baby:${parentId}:${record.giftDay}`;
  const baby = spawnAnimal(world, record.kind, x, groundAt(world, x, z, position.y + 4), z, record.giftDay + record.tamedAt, id);
  if (baby) applyTameState(world, baby, { id, tamed: true, tamedAt: record.tamedAt, giftDay: record.giftDay, baby: true, babyBorn: true });
}

export function tamingSystem(world: World, _dt: number) {
  initTaming(world);
  const today = currentDay(world);
  const now = Date.now();
  let giftsChanged = false;
  let hungerChanged = false;
  for (const entity of world.query(AnimalTame, Animal, AnimalPosition, AnimalId)) {
    const tame = entity.get(AnimalTame)!;
    const id = entity.get(AnimalId)!;
    const saved = records.get(world);
    const record = saved?.get(id);
    if (!tame.tamed || !record) continue;
    if (now - record.lastFedAt >= FEED_INTERVAL_MS) {
      saved!.delete(id);
      entity.remove(AnimalTame);
      entity.remove(AnimalLove);
      hungerChanged = true;
      continue;
    }
    const happiness = Math.max(0, Math.min(100, Math.ceil(100 * (1 - (now - record.lastFedAt) / FEED_INTERVAL_MS))));
    if (tame.happiness !== happiness || tame.friendship !== record.friendship || tame.lastFedAt !== record.lastFedAt) entity.set(AnimalTame, { happiness, friendship: record.friendship, lastFedAt: record.lastFedAt });
    if (record.giftDay >= today) continue;
    while (record.giftDay < today) {
      record.giftDay += 1;
      const store = useGameStore.getState();
      if (record.kind === 'cow') changeInventory('milk', 1);
      if (record.kind === 'sheep') changeInventory('wool', 1);
      if (!record.babyBorn) {
        record.babyBorn = true;
        void spawnBaby(world, entity, record);
      }
      giftsChanged = true;
    }
    entity.set(AnimalTame, { giftDay: record.giftDay, babyBorn: record.babyBorn });
  }
  if (giftsChanged || hungerChanged) {
    const store = useGameStore.getState();
    save(world);
    if (hungerChanged) store.setNotice('Un animal n’a pas mangé pendant 30 minutes : il n’est plus ton ami. Donne-lui à manger pour le retrouver.');
    else store.setNotice('Tes animaux t’ont donné du lait, de la laine ou un bébé.');
  }
}

export function findDefenseTarget(world: World, defender: Entity, owner: Vector3) {
  const position = defender.get(AnimalPosition)!;
  let best: Entity | null = null;
  let closest = 14 * 14;
  for (const candidate of world.query(Animal, AnimalPosition, AnimalHealth)) {
    if (candidate === defender || isTamedAnimal(candidate) || candidate.get(AnimalHealth)!.value <= 0) continue;
    const kind = candidate.get(Animal)!.kind;
    if (!['bear', 'wolf', 'snowWolf', 'snowBear', 'zombie'].includes(kind)) continue;
    const targetPosition = candidate.get(AnimalPosition)!;
    const distanceSquared = position.distanceToSquared(targetPosition);
    if (distanceSquared >= closest || targetPosition.distanceToSquared(owner) > 16 * 16) continue;
    best = candidate;
    closest = distanceSquared;
  }
  return best;
}
