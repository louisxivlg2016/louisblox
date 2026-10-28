import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import { animalMaterial } from '../game/animalTextures';
import { MEAT_COLORS } from '../game/meats';
import { MeatDrop, MeatDropMesh, MeatDropPosition } from '../game/traits';

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
      <mesh material={animalMaterial(MEAT_COLORS[kind])} dispose={null}>
        <boxGeometry args={[0.44, 0.24, 0.34]} />
      </mesh>
      <mesh position={[0, 0.02, 0.25]} material={animalMaterial('#ead9b8')} dispose={null}>
        <boxGeometry args={[0.15, 0.13, 0.18]} />
      </mesh>
      <mesh position={[0.13, 0.14, -0.05]} material={animalMaterial('#f2c4b8')} dispose={null}>
        <boxGeometry args={[0.12, 0.05, 0.18]} />
      </mesh>
    </group>
  );
}

export function MeatDrops() {
  const drops = useQuery(MeatDrop);
  return drops.map((entity) => <MeatDropView key={entity} entity={entity} />);
}
