import { create } from 'zustand';
import type { World } from 'koota';
import { Vector3 } from 'three';
import { addVoxel, getBlockIndex, removeVoxel } from './chunks';
import { BlockKind, voxelKey } from './voxel';
import { GIRL_POSITION, SURVIVOR_POSITIONS } from './zombiePlanetArena';
import { Player, PlayerPosition, PlayerState } from './traits';
import { readModeProgress, writeModeProgress } from './modeProgress';
import { moveVoxelCharacter } from './systems/collisionSystem';
import { useGameStore } from './store';
import { translate } from './language';
import { getPlanetUniverse } from './planetUniverse';
import { groundAt } from './vehicles';
import { MIN_WORLD_Y } from './levels';

type Person = { id: string; outfit: 'worker' | 'police' | 'king'; x: number; y: number; z: number; rescued: boolean };
type CityBlock = { x: number; y: number; z: number; kind: BlockKind };
type PeopleState = {
  girlRescued: boolean;
  girl: { x: number; y: number; z: number };
  survivors: Person[];
  cityBuilt: number;
};
const initial = (): PeopleState => ({ girlRescued: false, girl: { ...GIRL_POSITION }, survivors: SURVIVOR_POSITIONS.map((person) => ({ ...person, rescued: false })), cityBuilt: 0 });
export const usePlanetPeopleStore = create<PeopleState>(() => initial());
let loadedWorld = '';
let buildQueue: CityBlock[] = [];
let buildClock = 0;
export const girlPosition = new Vector3(GIRL_POSITION.x, GIRL_POSITION.y, GIRL_POSITION.z);
export const survivorPositions = new Map<string, Vector3>(SURVIVOR_POSITIONS.map((person) => [person.id, new Vector3(person.x, person.y, person.z)]));

function persist() {
  const worldId = useGameStore.getState().worldId;
  const state = usePlanetPeopleStore.getState();
  if (worldId) writeModeProgress('planet-people', worldId, {
    ...state,
    girl: { x: girlPosition.x, y: girlPosition.y, z: girlPosition.z },
    survivors: state.survivors.map((person) => {
      const position = survivorPositions.get(person.id)!;
      return { ...person, x: position.x, y: position.y, z: position.z };
    }),
  });
}

export function clearPlanetPeople() {
  loadedWorld = '';
  buildQueue = [];
  buildClock = 0;
  girlPosition.set(GIRL_POSITION.x, GIRL_POSITION.y, GIRL_POSITION.z);
  survivorPositions.forEach((position, id) => {
    const person = SURVIVOR_POSITIONS.find((entry) => entry.id === id)!;
    position.set(person.x, person.y, person.z);
  });
  usePlanetPeopleStore.setState(initial());
}

function ensurePeople() {
  const worldId = useGameStore.getState().worldId;
  if (loadedWorld === worldId) return;
  loadedWorld = worldId;
  buildQueue = [];
  buildClock = 0;
  const saved = readModeProgress('planet-people', worldId, initial());
  const savedPeople = Array.isArray(saved.survivors) ? saved.survivors : [];
  girlPosition.set(saved.girl?.x ?? GIRL_POSITION.x, saved.girl?.y ?? GIRL_POSITION.y, saved.girl?.z ?? GIRL_POSITION.z);
  const survivors = SURVIVOR_POSITIONS.map((person) => {
    const savedPerson = savedPeople.find((entry) => entry.id === person.id);
    const position = survivorPositions.get(person.id)!;
    position.set(savedPerson?.x ?? person.x, savedPerson?.y ?? person.y, savedPerson?.z ?? person.z);
    return { ...person, ...savedPerson, rescued: savedPerson?.rescued === true };
  });
  usePlanetPeopleStore.setState({
    girlRescued: saved.girlRescued === true,
    girl: { x: girlPosition.x, y: girlPosition.y, z: girlPosition.z },
    survivors,
    cityBuilt: typeof saved.cityBuilt === 'number' ? Math.max(0, Math.floor(saved.cityBuilt)) : 0,
  });
}

