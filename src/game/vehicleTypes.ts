export const VEHICLE_KINDS = ['car', 'plane', 'train', 'metro', 'boat', 'jeep', 'police', 'firetruck', 'carriage', 'cannon'] as const;
export type VehicleKind = (typeof VEHICLE_KINDS)[number];
export type MountKind = VehicleKind | 'horse' | 'camel';
export type SeatRole = 'driver' | 'passenger';

export function isAnimalMount(kind: unknown): kind is 'horse' | 'camel' {
  return kind === 'horse' || kind === 'camel';
}

export function isVehicleKind(value: unknown): value is VehicleKind {
  return typeof value === 'string' && (VEHICLE_KINDS as readonly string[]).includes(value);
}

export type CabinDefinition = {
  halfWidth: number;
  floor: number;
  ceiling: number;
  front: number;
  rear: number;
  entrance: [number, number, number];
};

export const PLANE_SCALE = 10;
export const TRAIN_LENGTH = 16;
export const METRO_LENGTH = 14;
export const CABINS: Partial<Record<VehicleKind, CabinDefinition>> = {
  plane: { halfWidth: 1.2, floor: 5.5, ceiling: 8.1, front: -30, rear: -4.5, entrance: [1.4, 0, -4.5] },
  train: { halfWidth: 0.7, floor: 0.18, ceiling: 2.05, front: -7.6, rear: 7.6, entrance: [1.15, 0, 1.2] },
  metro: { halfWidth: 0.82, floor: 0.18, ceiling: 2.2, front: -6.6, rear: 6.6, entrance: [1.35, 0, 1.2] },
  carriage: { halfWidth: 1.08, floor: 1.02, ceiling: 3.2, front: -0.5, rear: 1.9, entrance: [2, 0, 1.3] },
};

export function canWalkInVehicle(kind: MountKind | null, role: SeatRole) {
  return role === 'passenger' && kind !== null && !isAnimalMount(kind) && CABINS[kind] !== undefined;
}

export function vehicleViewDistance(kind: VehicleKind) {
  if (kind === 'plane') return 100;
  if (kind === 'train') return 20;
  if (kind === 'metro') return 18;
  if (kind === 'carriage') return 10;
  return 6;
}
