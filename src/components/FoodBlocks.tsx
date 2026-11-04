import { BlockKind, voxelKey } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import { isSelectedKind } from '../game/items';
import { ItemModel, MeatModel } from './ItemModel';

export function FoodBlocks({ blocks }: { blocks: Voxel[] }) {
  return blocks.filter((block) => block.kind === BlockKind.Food).map((block) => (
    <group key={voxelKey(block.x, block.y, block.z)} name="placed-food" userData={{ food: block.food, meat: block.meat }} position={[block.x, block.y + 0.68, block.z]} scale={0.65}>
      {block.meat ? <MeatModel kind={block.meat} /> : typeof block.food === 'string' && isSelectedKind(block.food) ? <ItemModel kind={block.food} /> : null}
    </group>
  ));
}
