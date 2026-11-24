import type { Entity, World } from 'koota';
import type { Vector3 } from 'three';
import { Animal, AnimalHealth, AnimalId, AnimalLove, AnimalMesh, AnimalMotion, AnimalRest, AnimalTame, AnimalPosition, CamelLeash, Environment, Player, PlayerMount, PlayerPosition } from './traits';
import type { AnimalKind } from './animals';
import type { SelectedKind } from './items';
import { useGameStore } from './store';
import { dismount, groundAt } from './vehicles';
import { animalHitByPlayer } from './combat';
import { changeInventory } from './inventory';
import { translate } from './language';
import { DAY_DURATION } from './dayNight';
import { playerIdentity } from './playerIdentity';

export const TAMED_ANIMAL_MONTH_DAYS = 30;

export const WILD_ANIMALS = new Set<AnimalKind>(['bear', 'wolf', 'snowWolf', 'snowBear', 'monkey', 'ocelot', 'giraffe', 'elephant', 'deer', 'snowDeer']);
export const FEED_INTERVAL_MS = 30 * 60 * 1000;
const FARM_FOOD = new Set<SelectedKind>(['corn', 'apple', 'wheat']);
const MEAT_FOOD = new Set<SelectedKind>(['raw_meat', 'cooked_meat']);
const kinds = new Set<AnimalKind>(['camel', 'cow', 'horse', 'pig', 'sheep', 'chicken', 'duck', 'bear', 'deer', 'wolf', 'snowWolf', 'snowBear', 'snowDeer', 'zombie', 'monkey', 'ocelot', 'giraffe', 'elephant']);
const names = (): Partial<Record<AnimalKind, string>> => ({ cow: translate('Vache', 'Cow'), sheep: translate('Mouton', 'Sheep'), pig: translate('Cochon', 'Pig'), horse: translate('Cheval', 'Horse'), bear: translate('Ours', 'Bear'), wolf: translate('Loup', 'Wolf'), snowWolf: translate('Loup des neiges', 'Snow Wolf'), snowBear: translate('Ours des neiges', 'Snow Bear'), camel: translate('Chameau', 'Camel'), chicken: translate('Poule', 'Chicken'), duck: translate('Canard', 'Duck'), monkey: translate('Singe', 'Monkey'), ocelot: 'Ocelot', giraffe: translate('Girafe', 'Giraffe'), elephant: translate('Éléphant', 'Elephant'), deer: translate('Cerf', 'Deer'), snowDeer: translate('Cerf des neiges', 'Snow Deer') });

export function companionAnimalName(kind: AnimalKind) {
  return names()[kind] ?? kind;
}

type TameRecord = { id: string; kind: AnimalKind; ownerId?: string; tamedAt: number; giftDay: number; baby: boolean; babyBorn: boolean; lastFedAt: number; friendship: number; stored?: boolean; x?: number; y?: number; z?: number; lastBabyMonth?: number; adultMonth?: number; sleeping?: boolean; birthRestUntil?: number };
const records = new WeakMap<World, Map<string, TameRecord>>();
const recordWorlds = new WeakMap<World, string>();
const positionSaves = new WeakMap<World, number>();

function storageKey() {
  return `louisblox-tamed-${useGameStore.getState().worldId}`;
}

function currentDay(world: World) {
  return Math.floor((world.queryFirst(Environment)?.get(Environment)?.elapsed ?? 0) / DAY_DURATION);
}

