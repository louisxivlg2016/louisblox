import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useQuery } from 'koota/react';
import type { Group } from 'three';
import { DroppedItem, DroppedItemPosition } from '../game/traits';
import { blockGeometry, blockMaterials } from '../game/textures';
import { ItemModel } from './ItemModel';
import { StairModel } from './StairModel';
import { SlabModel } from './SlabModel';
import { isSlab, isStair, isUtilityBlock } from '../game/extraBlocks';
import { UtilityBlockModel } from './UtilityBlocks';

function DroppedItemView({ entity }: { entity: import('koota').Entity }) {
  const group = useRef<Group>(null);
  const kind = entity.get(DroppedItem)?.kind ?? 'hand';
  useFrame(() => {
    const position = entity.get(DroppedItemPosition);
    const item = entity.get(DroppedItem);
    if (!group.current || !position || !item) return;
    group.current.position.copy(position);
    group.current.rotation.y = item.age * 1.8;
  });
  return (
    <group ref={group} scale={entity.get(DroppedItem)?.mined ? 0.22 : 0.45}>
      {typeof kind === 'number' ? isStair(kind) ? <StairModel kind={kind} /> : isSlab(kind) ? <SlabModel kind={kind} /> : isUtilityBlock(kind) ? <UtilityBlockModel kind={kind} withLight={false} /> : <mesh args={[blockGeometry, blockMaterials[kind]]} /> : <ItemModel kind={kind} />}
    </group>
  );
}

export function DroppedItems() {
  const items = useQuery(DroppedItem, DroppedItemPosition);
  return items.map((entity) => <DroppedItemView key={entity} entity={entity} />);
}
