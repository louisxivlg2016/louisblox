import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { Explosion, ExplosionMaterial, ExplosionMesh, ExplosionPosition } from '../game/traits';
import { animalMaterial } from '../game/animalTextures';

const paintPixels = [
  [0, 0, 0.62, 0.44], [-0.32, 0.15, 0.18, 0.15], [0.3, -0.13, 0.17, 0.22],
  [0.13, 0.28, 0.13, 0.13], [-0.18, -0.28, 0.14, 0.14], [0.38, 0.19, 0.09, 0.09],
] as const;
const paintGeometry = new BoxGeometry(1, 1, 0.018);
const paintMaterial = new MeshBasicMaterial({ map: animalMaterial('#ffffff').map, toneMapped: false });
const paintMatrix = new Matrix4();
const pixelMatrix = new Matrix4();
const paintRotation = new Quaternion();
const paintNormal = new Vector3(0, 0, 1);
const unitScale = new Vector3(1, 1, 1);
const paintColor = new Color();

function PaintSplashes({ entities }: { entities: readonly Entity[] }) {
  const meshes = useRef<Array<InstancedMesh | null>>([]);
  const capacity = Math.max(256, 2 ** Math.ceil(Math.log2(Math.max(1, entities.length))));

  useFrame(() => {
    let count = 0;
    for (const entity of entities) {
      const explosion = entity.get(Explosion);
      const position = entity.get(ExplosionPosition);
      if (!explosion?.paintColor || !explosion.paintNormal || !position) continue;
      paintRotation.setFromUnitVectors(paintNormal, explosion.paintNormal);
      paintMatrix.compose(position, paintRotation, unitScale);
      paintColor.set(explosion.paintColor);
      for (let index = 0; index < paintPixels.length; index += 1) {
        const mesh = meshes.current[index];
        if (!mesh) continue;
        const [x, y, width, height] = paintPixels[index];
        pixelMatrix.makeScale(width, height, 1);
        pixelMatrix.setPosition(x, y, 0);
        pixelMatrix.premultiply(paintMatrix);
        mesh.setMatrixAt(count, pixelMatrix);
        mesh.setColorAt(count, paintColor);
      }
      count += 1;
    }
    for (const mesh of meshes.current) {
      if (!mesh) continue;
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return paintPixels.map((_, index) => (
    <instancedMesh
      key={`${capacity}-${index}`}
      name="paint-splashes"
      ref={(mesh) => { meshes.current[index] = mesh; }}
      args={[paintGeometry, paintMaterial, capacity]}
      count={0}
      frustumCulled={false}
      renderOrder={20}
      dispose={null}
    />
  ));
}

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
  const explosions = useQuery(Explosion, ExplosionPosition);
  return (
    <>
      <PaintSplashes entities={explosions.filter((entity) => entity.get(Explosion)?.paintColor)} />
      {explosions.filter((entity) => !entity.get(Explosion)?.paintColor).map((entity) => <ExplosionView key={entity} entity={entity} />)}
    </>
  );
}
