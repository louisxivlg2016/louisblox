import type { World } from 'koota';
import { Vector3 } from 'three';
import { DroppedItem, DroppedItemId, DroppedItemPosition, DroppedItemVelocity } from './traits';
import type { SelectedKind } from './items';

export type DroppedItemSnapshot = { id: string; kind: SelectedKind; x: number; y: number; z: number; vx: number; vy: number; vz: number };
type SpawnMessage = { type: 'dropped-item-spawn'; item: DroppedItemSnapshot };
type PickupMessage = { type: 'dropped-item-pickup'; id: string };
type Listener = (snapshot: DroppedItemSnapshot) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;

export function onDroppedItemSync(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setDroppedItemSocket(next: WebSocket | null) {
  socket = next;
}

export function syncDroppedItemSpawn(snapshot: DroppedItemSnapshot) {
  for (const listener of listeners) listener(snapshot);
}

export function receiveDroppedItem(world: World, data: { type?: unknown; item?: unknown; id?: unknown }) {
  if (data.type === 'dropped-item-spawn') {
    const item = data.item as DroppedItemSnapshot | undefined;
    if (!item || typeof item.id !== 'string' || typeof item.kind !== 'string' && typeof item.kind !== 'number' || !['x', 'y', 'z', 'vx', 'vy', 'vz'].every((key) => typeof item[key as keyof DroppedItemSnapshot] === 'number' && Number.isFinite(item[key as keyof DroppedItemSnapshot]))) return true;
    if (world.query(DroppedItemId).some((entity) => entity.get(DroppedItemId) === item.id)) return true;
    world.spawn(DroppedItem({ kind: item.kind, age: 0 }), DroppedItemId(item.id), DroppedItemPosition(new Vector3(item.x, item.y, item.z)), DroppedItemVelocity(new Vector3(item.vx, item.vy, item.vz)));
    return true;
  }
  if (data.type === 'dropped-item-pickup') {
    if (typeof data.id !== 'string') return true;
    for (const entity of world.query(DroppedItemId)) if (entity.get(DroppedItemId) === data.id) entity.destroy();
    return true;
  }
  return false;
}

export function sendDroppedItemSpawn(snapshot: DroppedItemSnapshot) {
  const message: SpawnMessage = { type: 'dropped-item-spawn', item: snapshot };
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function sendDroppedItemPickup(id: string) {
  const message: PickupMessage = { type: 'dropped-item-pickup', id };
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
