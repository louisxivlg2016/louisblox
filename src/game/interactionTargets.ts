import type { Entity, World } from 'koota';
import { Box3, Ray, Vector3 } from 'three';
import type { Camera, Object3D } from 'three';
import { getBlockIndex } from './chunks';
import { raycastVoxel } from './voxel';
import { Animal, AnimalMesh, Player, PlayerPosition, Trader, TraderMesh, Vehicle, VehicleMesh } from './traits';

export type InteractionTarget = { entity: Entity; kind: 'trader' | 'vehicle' | 'horse'; distance: number };

export function findInteractionTarget(world: World, camera: Camera, interaction: 'trade' | 'mount'): InteractionTarget | null {
  const position = world.queryFirst(Player)?.get(PlayerPosition);
  if (!position) return null;
  const origin = position.clone();
  origin.y += 1.62;
  const direction = camera.getWorldDirection(new Vector3()).normalize();
  const ray = new Ray(origin, direction);
  const obstruction = raycastVoxel(getBlockIndex(world), origin, direction, interaction === 'mount' ? 12 : 6);
  const bounds = new Box3();
  const point = new Vector3();
  let closest = Infinity;
  let result: InteractionTarget | null = null;

  function inspect(entity: Entity, kind: InteractionTarget['kind'], mesh: Object3D | null, reach: number) {
    if (!mesh?.visible) return;
    mesh.updateWorldMatrix(true, true);
    bounds.setFromObject(mesh);
    if (bounds.isEmpty() || !ray.intersectBox(bounds, point)) return;
    const distance = point.distanceTo(origin);
    if (distance > reach || distance >= closest || (obstruction && distance > obstruction.distance + 0.08)) return;
    closest = distance;
    result = { entity, kind, distance };
  }

  if (interaction === 'trade') {
    for (const entity of world.query(Trader, TraderMesh)) inspect(entity, 'trader', entity.get(TraderMesh)!.value, 6);
  } else {
    for (const entity of world.query(Vehicle, VehicleMesh)) inspect(entity, 'vehicle', entity.get(VehicleMesh)!.value, entity.get(Vehicle)?.kind === 'plane' ? 12 : 6);
    for (const entity of world.query(Animal, AnimalMesh)) {
      if (entity.get(Animal)!.kind === 'horse') inspect(entity, 'horse', entity.get(AnimalMesh)!.value, 6);
    }
  }
  return result;
}
