import type { World } from 'koota';
import { Raycaster, Vector3 } from 'three';
import type { Camera } from 'three';
import { isMouseButtonDown, stopMining } from '../input';
import { useGameStore } from '../store';
import { Player, PlayerMount, PlayerPosition, Vehicle, VehicleHealth, VehicleMesh, VehiclePosition } from '../traits';
import { destroyVehicle } from '../vehicleSync';
import type { VehicleKind } from '../vehicleTypes';

const origin = new Vector3();
const direction = new Vector3();
const offset = new Vector3();
const cooldowns = new WeakMap<World, number>();

export function vehicleCombatSystem(world: World, camera: Camera, dt: number, touchTaps = 0) {
  const cooldown = Math.max(0, (cooldowns.get(world) ?? 0) - dt);
  cooldowns.set(world, cooldown);
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  if (!player || (touchTaps === 0 && !isMouseButtonDown(0))) return false;
  origin.copy(player);
  origin.y += 1.62;
  camera.getWorldDirection(direction);
  const mounted = playerEntity?.get(PlayerMount)?.vehicle;
  let target: { entity: import('koota').Entity; kind: VehicleKind; id: string; health: number } | null = null;
  let closest = 12;
  const raycaster = new Raycaster(origin, direction);

  for (const entity of world.query(Vehicle, VehiclePosition, VehicleHealth, VehicleMesh)) {
    if (entity === mounted) continue;
    const vehicle = entity.get(Vehicle)!;
    const position = entity.get(VehiclePosition)!;
    const maxDistance = vehicle.kind === 'car' ? 5.5 : vehicle.kind === 'plane' ? 12 : 8;
    const mesh = entity.get(VehicleMesh)?.value;
    let distance: number | undefined;
    if (mesh?.visible) {
      mesh.updateWorldMatrix(true, true);
      raycaster.far = Math.min(maxDistance, closest);
      distance = raycaster.intersectObject(mesh, true)[0]?.distance;
    }
    if (distance === undefined) {
      const height = vehicle.kind === 'car' ? 1.1 : vehicle.kind === 'plane' ? 2 : vehicle.kind === 'boat' ? 0.55 : 1.5;
      const radius = vehicle.kind === 'car' ? 1.8 : vehicle.kind === 'plane' ? 42 : vehicle.kind === 'boat' ? 1.8 : 3.5;
      offset.set(position.x, position.y + height, position.z).sub(origin);
      const centerDistance = offset.dot(direction);
      if (centerDistance < 0 || offset.lengthSq() - centerDistance * centerDistance > radius * radius) continue;
      distance = centerDistance;
    }
    if (distance >= closest || distance > maxDistance) continue;
    closest = distance;
    target = { entity, kind: vehicle.kind, id: vehicle.id, health: entity.get(VehicleHealth)!.value };
  }
  if (!target) return false;
  if (cooldown > 0) return true;

  cooldowns.set(world, 0.35);
  stopMining();
  const remaining = target.health - 1;
  const name = target.kind === 'car' ? 'Voiture' : target.kind === 'plane' ? 'Avion' : target.kind === 'boat' ? 'Bateau' : 'Train';
  if (remaining > 0) {
    target.entity.set(VehicleHealth, { value: remaining });
    useGameStore.getState().setNotice(`${name} : encore ${remaining} coup${remaining > 1 ? 's' : ''}.`);
  } else {
    destroyVehicle(world, target.id);
    useGameStore.getState().setNotice(`${name} détruit.`);
  }
  return true;
}
