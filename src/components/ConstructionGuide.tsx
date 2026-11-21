import { useBlueprintStore } from '../game/blueprints';
import { BLOCK_INFO } from '../game/voxel';
import { blockGeometry } from '../game/textures';

export function ConstructionGuide() {
  const active = useBlueprintStore((state) => state.active);
  if (!active) return null;
  return (
    <group name="construction-blueprint">
      {active.blocks.slice(active.index, active.index + 6).map((block, offset) => (
        <group key={`${block.x},${block.y},${block.z}`} position={[block.x, block.y, block.z]} name={offset === 0 ? 'next-blueprint-block' : undefined}>
          <mesh geometry={blockGeometry}>
            <meshBasicMaterial color={BLOCK_INFO[block.kind]?.color ?? '#ffffff'} transparent opacity={offset === 0 ? 0.65 : 0.2} depthWrite={false} />
          </mesh>
          {offset === 0 && <mesh geometry={blockGeometry} scale={1.08}>
            <meshBasicMaterial color="#fff2a0" wireframe transparent opacity={0.95} depthWrite={false} />
          </mesh>}
        </group>
      ))}
    </group>
  );
}
