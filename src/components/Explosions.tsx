import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import { MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { Explosion, ExplosionMaterial, ExplosionMesh, ExplosionPosition } from '../game/traits';
import { animalMaterial } from '../game/animalTextures';

const paintPixels = [
  [0, 0, 0.62, 0.44], [-0.32, 0.15, 0.18, 0.15], [0.3, -0.13, 0.17, 0.22],
  [0.13, 0.28, 0.13, 0.13], [-0.18, -0.28, 0.14, 0.14], [0.38, 0.19, 0.09, 0.09],
] as const;

const paintMaterials = new Map<string, MeshBasicMaterial>();

function paintMaterial(color: string) {
  let material = paintMaterials.get(color);
  if (!material) {
    material = new MeshBasicMaterial({ map: animalMaterial(color).map, toneMapped: false });
    paintMaterials.set(color, material);
  }
  return material;
}

function ExplosionView({ entity }: { entity: Entity }) {
  const position = entity.get(ExplosionPosition)!;
  const explosion = entity.get(Explosion)!;
  if (explosion.paintColor && explosion.paintNormal) return (
    <group name="paint-splash" userData={{ color: explosion.paintColor }} position={[position.x, position.y, position.z]} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), explosion.paintNormal)}>
      {paintPixels.map(([x, y, width, height], index) => (
        <mesh key={index} position={[x, y, 0]} renderOrder={20} material={paintMaterial(explosion.paintColor!)}>
          <boxGeometry args={[width, height, 0.018]} />
        </mesh>
      ))}
    </group>
  );
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
