import { EXTRA_BLOCK_META, isTrapdoor } from '../game/extraBlocks';
import type { ExtraBlockKind } from '../game/extraBlocks';
import type { Voxel } from '../game/voxel';
import { PixelPart } from './ItemModel';

export function DoorInstances({ blocks }: { blocks: Voxel[] }) {
  return (
    <>
      {blocks.map((block) => {
        const trapdoor = isTrapdoor(block.kind);
        const color = EXTRA_BLOCK_META[block.kind as ExtraBlockKind].color;
        const facing = block.facing === 'north' ? Math.PI : block.facing === 'east' ? -Math.PI / 2 : block.facing === 'west' ? Math.PI / 2 : 0;
        if (trapdoor) {
          return (
            <group key={`${block.x},${block.y},${block.z}`} position={[block.x, block.y - 0.42, block.z]} rotation={[0, facing, 0]}>
              <group position={[0, 0, 0.43]} rotation={[block.open ? -Math.PI / 2 : 0, 0, 0]}>
                <group position={[0, 0, -0.43]}>
                  <PixelPart position={[0, 0, 0]} size={[0.92, 0.14, 0.92]} color={color} />
                  <PixelPart position={[0, 0.08, -0.26]} size={[0.62, 0.035, 0.6]} color={color} />
                  <PixelPart position={[0, 0.08, 0.26]} size={[0.62, 0.035, 0.6]} color={color} />
                  <PixelPart position={[0.28, 0.11, -0.26]} size={[0.1, 0.1, 0.1]} color="#d8b85c" />
                  <PixelPart position={[0.28, -0.11, -0.26]} size={[0.1, 0.1, 0.1]} color="#d8b85c" />
                </group>
              </group>
            </group>
          );
        }
        return (
          <group key={`${block.x},${block.y},${block.z}`} position={[block.x, block.y + 0.49, block.z]} rotation={[0, facing, 0]}>
            <group position={[-0.47, 0, 0]} rotation={[0, block.open ? -Math.PI / 2 : 0, 0]}>
              <group position={[0.47, 0, 0]}>
                <PixelPart position={[0, 0, 0]} size={[0.92, 1.96, 0.14]} color={color} />
                <PixelPart position={[0, 0.45, -0.08]} size={[0.6, 0.49, 0.035]} color={color} />
                <PixelPart position={[0, -0.36, -0.08]} size={[0.6, 0.49, 0.035]} color={color} />
                <PixelPart position={[0, 0.45, 0.08]} size={[0.6, 0.49, 0.035]} color={color} />
                <PixelPart position={[0, -0.36, 0.08]} size={[0.6, 0.49, 0.035]} color={color} />
                <PixelPart position={[0.3, -0.04, -0.13]} size={[0.1, 0.12, 0.1]} color="#d8b85c" />
                <PixelPart position={[0.3, -0.04, 0.13]} size={[0.1, 0.12, 0.1]} color="#d8b85c" />
              </group>
            </group>
          </group>
        );
      })}
    </>
  );
}
