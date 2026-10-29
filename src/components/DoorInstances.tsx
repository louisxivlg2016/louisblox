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
        const position: [number, number, number] = trapdoor
          ? [block.x, block.y - 0.42, block.z + 0.43]
          : [block.x - 0.43, block.y + 0.39, block.z];
        return (
          <group
            key={`${block.x},${block.y},${block.z}`}
            position={position}
            rotation={[trapdoor && block.open ? -Math.PI / 2 : 0, !trapdoor && block.open ? -Math.PI / 2 : 0, 0]}
          >
            <group position={trapdoor ? [0, 0, -0.43] : [0.43, 0, 0]}>
              <PixelPart
                position={[0, 0, 0]}
                size={trapdoor ? [0.92, 0.14, 0.92] : [0.92, 1.78, 0.14]}
                color={color}
              />
              <PixelPart position={[0, trapdoor ? 0.08 : 0.45, trapdoor ? 0 : -0.08]} size={trapdoor ? [0.62, 0.035, 0.6] : [0.6, 0.49, 0.035]} color={color} />
              <PixelPart position={[0, trapdoor ? 0.08 : -0.36, trapdoor ? 0 : -0.08]} size={trapdoor ? [0.62, 0.035, 0.6] : [0.6, 0.49, 0.035]} color={color} />
              <PixelPart position={trapdoor ? [0.28, 0.11, -0.26] : [0.3, -0.04, -0.13]} size={[0.1, 0.1, 0.1]} color="#d8b85c" />
            </group>
          </group>
        );
      })}
    </>
  );
}
