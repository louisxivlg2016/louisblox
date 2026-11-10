import type { Entity, World } from 'koota';
import { Box3, DoubleSide, Mesh, Raycaster, Vector3 } from 'three';
import type { Camera, Object3D } from 'three';
import { getBlockIndex } from './chunks';
import { raycastVoxel } from './voxel';
import { Animal, AnimalMesh, Player, PlayerPosition, Trader, TraderMesh, Vehicle, VehicleMesh } from './traits';

export type InteractionTarget = { entity: Entity; kind: 'trader' | 'vehicle' | 'horse' | 'camel'; distance: number };

export function findInteractionTarget(world: World, camera: Camera, interaction: 'trade' | 'mount'): InteractionTarget | null {
  const position = world.queryFirst(Player)?.get(PlayerPosition);
  if (!position) return null;
  const origin = position.clone();
  origin.y += 1.62;
  const direction = camera.getWorldDirection(new Vector3()).normalize();
  const obstruction = raycastVoxel(getBlockIndex(world), origin, direction, interaction === 'mount' ? 12 : 6);
  const raycaster = new Raycaster(origin, direction);
  let closest = Infinity;
  let result: InteractionTarget | null = null;

  function inspect(entity: Entity, kind: InteractionTarget['kind'], mesh: Object3D | null, reach: number) {
    if (!mesh?.visible) return;
    mesh.updateWorldMatrix(true, true);
    raycaster.far = Math.min(reach, closest, obstruction?.distance ?? reach);
    const sides = new Map<import('three').Material, import('three').Side>();
    mesh.traverse((object) => {
      if (object.type === 'Sprite') {
        object.raycast = () => {};
        return;
      }
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        sides.set(material, material.side);
        material.side = DoubleSide;
      }
    });
    try {
      const hit = raycaster.intersectObject(mesh, true)[0];
      if (hit) {
        closest = hit.distance;
        result = { entity, kind, distance: hit.distance };
      } else if (kind === 'trader') {
        const center = new Box3().setFromObject(mesh).getCenter(new Vector3());
        const offset = center.sub(origin);
        const forward = offset.dot(direction);
        if (forward > 0 && forward <= raycaster.far && offset.lengthSq() - forward * forward <= 1.75 ** 2) {
          const distance = offset.length();
          closest = distance;
          result = { entity, kind, distance };
        }
      }
    } finally {
      for (const [material, side] of sides) material.side = side;
    }
  }

  if (interaction === 'trade') {
    for (const entity of world.query(Trader, TraderMesh)) inspect(entity, 'trader', entity.get(TraderMesh)!.value, 6);
  } else {
    for (const entity of world.query(Vehicle, VehicleMesh)) inspect(entity, 'vehicle', entity.get(VehicleMesh)!.value, entity.get(Vehicle)?.kind === 'plane' ? 12 : 6);
    for (const entity of world.query(Animal, AnimalMesh)) {
      const kind = entity.get(Animal)!.kind;
      if (kind === 'horse' || kind === 'camel') inspect(entity, kind, entity.get(AnimalMesh)!.value, 6);
    }
  }
  return result;
}
