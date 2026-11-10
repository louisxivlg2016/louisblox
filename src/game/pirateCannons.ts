import { spawnVehicle } from './vehicles';
import { Vehicle } from './traits';
import type { World } from 'koota';

export function spawnPirateCannons(world: World) {
  for (const team of ['red', 'blue'] as const) {
    const center = team === 'red' ? -16 : 16;
    for (const side of [-1, 1]) {
      for (const [index, z] of [-6, 0, 6].entries()) {
        const id: `${string}-${string}-${string}-${string}-${string}` = `pirate-cannon-${team}-${side === -1 ? 'port' : 'starboard'}-${index}`;
        if (world.query(Vehicle).some((entity) => entity.get(Vehicle)?.id === id)) continue;
        spawnVehicle(world, 'cannon', center + side * 4, 9.5, z, team === 'red' ? '#c93d35' : '#4567b5', side === 1 ? -Math.PI / 2 : Math.PI / 2, id);
      }
    }
  }
}
