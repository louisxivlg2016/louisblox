import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import { MeatDrop, MeatDropMesh, MeatDropPosition } from '../game/traits';
import { MeatModel } from './ItemModel';

function MeatDropView({ entity }: { entity: Entity }) {
  const kind = entity.get(MeatDrop)!.kind;
  const position = entity.get(MeatDropPosition)!;
  return (
    <group
      ref={(group) => {
        const holder = entity.get(MeatDropMesh);
        if (holder) holder.value = group;
      }}
      position={[position.x, position.y, position.z]}
    >
      <MeatModel kind={kind} />
    </group>
  );
}

export function MeatDrops() {
  const drops = useQuery(MeatDrop);
  return drops.map((entity) => <MeatDropView key={entity} entity={entity} />);
}
