import type { Entity, World } from 'koota';
import { Vector3 } from 'three';
import { Player, PlayerMount, Vehicle, VehicleHealth, VehicleMesh, VehicleMotion, VehiclePosition } from './traits';
import { dismount } from './vehicles';

export type VehicleSnapshot = {
  id: string;
  kind: 'car' | 'plane' | 'train' | 'boat';
  color: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  driver?: boolean;
};
export type VehicleSyncMessage =
  | { type: 'vehicle-spawn' | 'vehicle-state'; vehicle: VehicleSnapshot }
  | { type: 'vehicle-remove'; vehicleId: string };

export function isVehicleSnapshot(value: unknown): value is VehicleSnapshot {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.id === 'string' && data.id.length > 0 && data.id.length <= 80
    && (data.kind === 'car' || data.kind === 'plane' || data.kind === 'train' || data.kind === 'boat')
    && typeof data.color === 'string' && data.color.length <= 32
    && ['x', 'y', 'z', 'yaw'].every((key) => typeof data[key] === 'number' && Number.isFinite(data[key]))
    && (data.driver === undefined || typeof data.driver === 'boolean');
}

type Listener = (message: VehicleSyncMessage) => void;
type SyncState = { time: number; last: Map<string, string> };

const listeners = new WeakMap<World, Set<Listener>>();
const states = new WeakMap<World, SyncState>();
const applying = new WeakMap<World, boolean>();

export function onVehicleSync(world: World, listener: Listener) {
  let worldListeners = listeners.get(world);
  if (!worldListeners) {
    worldListeners = new Set();
    listeners.set(world, worldListeners);
  }
  worldListeners.add(listener);
  return () => worldListeners.delete(listener);
}

function emit(world: World, message: VehicleSyncMessage) {
  if (applying.get(world)) return;
  for (const listener of listeners.get(world) ?? []) listener(message);
}

function stateFor(world: World) {
  let state = states.get(world);
  if (!state) {
    state = { time: 0, last: new Map() };
    states.set(world, state);
  }
  return state;
}

function snapshotFromEntity(entity: Entity): VehicleSnapshot | null {
  const vehicle = entity.get(Vehicle);
  const position = entity.get(VehiclePosition);
  const motion = entity.get(VehicleMotion);
  if (!vehicle?.id || !position || !motion) return null;
  return { id: vehicle.id, kind: vehicle.kind, color: vehicle.color, x: position.x, y: position.y, z: position.z, yaw: motion.yaw, driver: motion.mounted };
}

function motionKey(snapshot: VehicleSnapshot) {
  return `${snapshot.x.toFixed(2)},${snapshot.y.toFixed(2)},${snapshot.z.toFixed(2)},${snapshot.yaw.toFixed(3)},${snapshot.driver === true}`;
}

export function syncVehicleSpawn(world: World, entity: Entity) {
  const snapshot = snapshotFromEntity(entity);
  if (!snapshot) return;
  stateFor(world).last.set(snapshot.id, motionKey(snapshot));
  emit(world, { type: 'vehicle-spawn', vehicle: snapshot });
}

export function syncVehicleMotion(world: World, entity: Entity, force = false) {
  const snapshot = snapshotFromEntity(entity);
  if (!snapshot || applying.get(world)) return;
  const state = stateFor(world);
  const now = performance.now();
  if (!force && now - state.time < 50) return;
  const key = motionKey(snapshot);
  const heartbeat = entity.get(VehicleMotion)?.mounted && now - state.time >= 1000;
  if (!force && state.last.get(snapshot.id) === key && !heartbeat) return;
  state.time = now;
  state.last.set(snapshot.id, key);
  emit(world, { type: 'vehicle-state', vehicle: snapshot });
}

export function applyVehicleSnapshot(world: World, snapshot: VehicleSnapshot) {
  applying.set(world, true);
  try {
    const duplicates = world.query(Vehicle).filter((candidate) => candidate.get(Vehicle)?.id === snapshot.id);
    const mount = world.queryFirst(Player)?.get(PlayerMount);
    const mounted = mount?.vehicle;
    let entity = duplicates.find((candidate) => candidate === mounted) ?? duplicates[0];
    for (const duplicate of duplicates) {
      if (duplicate !== entity) duplicate.destroy();
    }
    if (!entity) {
      entity = world.spawn(
        Vehicle({ id: snapshot.id, kind: snapshot.kind, color: snapshot.color }),
        VehiclePosition(new Vector3(snapshot.x, snapshot.y, snapshot.z)),
        VehicleMotion({ yaw: snapshot.yaw, mounted: snapshot.driver === true, homeX: snapshot.x, homeY: snapshot.y, homeZ: snapshot.z, homeYaw: snapshot.yaw }),
        VehicleMesh(),
        VehicleHealth(),
      );
    } else {
      entity.set(Vehicle, { kind: snapshot.kind, color: snapshot.color });
      entity.get(VehiclePosition)?.set(snapshot.x, snapshot.y, snapshot.z);
      entity.set(VehicleMotion, { yaw: snapshot.yaw, mounted: mounted === entity && mount?.role === 'driver' ? true : snapshot.driver === true });
    }
    stateFor(world).last.set(snapshot.id, motionKey(snapshot));
  } finally {
    applying.set(world, false);
  }
}

export function applyVehicleRemoval(world: World, vehicleId: string) {
  applying.set(world, true);
  try {
    const entities = world.query(Vehicle).filter((candidate) => candidate.get(Vehicle)?.id === vehicleId);
    stateFor(world).last.delete(vehicleId);
    if (entities.length === 0) return false;
    const player = world.queryFirst(Player);
    const mounted = player?.get(PlayerMount)?.vehicle;
    for (const entity of entities) {
      if (mounted === entity) dismount(world);
      entity.destroy();
    }
    return true;
  } finally {
    applying.set(world, false);
  }
}

export function destroyVehicle(world: World, vehicleId: string) {
  if (applyVehicleRemoval(world, vehicleId)) emit(world, { type: 'vehicle-remove', vehicleId });
}
