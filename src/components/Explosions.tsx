import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { Explosion, ExplosionMaterial, ExplosionMesh, ExplosionPosition } from '../game/traits';
import { animalMaterial } from '../game/animalTextures';

const paintGeometry = new BoxGeometry(1, 1, 0.018);
const paintMaterial = new MeshBasicMaterial({ map: animalMaterial('#ffffff').map, toneMapped: false });
const paintMatrix = new Matrix4();
const pixelMatrix = new Matrix4();
const paintRotation = new Quaternion();
const paintNormal = new Vector3(0, 0, 1);
const unitScale = new Vector3(1, 1, 1);
const paintColor = new Color();
const strokeDirection = new Vector3();
const strokeTangent = new Vector3();
const strokeSide = new Vector3();
const strokeBasis = new Matrix4();

function PaintStrokes({ entities }: { entities: readonly Entity[] }) {
  const stroke = useRef<InstancedMesh>(null);
  const capacity = Math.max(256, 2 ** Math.ceil(Math.log2(Math.max(1, entities.length))));

  useFrame(() => {
    if (!stroke.current) return;
    let count = 0;
    for (const entity of entities) {
      const explosion = entity.get(Explosion);
      const position = entity.get(ExplosionPosition);
      if (!explosion?.paintColor || !explosion.paintNormal || !position) continue;
      const width = explosion.paintWidth ?? 0.08;
      let length = 0;
      paintRotation.setFromUnitVectors(paintNormal, explosion.paintNormal);
      if (explosion.paintFrom && explosion.paintTo) {
        strokeDirection.subVectors(explosion.paintTo, explosion.paintFrom);
        length = strokeDirection.length();
        if (length > 0.000001) {
          strokeTangent.copy(strokeDirection).normalize();
          strokeSide.crossVectors(explosion.paintNormal, strokeTangent).normalize();
          strokeBasis.makeBasis(strokeTangent, strokeSide, explosion.paintNormal);
          paintRotation.setFromRotationMatrix(strokeBasis);
        }
      }
      paintMatrix.compose(position, paintRotation, unitScale);
      pixelMatrix.makeScale(length > 0.000001 ? length + width : width, width, 1);
      pixelMatrix.premultiply(paintMatrix);
      stroke.current.setMatrixAt(count, pixelMatrix);
      paintColor.set(explosion.paintColor);
      stroke.current.setColorAt(count, paintColor);
      count += 1;
    }
    stroke.current.count = count;
    stroke.current.instanceMatrix.needsUpdate = true;
    if (stroke.current.instanceColor) stroke.current.instanceColor.needsUpdate = true;
  });

  return <instancedMesh key={capacity} name="paint-strokes" ref={stroke} args={[paintGeometry, paintMaterial, capacity]} count={0} frustumCulled={false} renderOrder={20} dispose={null} />;
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
      <PaintStrokes entities={explosions.filter((entity) => entity.get(Explosion)?.paintColor)} />
      {explosions.filter((entity) => !entity.get(Explosion)?.paintColor).map((entity) => <ExplosionView key={entity} entity={entity} />)}
    </>
  );
}