function currentMonth(world: World) {
  return Math.floor(currentDay(world) / TAMED_ANIMAL_MONTH_DAYS);
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

function restoreTamedAnimals(world: World) {
  const saved = records.get(world);
  if (!saved || saved.size === 0) return;
  void import('./animals').then(({ spawnAnimal }) => {
    for (const record of saved.values()) {
      if (record.stored) continue;
      if (world.query(Animal, AnimalId).some((entity) => entity.get(AnimalId) === record.id)) continue;
      const entity = spawnAnimal(world, record.kind, record.x ?? 0, record.y ?? 8.51, record.z ?? 0, record.tamedAt, record.id);
      if (entity && record.x !== undefined && record.y !== undefined && record.z !== undefined) entity.get(AnimalPosition)!.set(record.x, record.y, record.z);
    }
  });
}

export function initTaming(world: World) {
  const worldId = useGameStore.getState().worldId;
  if (records.has(world) && recordWorlds.get(world) === worldId) {
    restoreTamedAnimals(world);
    return;
  }
  const saved = new Map<string, TameRecord>();
  try {
    const value = JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
    if (Array.isArray(value)) {
      for (const record of value.slice(0, 512) as Array<Partial<TameRecord>>) {
        if (!record || typeof record.id !== 'string' || !kinds.has(record.kind as AnimalKind) || !Number.isFinite(record.tamedAt) || !Number.isFinite(record.giftDay)) continue;
        saved.set(record.id, {
          id: record.id,
          kind: record.kind as AnimalKind,
          ownerId: typeof record.ownerId === 'string' && record.ownerId.length > 0 && record.ownerId.length <= 80 ? record.ownerId : playerIdentity(),
          tamedAt: record.tamedAt!,
          giftDay: record.giftDay!,
          baby: record.baby === true,
          babyBorn: record.babyBorn === true,
          lastFedAt: typeof record.lastFedAt === 'number' && Number.isFinite(record.lastFedAt) && record.lastFedAt > 0 ? record.lastFedAt : Date.now(),
          friendship: friendshipLevel(record.friendship),
          stored: record.stored === true,
          lastBabyMonth: typeof record.lastBabyMonth === 'number' && Number.isSafeInteger(record.lastBabyMonth) ? record.lastBabyMonth : undefined,
          adultMonth: typeof record.adultMonth === 'number' && Number.isSafeInteger(record.adultMonth) ? record.adultMonth : undefined,
          sleeping: record.sleeping === true,
          birthRestUntil: typeof record.birthRestUntil === 'number' && Number.isFinite(record.birthRestUntil) ? record.birthRestUntil : undefined,
          x: typeof record.x === 'number' && Number.isFinite(record.x) ? record.x : undefined,
          y: typeof record.y === 'number' && Number.isFinite(record.y) ? record.y : undefined,
          z: typeof record.z === 'number' && Number.isFinite(record.z) ? record.z : undefined,
        });
      }
    }
  } catch {
  }
  records.set(world, saved);
  recordWorlds.set(world, worldId);
  restoreTamedAnimals(world);
}

export function applyTameState(world: World, entity: Entity, state?: Partial<TameRecord> & { tamed?: boolean; happiness?: number }) {
  initTaming(world);
  const id = entity.get(AnimalId);
  const kind = entity.get(Animal)?.kind;
  if (!id || !kind) return;
  const saved = records.get(world)!;
  const existing = saved.get(id);
  if (existing?.ownerId && state?.ownerId && existing.ownerId !== state.ownerId) return;
  if (existing && state?.tamed === false) return;
  if (state?.tamed === false) {
    const changed = saved.delete(id) || entity.has(AnimalTame);
    entity.remove(AnimalTame);
    if (changed) save(world);
    return;
  }
  if (!existing && !state?.tamed) return;
  const record: TameRecord = {
    id,
    kind,
    ownerId: existing?.ownerId ?? state?.ownerId,
    tamedAt: state?.tamedAt ?? existing?.tamedAt ?? currentDay(world) * 1200,
    giftDay: state?.giftDay ?? existing?.giftDay ?? currentDay(world),
    baby: state?.baby ?? existing?.baby ?? false,
    babyBorn: state?.babyBorn ?? existing?.babyBorn ?? existing?.baby ?? false,
    lastFedAt: state?.lastFedAt ?? existing?.lastFedAt ?? Date.now(),
    friendship: friendshipLevel(state?.friendship ?? existing?.friendship),
    stored: state?.stored ?? existing?.stored ?? false,
    lastBabyMonth: state?.lastBabyMonth ?? existing?.lastBabyMonth ?? Math.floor((state?.giftDay ?? existing?.giftDay ?? currentDay(world)) / TAMED_ANIMAL_MONTH_DAYS),
    adultMonth: state?.adultMonth ?? existing?.adultMonth ?? ((state?.baby ?? existing?.baby ?? false) ? Math.floor((state?.giftDay ?? existing?.giftDay ?? currentDay(world)) / TAMED_ANIMAL_MONTH_DAYS) + 1 : undefined),
    sleeping: state?.sleeping ?? existing?.sleeping ?? false,
    birthRestUntil: state?.birthRestUntil ?? existing?.birthRestUntil,
    x: existing?.x ?? entity.get(AnimalPosition)?.x,
    y: existing?.y ?? entity.get(AnimalPosition)?.y,
    z: existing?.z ?? entity.get(AnimalPosition)?.z,
  };
  const changed = !existing || (Object.keys(record) as Array<keyof TameRecord>).some((key) => record[key] !== existing[key]);
  saved.set(id, record);
  const happiness = typeof state?.happiness === 'number' && Number.isFinite(state.happiness) ? Math.max(0, Math.min(100, Math.round(state.happiness))) : Math.max(0, Math.min(100, Math.ceil(100 * (1 - (Date.now() - record.lastFedAt) / FEED_INTERVAL_MS))));
  const tame = { tamed: true, ownerId: record.ownerId ?? null, giftDay: record.giftDay, baby: record.baby, babyBorn: record.babyBorn, friendship: record.friendship, happiness, lastFedAt: record.lastFedAt };
  if (entity.has(AnimalTame)) entity.set(AnimalTame, tame);
  else entity.add(AnimalTame(tame));
  const rest = { sleeping: record.sleeping === true, birthRestUntil: record.birthRestUntil ?? null };
  if (entity.has(AnimalRest)) entity.set(AnimalRest, rest);
  else entity.add(AnimalRest(rest));
  if (changed) save(world);
}

export function isTamedAnimal(entity: Entity) {
  return entity.get(AnimalTame)?.tamed === true;
}

export function isOwnTamedAnimal(entity: Entity) {
  const tame = entity.get(AnimalTame);
  return tame?.tamed === true && tame.ownerId === playerIdentity();
}

function tameOwnershipNotice() {
  useGameStore.getState().setNotice(translate('Cet animal appartient déjà à un autre joueur.', 'This animal already belongs to another player.', 'Este animal ya pertenece a otro jugador.'));
}

export function isAnimalStored(world: World, id: string) {
  initTaming(world);
  return records.get(world)?.get(id)?.stored === true;
}

export function setAnimalStoredState(world: World, id: string, stored: boolean) {
  initTaming(world);
  const record = records.get(world)?.get(id);
  if (!record) return false;
  if (record.stored !== stored) {
    record.stored = stored;
    save(world);
  }
  if (stored) {
    for (const entity of world.query(Animal, AnimalId)) {
      if (entity.get(AnimalId) === id) entity.destroy();
    }
  }
  return true;
}

export function storedAnimals(world: World) {
  initTaming(world);
  const selfId = playerIdentity();
  return [...(records.get(world)?.values() ?? [])]
    .filter((record) => record.stored && record.ownerId === selfId)
    .map(({ id, kind, baby }) => ({ id, kind, baby }));
}

export async function storeTamedAnimal(world: World, entity: Entity) {
  initTaming(world);
  if (!isOwnTamedAnimal(entity)) {
    tameOwnershipNotice();
    return false;
  }
  const id = entity.get(AnimalId);
  const record = id ? records.get(world)?.get(id) : undefined;
  if (!id || !record) return false;
  if (world.queryFirst(Player)?.get(PlayerMount)?.vehicle === entity) dismount(world);
  const position = entity.get(AnimalPosition);
  if (position) {
    record.x = position.x;
    record.y = position.y;
    record.z = position.z;
  }
  const { reportAnimalStorage } = await import('./animalSync');
  reportAnimalStorage(entity, true);
  setAnimalStoredState(world, id, true);
  useGameStore.getState().setNotice(translate(`${companionAnimalName(record.kind)} est rangé dans ton sac.`, `${companionAnimalName(record.kind)} is stored in your backpack.`));
  return true;
}

export async function releaseStoredAnimal(world: World, id: string) {
  initTaming(world);
  const record = records.get(world)?.get(id);
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!record || !record.stored || record.ownerId !== playerIdentity() || !player) return null;
  const x = player.x + 1.25;
  const z = player.z;
  const y = groundAt(world, x, z, player.y + 4);
  record.x = x;
  record.y = y;
  record.z = z;
  setAnimalStoredState(world, id, false);
  const { spawnAnimal } = await import('./animals');
  const entity = spawnAnimal(world, record.kind, x, y, z, record.tamedAt, id);
  if (!entity) {
    setAnimalStoredState(world, id, true);
    return null;
  }
  entity.get(AnimalPosition)!.set(x, y, z);
  const { reportAnimalStorage } = await import('./animalSync');
  reportAnimalStorage(entity, false);
  useGameStore.getState().setNotice(translate(`${companionAnimalName(record.kind)} est sorti du sac.`, `${companionAnimalName(record.kind)} is out of the backpack.`));
  return entity;
}

