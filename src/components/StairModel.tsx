import type { Material } from 'three';
import { facingYaw, stairSource } from '../game/extraBlocks';
import { blockGeometry, blockMaterials } from '../game/textures';
import { BlockKind } from '../game/voxel';
import type { Voxel } from '../game/voxel';

export function StairModel({ kind, facing = 'south', position = [0, 0, 0], materials, renderOrder }: {
  kind: BlockKind;
  facing?: Voxel['facing'];
  position?: [number, number, number];
  materials?: Material[];
  renderOrder?: number;
}) {
  const source = (stairSource(kind) ?? BlockKind.OakPlanks) as BlockKind;
  const shared = { material: materials ?? blockMaterials[source], geometry: blockGeometry, renderOrder, frustumCulled: renderOrder === undefined };
  return (
    <group name="stair-block" userData={{ kind, facing }} position={position} rotation={[0, facingYaw(facing), 0]}>
      <mesh name="stair-lower-step" {...shared} position={[0, -0.25, 0]} scale={[1, 0.5, 1]} />
      <mesh name="stair-upper-step" {...shared} position={[0, 0.25, -0.25]} scale={[1, 0.5, 0.5]} />
    </group>
  );
}
