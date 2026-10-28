import { useQueryFirst } from 'koota/react';
import { blockGeometry } from '../game/textures';
import { BlockTarget, TargetMesh } from '../game/traits';

export function TargetHighlight() {
  const entity = useQueryFirst(BlockTarget);
  if (!entity) return null;

  return (
    <lineSegments
      ref={(mesh) => {
        const holder = entity.get(TargetMesh);
        if (holder) holder.value = mesh;
      }}
      visible={false}
      scale={1.012}
      renderOrder={2}
    >
      <edgesGeometry args={[blockGeometry]} />
      <lineBasicMaterial color="#ffffff" transparent opacity={0.9} depthTest />
    </lineSegments>
  );
}
