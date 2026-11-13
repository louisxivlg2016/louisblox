import type { PlayerSnapshot } from './multiplayer';
import type { SeatRole } from './vehicleTypes';

export function animalSeatOffset(kind: 'horse' | 'camel', role: SeatRole, yaw: number): [number, number, number] {
  const forward = role === 'passenger' ? -0.65 : 0.3;
  return [-Math.sin(yaw) * forward, kind === 'camel' ? 1.4 : 1, -Math.cos(yaw) * forward];
}

export function mountSnapshotsById(players: Record<string, PlayerSnapshot>) {
  const mounts = new Map<string, { snapshot: NonNullable<PlayerSnapshot['horse']>; kind: 'horse' | 'camel'; role: SeatRole; hasDriver: boolean; hasPassenger: boolean }>();
  for (const state of Object.values(players)) {
    if (!state.horse) continue;
    const role = state.mountRole ?? 'driver';
    const existing = mounts.get(state.horse.id);
    if (existing && role === 'passenger') {
      existing.hasPassenger = true;
      continue;
    }
    mounts.set(state.horse.id, {
      snapshot: state.horse,
      kind: state.vehicleKind === 'camel' ? 'camel' : 'horse',
      role,
      hasDriver: role === 'driver' || existing?.hasDriver === true,
      hasPassenger: role === 'passenger' || existing?.hasPassenger === true,
    });
  }
  return mounts;
}
