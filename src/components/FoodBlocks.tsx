import { useLayoutEffect, useRef } from 'react';
import { Box3 } from 'three';
import type { Group } from 'three';
import { BlockKind, voxelKey } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import { isSelectedKind } from '../game/items';
import { ItemModel, MeatModel } from './ItemModel';

function PlacedFood({ block }: { block: Voxel }) {
  const group = useRef<Group>(null);
  useLayoutEffect(() => {
    if (!group.current) return;
    const floor = block.y - 0.5;
    group.current.position.y = floor;
    group.current.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(group.current);
    if (bounds.isEmpty()) return;
    group.current.position.y += floor - bounds.min.y;
    group.current.updateMatrixWorld(true);
  }, [block.x, block.y, block.z, block.food, block.meat]);
  return (
    <group ref={group} name="placed-food" userData={{ food: block.food, meat: block.meat }} position={[block.x, block.y - 0.5, block.z]} scale={0.65}>
      {block.meat ? <MeatModel kind={block.meat} /> : typeof block.food === 'string' && isSelectedKind(block.food) ? <ItemModel kind={block.food} /> : null}
    </group>
  );
}

export function FoodBlocks({ blocks }: { blocks: Voxel[] }) {
  return blocks.filter((block) => block.kind === BlockKind.Food).map((block) => <PlacedFood key={voxelKey(block.x, block.y, block.z)} block={block} />);
}
