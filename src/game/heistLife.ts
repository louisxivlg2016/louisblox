import { create } from 'zustand';
import type { World } from 'koota';
import { Vector3 } from 'three';
import { getBlockIndex } from './chunks';
import { spawnVehicle } from './vehicles';
import { moveVoxelCharacter } from './systems/collisionSystem';
import { Player, PlayerPosition, Vehicle, VehicleMotion, VehiclePosition } from './traits';
import { useGameStore } from './store';

export type HeistCitizen = { id: string; kind: 'pedestrian' | 'police'; outfit: 'princess' | 'explorer' | 'worker' | 'trader' | 'police'; x: number; y: number; z: number; yaw: number; waypoint: number };
type PoliceCar = { id: string; x: number; y: number; z: number; yaw: number };
const initial = () => ({
  citizens: [
    { id: 'citizen-1', kind: 'pedestrian', outfit: 'princess', x: -20, y: 7.51, z: 0, yaw: 0, waypoint: 0 },
    { id: 'citizen-2', kind: 'pedestrian', outfit: 'explorer', x: 20, y: 7.51, z: 0, yaw: 2, waypoint: 1 },
    { id: 'citizen-3', kind: 'pedestrian', outfit: 'worker', x: 0, y: 7.51, z: -20, yaw: 1, waypoint: 2 },
    { id: 'citizen-4', kind: 'pedestrian', outfit: 'trader', x: 0, y: 7.51, z: 20, yaw: 3, waypoint: 3 },
  ] as HeistCitizen[],
  policeCar: null as PoliceCar | null,
  nextPoliceAt: Date.now() + 20000,
  spawnedCars: 0,
});
export const useHeistLifeStore = create<ReturnType<typeof initial>>(() => initial());
export function clearHeistLife() {
  useHeistLifeStore.setState(initial());
}

const route = [{ x: -20, z: 0 }, { x: 20, z: 0 }, { x: 0, z: -20 }, { x: 0, z: 20 }];
const destination = { x: 35, z: -12 };

function move(world: World, citizen: HeistCitizen, target: { x: number; z: number }, dt: number, speed: number) {
  const dx = target.x - citizen.x;
  const dz = target.z - citizen.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.2) return true;
  const position = new Vector3(citizen.x, citizen.y, citizen.z);
  moveVoxelCharacter(getBlockIndex(world), position, { x: dx / distance * speed * dt, y: 0, z: dz / distance * speed * dt }, false);
  citizen.x = position.x;
  citizen.y = position.y;
  citizen.z = position.z;
  citizen.yaw = Math.atan2(dx, dz);
  return false;
}

export function heistLifeSystem(world: World, dt: number) {
  const state = useHeistLifeStore.getState();
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  if (!player) return;
  const now = Date.now();
  if (now >= state.nextPoliceAt && !state.policeCar && state.spawnedCars < 4) {
    const id = crypto.randomUUID();
    spawnVehicle(world, 'police', 48, 7.51, 3, '#315d9b', Math.PI / 2, id);
    useHeistLifeStore.setState({ policeCar: { id, x: 48, y: 7.51, z: 3, yaw: Math.PI / 2 }, nextPoliceAt: now + 20000, spawnedCars: state.spawnedCars + 1 });
  }
  const car = useHeistLifeStore.getState().policeCar;
  if (car) {
    const vehicle = world.query(Vehicle).find((entity) => entity.get(Vehicle)?.id === car.id);
    const dx = destination.x - car.x;
    const dz = destination.z - car.z;
    const distance = Math.hypot(dx, dz);
    car.yaw = Math.atan2(dx, dz);
    const step = Math.min(distance, dt * 8);
    car.x += dx / Math.max(distance, 0.001) * step;
    car.z += dz / Math.max(distance, 0.001) * step;
    if (vehicle) {
      vehicle.get(VehiclePosition)!.set(car.x, car.y, car.z);
      vehicle.set(VehicleMotion, { yaw: car.yaw, speed: distance > 0.3 ? 8 : 0 });
    }
    if (distance < 0.3) {
      useHeistLifeStore.setState((current) => ({
        policeCar: null,
        citizens: [...current.citizens,
          { id: `police-${now}-1`, kind: 'police', outfit: 'police', x: 34, y: 7.51, z: -11, yaw: 0, waypoint: 0 },
          { id: `police-${now}-2`, kind: 'police', outfit: 'police', x: 36, y: 7.51, z: -11, yaw: 0, waypoint: 0 },
        ],
      }));
    }
  }
  for (const citizen of useHeistLifeStore.getState().citizens) {
    if (citizen.kind === 'police' && Math.hypot(player.x - citizen.x, player.z - citizen.z) < 20) {
      move(world, citizen, player, dt, 3.2);
      continue;
    }
    const target = route[citizen.waypoint % route.length];
    if (move(world, citizen, target, dt, citizen.kind === 'police' ? 2 : 1.3)) citizen.waypoint = (citizen.waypoint + 1) % route.length;
  }
}
