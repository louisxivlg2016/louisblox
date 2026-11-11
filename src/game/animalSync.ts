import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { Animal, AnimalHealth, AnimalId, AnimalMesh, AnimalMotion, AnimalPosition, CamelLeash, Fish, FishId, FishMesh, FishMotion, FishPosition, HorseRider, Player, PlayerMount, PlayerPosition } from './traits';
import { spawnAnimal } from './animals';
import type { AnimalKind } from './animals';
import { spawnFish } from './fish';
import type { FishKind } from './fish';
import { useMultiplayerStore } from './multiplayerStore';
import { playerIdentity } from './playerIdentity';
import { turnToward } from './rotation';

export type AnimalSnapshot = { id: string; kind: AnimalKind; x: number; y: number; z: number; yaw: number; health: number; speed: number; running?: boolean };
export type FishSnapshot = { id: string; kind: FishKind; x: number; y: number; z: number; yaw: number; age: number; phase: number; speed: number };

const animalKinds = new Set<AnimalKind>(['camel', 'cow', 'horse', 'pig', 'sheep', 'chicken', 'duck', 'bear', 'deer', 'wolf', 'snowWolf', 'snowBear', 'snowDeer', 'zombie', 'monkey', 'ocelot', 'giraffe', 'elephant']);
const fishKinds = new Set<FishKind>(['salmon', 'clownfish', 'blueTang']);
const clocks = new Map<World, number>();
const animalInterpolations = new WeakMap<World, Map<Entity, { from: Vector3; to: Vector3; yawTo: number; elapsed: number }>>();
const fishInterpolations = new WeakMap<World, Map<Entity, { from: Vector3; to: Vector3; yawTo: number; elapsed: number }>>();
const initializedAnimals = new Set<Entity>();
const initializedFish = new Set<Entity>();
let socket: WebSocket | null = null;

export function setAnimalSocket(next: WebSocket | null) {
  socket = next;
}

export function isAnimalAuthority() {
  const state = useMultiplayerStore.getState();
  if (!state.enabled) return true;
  if (state.status !== 'online') return false;
  const authority = state.players.length > 0 ? state.players.map((player) => player.playerId).sort()[0] : playerIdentity();
  return authority === playerIdentity();
}

export function isAnimalSnapshot(value: unknown): value is AnimalSnapshot {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.id === 'string' && data.id.length > 0 && data.id.length <= 80 && animalKinds.has(data.kind as AnimalKind)
    && ['x', 'y', 'z', 'yaw', 'health', 'speed'].every((key) => typeof data[key] === 'number' && Number.isFinite(data[key]))
    && (data.running === undefined || typeof data.running === 'boolean');
}

export function isFishSnapshot(value: unknown): value is FishSnapshot {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.id === 'string' && data.id.length > 0 && data.id.length <= 80 && fishKinds.has(data.kind as FishKind)
    && ['x', 'y', 'z', 'yaw', 'age', 'phase', 'speed'].every((key) => typeof data[key] === 'number' && Number.isFinite(data[key]));
}

function interpolationFor(world: World, fish = false) {
  const source = fish ? fishInterpolations : animalInterpolations;
  let entries = source.get(world);
  if (!entries) {
    entries = new Map();
    source.set(world, entries);
  }
  return entries;
}

export function applyAnimalSnapshots(world: World, snapshots: AnimalSnapshot[]) {
  const seen = new Set<string>();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const localMount = world.queryFirst(Player)?.get(PlayerMount)?.vehicle;
  const interpolations = interpolationFor(world);
  for (const snapshot of snapshots) {
    if (!isAnimalSnapshot(snapshot)) continue;
    seen.add(snapshot.id);
    let entity = world.query(Animal, AnimalId).find((candidate) => candidate.get(AnimalId) === snapshot.id);
    if (entity?.get(CamelLeash) || entity === localMount) continue;
    if (!entity) entity = spawnAnimal(world, snapshot.kind, snapshot.x, snapshot.y, snapshot.z, 0);
    entity.set(AnimalId, snapshot.id);
    const position = entity.get(AnimalPosition)!;
    if (!initializedAnimals.has(entity)) {
      position.set(snapshot.x, snapshot.y, snapshot.z);
      initializedAnimals.add(entity);
    }
    interpolations.set(entity, { from: position.clone(), to: new Vector3(snapshot.x, snapshot.y, snapshot.z), yawTo: snapshot.yaw, elapsed: 0 });
    entity.set(AnimalMotion, { yaw: snapshot.yaw, speed: snapshot.speed, running: snapshot.running ?? false });
    if (snapshot.health <= 0) {
      interpolations.delete(entity);
      entity.destroy();
      continue;
    }
    if (entity.get(AnimalHealth)?.value !== snapshot.health) entity.set(AnimalHealth, { value: snapshot.health });
    const mesh = entity.get(AnimalMesh)?.value;
    if (mesh) mesh.visible = !player || position.distanceToSquared(player) < 40 * 40;
  }
  for (const entity of world.query(Animal, AnimalId)) {
    const id = entity.get(AnimalId);
    if (seen.has(id ?? '') || entity === localMount || entity.get(CamelLeash) || entity.get(HorseRider)?.mounted || entity.get(HorseRider)?.passenger) continue;
    interpolations.delete(entity);
    entity.destroy();
  }
}

