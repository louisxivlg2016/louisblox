import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Material } from 'three';
import { slabSource } from '../game/extraBlocks';
import { blockGeometry, blockMaterials } from '../game/textures';
import { Player, PlayerState } from '../game/traits';
import { BlockKind } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import { world } from '../game/world';

export function SlabModel({ kind, facing = 'north', growth = 0, followPlayer = false, position = [0, 0, 0], materials }: {
  kind: BlockKind;
  facing?: Voxel['facing'];
  growth?: number;
  followPlayer?: boolean;
  position?: [number, number, number];
  materials?: Material[];
}) {
  const group = useRef<Group>(null);
  const source = (slabSource(kind) ?? BlockKind.OakPlanks) as BlockKind;
  useFrame(() => {
    if (followPlayer && group.current) {
      const pitch = world.queryFirst(Player)?.get(PlayerState)?.pitch ?? 0;
      group.current.position.y = pitch > 0.15 ? 0.41 : -0.41;
    }
  });
  const wall = growth === 2;
  const x = !wall ? 0 : facing === 'east' ? -0.41 : facing === 'west' ? 0.41 : 0;
  const y = wall ? 0 : growth === 1 ? 0.41 : -0.41;
  const z = !wall ? 0 : facing === 'south' ? -0.41 : facing === 'north' ? 0.41 : 0;
  return (
    <group ref={group} name="slab-block" userData={{ kind, facing, growth }} position={followPlayer ? [0, -0.41, 0] : position}>
      <mesh
        geometry={blockGeometry}
        material={materials ?? blockMaterials[source]}
        position={followPlayer ? [0, 0, 0] : [x, y, z]}
        scale={wall && (facing === 'east' || facing === 'west') ? [0.18, 1, 1] : wall ? [1, 1, 0.18] : [1, 0.18, 1]}
      />
    </group>
  );
}