export function companionSchedule(world: World, entity: Entity) {
  initTaming(world);
  const id = entity.get(AnimalId);
  const record = id ? records.get(world)?.get(id) : undefined;
  if (!record) return null;
  const elapsed = world.queryFirst(Environment)?.get(Environment)?.elapsed ?? 0;
  const nextBirthIn = Math.max(0, ((record.lastBabyMonth ?? currentMonth(world)) + 1) * TAMED_ANIMAL_MONTH_DAYS * DAY_DURATION - elapsed);
  const nextGiftIn = record.kind === 'cow' || record.kind === 'sheep' ? Math.max(0, (record.giftDay + 1) * DAY_DURATION - elapsed) : null;
  const growUpIn = record.baby ? Math.max(0, (record.adultMonth ?? currentMonth(world) + 1) * TAMED_ANIMAL_MONTH_DAYS * DAY_DURATION - elapsed) : null;
  return { nextBirthIn, nextGiftIn, growUpIn };
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

export function wakeTamedAnimal(world: World, entity: Entity) {
  if (!isOwnTamedAnimal(entity)) {
    tameOwnershipNotice();
    return;
  }
  const rest = entity.get(AnimalRest);
  if (rest) entity.set(AnimalRest, { sleeping: false, birthRestUntil: null });
  const record = entity.get(AnimalId) ? records.get(world)?.get(entity.get(AnimalId)!) : undefined;
  if (record) {
    record.sleeping = false;
    record.birthRestUntil = undefined;
    save(world);
  }
  const mesh = entity.get(AnimalMesh)?.value;
  if (mesh) mesh.rotation.z = 0;
}

export function canFeedAnimal(kind: AnimalKind, selected: SelectedKind) {
  return WILD_ANIMALS.has(kind) ? MEAT_FOOD.has(selected) : FARM_FOOD.has(selected);
}

export function animalFoodNotice(kind: AnimalKind) {
  return WILD_ANIMALS.has(kind)
    ? `${names()[kind] ?? translate('Cet animal', 'This animal')} eats raw or cooked meat.`
    : `${names()[kind] ?? translate('Cet animal', 'This animal')} eats corn, apples, or wheat.`;
}

export function feedAnimal(world: World, entity: Entity, selected: SelectedKind): 'fed' | 'handled' | false {
  initTaming(world);
  const kind = entity.get(Animal)?.kind;
  const id = entity.get(AnimalId);
  if (!kind || !id) return false;
  const store = useGameStore.getState();
  const existing = records.get(world)!.get(id);
  const ownerId = existing?.ownerId ?? entity.get(AnimalTame)?.ownerId;
  if ((existing || isTamedAnimal(entity)) && ownerId !== playerIdentity()) {
    tameOwnershipNotice();
    return 'handled';
  }
  if (!canFeedAnimal(kind, selected)) {
    store.setNotice(animalFoodNotice(kind));
    return 'handled';
  }
  if (!hasFood(selected)) {
    store.setNotice(translate(`Il te manque ${selected === 'apple' ? 'une pomme' : selected === 'wheat' ? 'du blé' : selected === 'corn' ? 'du maïs' : 'de la viande'} pour nourrir cet animal.`, `You need ${selected === 'apple' ? 'an apple' : selected === 'wheat' ? 'wheat' : selected === 'corn' ? 'corn' : 'meat'} to feed this animal.`));
    return 'handled';
  }
  consumeFood(selected);
  const giftDay = existing?.giftDay ?? currentDay(world);
  const record: TameRecord = {
    id,
    kind,
    ownerId: existing?.ownerId ?? playerIdentity(),
    tamedAt: existing?.tamedAt ?? giftDay * 1200,
    giftDay,
    baby: existing?.baby ?? false,
    babyBorn: existing?.babyBorn ?? false,
    lastBabyMonth: existing?.lastBabyMonth ?? currentMonth(world),
    adultMonth: existing?.adultMonth,
    lastFedAt: Date.now(),
    friendship: existing ? Math.min(5, existing.friendship + 1) : 1,
    stored: false,
  };
  records.get(world)!.set(id, record);
  const tame = { tamed: true, ownerId: record.ownerId ?? null, giftDay, baby: record.baby, babyBorn: record.babyBorn, friendship: record.friendship, happiness: 100, lastFedAt: record.lastFedAt };
  if (entity.has(AnimalTame)) entity.set(AnimalTame, tame);
  else entity.add(AnimalTame(tame));
  const love = entity.get(AnimalLove);
  if (love) entity.set(AnimalLove, { time: 2.4 });
  else entity.add(AnimalLove({ time: 2.4 }));
  entity.set(AnimalMotion, { velocityY: 5, grounded: false });
  const leash = entity.get(CamelLeash);
  if (leash) {
    leash.trader = null;
    entity.remove(CamelLeash);
  }
  save(world);
  store.setNotice(existing ? translate(`${names()[kind] ?? 'Cet animal'} est content ! Niveau d’amitié ${record.friendship}. Il restera toujours ton ami.`, `${names()[kind] ?? 'This animal'} is happy! Friendship level ${record.friendship}. It will always remain your friend.`) : translate(`${names()[kind] ?? 'Cet animal'} est apprivoisé · Niveau d’amitié 1. Il restera toujours ton ami.`, `${names()[kind] ?? 'This animal'} is tamed · Friendship level 1. It will always remain your friend.`));
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
  if (baby) applyTameState(world, baby, { id, tamed: true, ownerId: record.ownerId, tamedAt: record.tamedAt, giftDay: record.giftDay, baby: true, babyBorn: true, lastBabyMonth: record.lastBabyMonth, adultMonth: (record.lastBabyMonth ?? currentMonth(world)) + 1 });
}

export function tamingSystem(world: World, _dt: number) {
  initTaming(world);
  const today = currentDay(world);
  const month = currentMonth(world);
  const elapsed = world.queryFirst(Environment)?.get(Environment)?.elapsed ?? 0;
  const now = Date.now();
  const selfId = playerIdentity();
  let giftsChanged = false;
  let birthsChanged = false;
  let growthChanged = false;
  let restChanged = false;
  let positionsChanged = false;
  for (const entity of world.query(AnimalTame, Animal, AnimalPosition, AnimalId)) {
    const tame = entity.get(AnimalTame)!;
    const id = entity.get(AnimalId)!;
    const saved = records.get(world);
    const record = saved?.get(id);
    if (!tame.tamed || tame.ownerId !== selfId || !record) continue;
    const happiness = Math.max(0, Math.min(100, Math.ceil(100 * (1 - (now - record.lastFedAt) / FEED_INTERVAL_MS))));
    const position = entity.get(AnimalPosition)!;
    if (record.x !== position.x || record.y !== position.y || record.z !== position.z) {
      record.x = position.x;
      record.y = position.y;
      record.z = position.z;
      positionsChanged = true;
    }
    if (tame.happiness !== happiness || tame.friendship !== record.friendship || tame.lastFedAt !== record.lastFedAt) entity.set(AnimalTame, { happiness, friendship: record.friendship, lastFedAt: record.lastFedAt });
    const rest = entity.get(AnimalRest);
    if (rest?.birthRestUntil !== null && rest?.birthRestUntil !== undefined && elapsed >= rest.birthRestUntil) {
      entity.set(AnimalRest, { sleeping: false, birthRestUntil: null });
      restChanged = true;
    }
    if (rest && (record.sleeping !== rest.sleeping || record.birthRestUntil !== rest.birthRestUntil)) {
      record.sleeping = rest.sleeping;
      record.birthRestUntil = rest.birthRestUntil ?? undefined;
      restChanged = true;
    }
    if (record.baby && (record.adultMonth ?? month + 1) <= month) {
      record.baby = false;
      record.adultMonth = undefined;
      growthChanged = true;
      entity.set(AnimalTame, { baby: false });
    }
    while (record.giftDay < today) {
      record.giftDay += 1;
      const store = useGameStore.getState();
      if (record.kind === 'cow') changeInventory('milk', 1);
      if (record.kind === 'sheep') changeInventory('wool', 1);
      giftsChanged = true;
    }
    if ((record.lastBabyMonth ?? month - 1) < month) {
      record.lastBabyMonth = month;
      record.babyBorn = true;
      record.sleeping = true;
      record.birthRestUntil = elapsed + 20;
      if (rest) entity.set(AnimalRest, { sleeping: true, birthRestUntil: elapsed + 20 });
      else entity.add(AnimalRest({ sleeping: true, birthRestUntil: elapsed + 20 }));
      birthsChanged = true;
      restChanged = true;
      void spawnBaby(world, entity, record);
    }
    entity.set(AnimalTame, { giftDay: record.giftDay, babyBorn: record.babyBorn, baby: record.baby });
  }
  if (giftsChanged || birthsChanged || growthChanged || restChanged) {
    const store = useGameStore.getState();
    save(world);
    if (birthsChanged) store.setNotice(translate('Un bébé est né parmi tes animaux apprivoisés !', 'A baby was born among your tamed animals!'));
    else if (growthChanged) store.setNotice(translate('Un bébé est devenu adulte !', 'A baby has grown into an adult!'));
    else if (giftsChanged) store.setNotice(translate('Tes animaux t’ont donné du lait ou de la laine.', 'Your animals gave you milk or wool.'));
  } else if (positionsChanged && now - (positionSaves.get(world) ?? 0) >= 2000) {
    save(world);
    positionSaves.set(world, now);
  }
}

export function findDefenseTarget(world: World, defender: Entity, owner: Vector3) {
  const position = defender.get(AnimalPosition)!;
  const playerTarget = animalHitByPlayer(world);
  if (playerTarget && playerTarget !== defender && playerTarget.isAlive() && !isTamedAnimal(playerTarget) && (playerTarget.get(AnimalHealth)?.value ?? 0) > 0) {
    const targetPosition = playerTarget.get(AnimalPosition)!;
    if (position.distanceToSquared(targetPosition) < 14 * 14 && targetPosition.distanceToSquared(owner) <= 16 * 16) return playerTarget;
  }
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