export function applyFishSnapshots(world: World, snapshots: FishSnapshot[]) {
  const seen = new Set<string>();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const interpolations = interpolationFor(world, true);
  for (const snapshot of snapshots) {
    if (!isFishSnapshot(snapshot)) continue;
    seen.add(snapshot.id);
    let entity = world.query(Fish, FishId).find((candidate) => candidate.get(FishId) === snapshot.id);
    if (!entity) entity = spawnFish(world, snapshot.kind, snapshot.x, snapshot.y, snapshot.z, 0);
    entity.set(FishId, snapshot.id);
    const position = entity.get(FishPosition)!;
    if (!initializedFish.has(entity)) {
      position.set(snapshot.x, snapshot.y, snapshot.z);
      initializedFish.add(entity);
    }
    interpolations.set(entity, { from: position.clone(), to: new Vector3(snapshot.x, snapshot.y, snapshot.z), yawTo: snapshot.yaw, elapsed: 0 });
    entity.set(FishMotion, { yaw: snapshot.yaw, age: snapshot.age, phase: snapshot.phase, speed: snapshot.speed });
    const mesh = entity.get(FishMesh)?.value;
    if (mesh) mesh.visible = !player || position.distanceToSquared(player) < 40 * 40;
  }
  for (const entity of world.query(Fish, FishId)) {
    if (seen.has(entity.get(FishId) ?? '')) continue;
    interpolations.delete(entity);
    entity.destroy();
  }
}

export function interpolateAnimalMovement(world: World, dt: number) {
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const animals = animalInterpolations.get(world);
  if (animals) {
    for (const [entity, interpolation] of animals) {
      if (!entity.isAlive()) {
        animals.delete(entity);
        continue;
      }
      interpolation.elapsed += dt;
      const position = entity.get(AnimalPosition)!;
      position.lerpVectors(interpolation.from, interpolation.to, Math.min(1, interpolation.elapsed / 0.2));
      const motion = entity.get(AnimalMotion);
      if (motion) motion.displayYaw = turnToward(motion.displayYaw, interpolation.yawTo, dt * 12);
      const mesh = entity.get(AnimalMesh)?.value;
      if (mesh) {
        mesh.position.copy(position);
        mesh.rotation.y = motion?.displayYaw ?? interpolation.yawTo;
        mesh.visible = !player || position.distanceToSquared(player) < 40 * 40;
      }
      if (interpolation.elapsed >= 0.2) animals.delete(entity);
    }
  }
  const fish = fishInterpolations.get(world);
  if (!fish) return;
  for (const [entity, interpolation] of fish) {
    if (!entity.isAlive()) {
      fish.delete(entity);
      continue;
    }
    interpolation.elapsed += dt;
    const position = entity.get(FishPosition)!;
    position.lerpVectors(interpolation.from, interpolation.to, Math.min(1, interpolation.elapsed / 0.2));
    const motion = entity.get(FishMotion);
    if (motion) motion.yaw = turnToward(motion.yaw, interpolation.yawTo, dt * 12);
    const mesh = entity.get(FishMesh)?.value;
    if (mesh) {
      mesh.position.copy(position);
      mesh.rotation.y = motion?.yaw ?? interpolation.yawTo;
      mesh.visible = !player || position.distanceToSquared(player) < 40 * 40;
    }
    if (interpolation.elapsed >= 0.2) fish.delete(entity);
  }
}

export function syncAnimalState(world: World, dt: number) {
  const remaining = (clocks.get(world) ?? 0) - dt;
  if (remaining > 0) {
    clocks.set(world, remaining);
    return;
  }
  clocks.set(world, 0.2);
  if (!socket || socket.readyState !== WebSocket.OPEN || !isAnimalAuthority()) return;
  const animals = world.query(Animal, AnimalId, AnimalPosition, AnimalMotion, AnimalHealth).flatMap((entity) => {
    if (entity.get(CamelLeash) || entity.get(HorseRider)?.mounted || entity.get(HorseRider)?.passenger) return [];
    const position = entity.get(AnimalPosition)!;
    const motion = entity.get(AnimalMotion)!;
    return [{ id: entity.get(AnimalId), kind: entity.get(Animal)!.kind, x: position.x, y: position.y, z: position.z, yaw: motion.displayYaw, health: entity.get(AnimalHealth)!.value, speed: motion.speed, running: motion.running }];
  });
  const fish = world.query(Fish, FishId, FishPosition, FishMotion).map((entity) => {
    const position = entity.get(FishPosition)!;
    const motion = entity.get(FishMotion)!;
    return { id: entity.get(FishId), kind: entity.get(Fish)!.kind, x: position.x, y: position.y, z: position.z, yaw: motion.yaw, age: motion.age, phase: motion.phase, speed: motion.speed };
  });
  if (animals.length > 0) socket.send(JSON.stringify({ type: 'animal-state', animals }));
  if (fish.length > 0) socket.send(JSON.stringify({ type: 'fish-state', fish }));
}
