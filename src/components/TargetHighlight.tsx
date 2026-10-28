import { useMemo } from 'react';
import { useQueryFirst } from 'koota/react';
import { createCrackMaterials } from '../game/crackTextures';
import { useGameStore } from '../game/store';
import { blockGeometry } from '../game/textures';
import { BlockTarget, TargetMesh } from '../game/traits';

export function TargetHighlight() {
  const entity = useQueryFirst(BlockTarget);
  const miningProgress = useGameStore((state) => state.miningProgress);
  const crackMaterials = useMemo(createCrackMaterials, []);
  const stage = Math.min(9, Math.floor(miningProgress * 10));
  if (!entity) return null;

  return (
    <group
      ref={(group) => {
        const holder = entity.get(TargetMesh);
        if (holder) holder.value = group;
      }}
      visible={false}
    >
      <lineSegments scale={1.012} renderOrder={2}>
        <edgesGeometry args={[blockGeometry]} />
        <lineBasicMaterial color="#ffffff" transparent opacity={0.9} depthTest />
      </lineSegments>
      <mesh
        geometry={blockGeometry}
        material={crackMaterials[stage]}
        visible={miningProgress > 0}
        scale={1.004}
        renderOrder={3}
        dispose={null}
      />
    </group>
  );
}
