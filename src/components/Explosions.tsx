import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import { Explosion, ExplosionMaterial, ExplosionMesh, ExplosionPosition } from '../game/traits';

function ExplosionView({ entity }: { entity: Entity }) {
  const position = entity.get(ExplosionPosition)!;
  return (
    <group
      ref={(group) => {
        const holder = entity.get(ExplosionMesh);
        if (holder) holder.value = group;
      }}
      position={[position.x, position.y, position.z]}
    >
      <mesh renderOrder={20}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          ref={(material) => {
            const holder = entity.get(ExplosionMaterial);
            if (holder) holder.value = material;
          }}
          color="#ff8a32"
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
      <pointLight color="#ff9b45" intensity={6} distance={14} decay={2} />
    </group>
  );
}

export function Explosions() {
  const explosions = useQuery(Explosion);
  return explosions.map((entity) => <ExplosionView key={entity} entity={entity} />);
}