function clearGirlCage(world: World) {
  const blocks = getBlockIndex(world);
  for (let x = -2; x <= 2; x += 1) for (let z = -7; z <= -3; z += 1) for (let y = 8; y <= 12; y += 1) {
    const block = blocks.get(voxelKey(x, y, z));
    if (block?.kind !== BlockKind.TrapdoorIron) continue;
    removeVoxel(world, { block, x, y, z, normal: { x: 0, y: 1, z: 0 }, distance: 0 }, true);
  }
}

export function rescueGirl(world: World) {
  ensurePeople();
  clearGirlCage(world);
  if (usePlanetPeopleStore.getState().girlRescued) return;
  usePlanetPeopleStore.setState({ girlRescued: true });
  useGameStore.getState().setNotice(translate('La fille est libérée ! Elle va te suivre et construire avec toi.', 'The girl is free! She will follow you and build with you.'));
  persist();
}

export function rescueSurvivor(id: string) {
  ensurePeople();
  const state = usePlanetPeopleStore.getState();
  const person = state.survivors.find((entry) => entry.id === id);
  if (!person || person.rescued) return false;
  const survivors = state.survivors.map((entry) => entry.id === id ? { ...entry, rescued: true } : entry);
  usePlanetPeopleStore.setState({ survivors });
  const name = id === 'worker' ? 'Travailleur' : id === 'police' ? 'Policier' : 'Roi';
  useGameStore.getState().setNotice(translate(`${name} : merci ! Je te suis pour t’aider.`, `${name}: thank you! I will follow and help you.`));
  persist();
  return true;
}

function block(x: number, y: number, z: number, kind: BlockKind): CityBlock {
  return { x, y, z, kind };
}

function houseBlueprint(x: number, y: number, z: number): CityBlock[] {
  const result: CityBlock[] = [];
  for (let dx = -3; dx <= 3; dx += 1) for (let dz = -3; dz <= 3; dz += 1) {
    result.push(block(x + dx, y, z + dz, BlockKind.OakPlanks));
    result.push(block(x + dx, y + 4, z + dz, BlockKind.ConcreteRed));
    if (dx === -3 || dx === 3 || dz === -3 || dz === 3) for (let height = 1; height <= 3; height += 1) {
      if (dz === 3 && dx === 0 && height <= 2) result.push(block(x + dx, y + height, z + dz, BlockKind.DoorBrown));
      else result.push(block(x + dx, y + height, z + dz, height === 2 && (dx + dz) % 3 === 0 ? BlockKind.Glass : BlockKind.BeigeBrick));
    }
  }
  return result;
}

function roadBlueprint(x: number, y: number, z: number): CityBlock[] {
  const result: CityBlock[] = [];
  for (let dx = -6; dx <= 6; dx += 1) for (let dz = -1; dz <= 1; dz += 1) result.push(block(x + dx, y, z + dz, BlockKind.ConcreteGray));
  return result;
}

function towerBlueprint(x: number, y: number, z: number): CityBlock[] {
  const result: CityBlock[] = [];
  for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
    result.push(block(x + dx, y, z + dz, BlockKind.Stone));
    if (dx === -2 || dx === 2 || dz === -2 || dz === 2) for (let height = 1; height <= 7; height += 1) result.push(block(x + dx, y + height, z + dz, BlockKind.GrayBrick));
  }
  for (let height = 1; height <= 7; height += 1) result.push(block(x, y + height, z, BlockKind.Ladder));
  result.push(block(x, y + 8, z, BlockKind.ModernCeilingLight));
  return result;
}

function wallBlueprint(x: number, y: number, z: number): CityBlock[] {
  const result: CityBlock[] = [];
  for (let dx = -6; dx <= 6; dx += 1) for (let height = 0; height <= 2; height += 1) result.push(block(x + dx, y + height, z, BlockKind.GrayBrick));
  return result;
}

function cityBlueprint(x: number, y: number, z: number): CityBlock[] {
  return [
    ...roadBlueprint(x, y, z),
    ...roadBlueprint(x, y, z + 10),
    ...houseBlueprint(x - 8, y + 1, z - 8),
    ...houseBlueprint(x + 8, y + 1, z - 8),
    ...houseBlueprint(x - 8, y + 1, z + 8),
    ...houseBlueprint(x + 8, y + 1, z + 8),
    ...towerBlueprint(x, y + 1, z - 8),
  ];
}

