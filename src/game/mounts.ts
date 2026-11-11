import type { PlayerSnapshot } from './multiplayer';
import type { SeatRole } from './vehicleTypes';

export function animalSeatOffset(kind: 'horse' | 'camel', role: SeatRole, yaw: number): [number, number, number] {
  const forward = kind === 'camel' && role === 'passenger' ? -0.65 : 0.3;
  return [Math.sin(yaw) * forward, kind === 'camel' ? 1.4 : 1, Math.cos(yaw) * forward];
}

export function mountSnapshotsById(players: Record<string, PlayerSnapshot>) {
  const mounts = new Map<string, { snapshot: NonNullable<PlayerSnapshot['horse']>; kind: 'horse' | 'camel'; role: SeatRole }>();
  for (const state of Object.values(players)) {
    if (!state.horse) continue;
    const role = state.mountRole ?? 'driver';
    if (!mounts.has(state.horse.id) || role === 'driver') {
      mounts.set(state.horse.id, { snapshot: state.horse, kind: state.vehicleKind === 'camel' ? 'camel' : 'horse', role });
    }
  }
  return mounts;
}
