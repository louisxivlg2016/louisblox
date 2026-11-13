import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Material, Mesh } from 'three';
import { facingYaw, stairSource } from '../game/extraBlocks';
import { blockGeometry, blockMaterials } from '../game/textures';
import { Player, PlayerState } from '../game/traits';
import { BlockKind } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import { world } from '../game/world';

export function StairModel({ kind, facing = 'south', upsideDown = false, followPlayer = false, position = [0, 0, 0], materials, renderOrder }: {
  kind: BlockKind;
  facing?: Voxel['facing'];
  upsideDown?: boolean;
  followPlayer?: boolean;
  position?: [number, number, number];
  materials?: Material[];
  renderOrder?: number;
}) {
  const group = useRef<Group>(null);
  const lower = useRef<Mesh>(null);
  const upper = useRef<Mesh>(null);
  const source = (stairSource(kind) ?? BlockKind.OakPlanks) as BlockKind;
  const shared = { material: materials ?? blockMaterials[source], geometry: blockGeometry, renderOrder, frustumCulled: renderOrder === undefined };
  useFrame(() => {
    if (!followPlayer || !group.current) return;
    const state = world.queryFirst(Player)?.get(PlayerState);
    if (!state) return;
    const inverted = state.pitch > 0.15;
    if (lower.current) lower.current.position.y = inverted ? 0.25 : -0.25;
    if (upper.current) upper.current.position.y = inverted ? -0.25 : 0.25;
  });
  return (
    <group ref={group} name="stair-block" userData={{ kind, facing, upsideDown }} position={position} rotation={[0, facingYaw(facing), 0]}>
      <mesh ref={lower} name="stair-lower-step" {...shared} position={[0, upsideDown ? 0.25 : -0.25, 0]} scale={[1, 0.5, 1]} />
      <mesh ref={upper} name="stair-upper-step" {...shared} position={[0, upsideDown ? -0.25 : 0.25, -0.25]} scale={[1, 0.5, 0.5]} />
    </group>
  );
}