export function startCityBuild(world: World, command: string) {
  ensurePeople();
  if (getPlanetUniverse() !== 'zombie') return false;
  if (!usePlanetPeopleStore.getState().girlRescued) {
    useGameStore.getState().setNotice(translate('Sauve d’abord la fille en combattant les zombies.', 'Defeat the zombies and rescue the girl first.'));
    return false;
  }
  if (buildQueue.length > 0) {
    useGameStore.getState().setNotice(translate('La construction est déjà en cours.', 'Construction is already in progress.'));
    return false;
  }
  const entity = world.queryFirst(Player);
  if (!entity) return false;
  const position = entity.get(PlayerPosition)!;
  const state = entity.get(PlayerState)!;
  const x = Math.round(position.x - Math.sin(state.yaw) * 7);
  const z = Math.round(position.z - Math.cos(state.yaw) * 7);
  const y = Math.round(groundAt(world, x, z, position.y + 4) + 0.5);
  const normalized = command.trim().toLocaleLowerCase('fr');
  const blueprint = normalized.includes('ville') || normalized.includes('city')
    ? cityBlueprint(x, y, z)
    : normalized.includes('tour') || normalized.includes('tower')
      ? towerBlueprint(x, y, z)
      : normalized.includes('route') || normalized.includes('rue') || normalized.includes('road')
        ? roadBlueprint(x, y, z)
        : normalized.includes('mur') || normalized.includes('wall') ? wallBlueprint(x, y, z) : houseBlueprint(x, y, z);
  buildQueue = blueprint;
  useGameStore.getState().setNotice(translate(`La fille commence la construction de ${blueprint.length} blocs.`, `The girl starts building ${blueprint.length} blocks.`));
  return true;
}

export function planetPeopleSystem(world: World, dt: number) {
  ensurePeople();
  const entity = world.queryFirst(Player);
  const player = entity?.get(PlayerPosition);
  const state = entity?.get(PlayerState);
  if (!player || !state) return;
  const people = usePlanetPeopleStore.getState();
  if (people.girlRescued && buildQueue.length > 0) {
    buildClock += dt;
    const helpers = people.survivors.filter((person) => person.rescued).length;
    if (buildClock >= 0.08 / (1 + helpers * 0.5)) {
      buildClock = 0;
      const next = buildQueue[0];
      const distance = Math.hypot(girlPosition.x - next.x, girlPosition.z - next.z);
      if (distance > 2) {
        movePerson(world, girlPosition, new Vector3(next.x, next.y + 0.5, next.z), dt, 8, true);
      } else {
        addVoxel(world, next.x, next.y, next.z, next.kind, undefined, undefined, 0, undefined, undefined, false, true);
        buildQueue = buildQueue.slice(1);
        usePlanetPeopleStore.setState({ cityBuilt: usePlanetPeopleStore.getState().cityBuilt + 1 });
        persist();
        if (buildQueue.length === 0) useGameStore.getState().setNotice(translate('Construction terminée !', 'Construction complete!'));
      }
    }
  } else if (people.girlRescued) {
    const target = new Vector3(player.x + Math.sin(state.yaw) * 2, player.y, player.z + Math.cos(state.yaw) * 2);
    movePerson(world, girlPosition, target, dt, 4);
  }
  for (const [index, survivor] of people.survivors.entries()) {
    if (!survivor.rescued) continue;
    const target = new Vector3(player.x + Math.sin(state.yaw) * (3 + index), player.y, player.z + Math.cos(state.yaw) * (3 + index));
    movePerson(world, survivorPositions.get(survivor.id)!, target, dt, 4);
  }
}

function movePerson(world: World, person: Vector3, target: Vector3, dt: number, speed: number, building = false) {
  const dx = target.x - person.x;
  const dz = target.z - person.z;
  const distance = Math.hypot(dx, dz);
  if (distance > 0.25) {
    const movement = Math.min(distance, speed * dt);
    const step = { x: dx / distance * movement, y: 0, z: dz / distance * movement };
    if (building) {
      person.x += step.x;
      person.z += step.z;
    } else moveVoxelCharacter(getBlockIndex(world), person, step, true);
  }
  const ground = groundAt(world, person.x, person.z, person.y + 2.05);
  if (ground > MIN_WORLD_Y + 1) person.y = ground + 0.01;
}
