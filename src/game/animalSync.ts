import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { Animal, AnimalHealth, AnimalId, AnimalMesh, AnimalMotion, AnimalPosition, CamelLeash, Fish, FishId, FishMesh, FishMotion, FishPosition, HorseRider, Player, PlayerMount, PlayerPosition } from './traits';
import { spawnAnimal } from './animals';
import type { AnimalKind } from './animals';
import { spawnFish } from './fish';
import type { FishKind } from './fish';
import { useMultiplayerStore } from './multiplayerStore';
import { playerIdentity } from './playerIdentity';

export type AnimalSnapshot = { id: string; kind: AnimalKind; x: number; y: number; z: number; yaw: number; health: number; speed: number; running?: boolean };
export type FishSnapshot = { id: string; kind: FishKind; x: number; y: number; z: number; yaw: number; age: number; phase: number; speed: number };

const animalKinds = new Set<AnimalKind>(['camel', 'cow', 'horse', 'pig', 'sheep', 'chicken', 'duck', 'bear', 'deer', 'wolf', 'snowWolf', 'snowBear', 'snowDeer', 'zombie']);
const fishKinds = new Set<FishKind>(['salmon', 'clownfish', 'blueTang']);
const clocks = new Map<World, number>();
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

export function applyAnimalSnapshots(world: World, snapshots: AnimalSnapshot[]) {
  const seen = new Set<string>();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const localMount = world.queryFirst(Player)?.get(PlayerMount)?.vehicle;
  for (const snapshot of snapshots) {
    if (!isAnimalSnapshot(snapshot)) continue;
    seen.add(snapshot.id);
    let entity = world.query(Animal, AnimalId).find((candidate) => candidate.get(AnimalId) === snapshot.id);
    if (entity?.get(CamelLeash) || entity === localMount) continue;
    if (!entity) entity = spawnAnimal(world, snapshot.kind, snapshot.x, snapshot.y, snapshot.z, 0);
    entity.set(AnimalId, snapshot.id);
    entity.get(AnimalPosition)!.set(snapshot.x, snapshot.y, snapshot.z);
    entity.set(AnimalMotion, { yaw: snapshot.yaw, displayYaw: snapshot.yaw, speed: snapshot.speed, running: snapshot.running ?? false });
    if (snapshot.health <= 0) {
      entity.destroy();
      continue;
    }
    if (entity.get(AnimalHealth)?.value !== snapshot.health) entity.set(AnimalHealth, { value: snapshot.health });
    const mesh = entity.get(AnimalMesh)?.value;
    if (mesh) {
      mesh.position.copy(entity.get(AnimalPosition)!);
      mesh.rotation.y = snapshot.yaw;
      mesh.visible = !player || mesh.position.distanceToSquared(player) < 40 * 40;
    }
  }
  for (const entity of world.query(Animal, AnimalId)) {
    const id = entity.get(AnimalId);
    if (seen.has(id ?? '') || entity === localMount || entity.get(CamelLeash) || entity.get(HorseRider)?.mounted) continue;
    entity.destroy();
  }
}

export function applyFishSnapshots(world: World, snapshots: FishSnapshot[]) {
  const seen = new Set<string>();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  for (const snapshot of snapshots) {
    if (!isFishSnapshot(snapshot)) continue;
    seen.add(snapshot.id);
    let entity = world.query(Fish, FishId).find((candidate) => candidate.get(FishId) === snapshot.id);
    if (!entity) entity = spawnFish(world, snapshot.kind, snapshot.x, snapshot.y, snapshot.z, 0);
    entity.set(FishId, snapshot.id);
    entity.get(FishPosition)!.set(snapshot.x, snapshot.y, snapshot.z);
    entity.set(FishMotion, { yaw: snapshot.yaw, age: snapshot.age, phase: snapshot.phase, speed: snapshot.speed });
    const mesh = entity.get(FishMesh)?.value;
    if (mesh) {
      mesh.position.copy(entity.get(FishPosition)!);
      mesh.rotation.y = snapshot.yaw;
      mesh.visible = !player || mesh.position.distanceToSquared(player) < 40 * 40;
    }
  }
  for (const entity of world.query(Fish, FishId)) {
    if (!seen.has(entity.get(FishId) ?? '')) entity.destroy();
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
    if (entity.get(CamelLeash) || entity.get(HorseRider)?.mounted) return [];
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
