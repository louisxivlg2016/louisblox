import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import { BoxGeometry, CanvasTexture, Color, InstancedMesh, LinearFilter, LinearMipmapLinearFilter, Matrix4, MeshBasicMaterial, Quaternion, SphereGeometry, SRGBColorSpace, Vector3 } from 'three';
import { Explosion, ExplosionMaterial, ExplosionMesh, ExplosionPosition } from '../game/traits';

function createBrushTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 16;
  const context = canvas.getContext('2d')!;
  const vertical = context.createLinearGradient(0, 0, 0, 16);
  vertical.addColorStop(0, 'rgba(255,255,255,0)');
  vertical.addColorStop(0.22, 'rgba(255,255,255,0.75)');
  vertical.addColorStop(0.5, 'rgba(255,255,255,0.95)');
  vertical.addColorStop(0.78, 'rgba(255,255,255,0.75)');
  vertical.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = vertical;
  context.fillRect(0, 0, 64, 16);
  const horizontal = context.createLinearGradient(0, 0, 64, 0);
  horizontal.addColorStop(0, 'rgba(255,255,255,0)');
  horizontal.addColorStop(0.12, 'rgba(255,255,255,1)');
  horizontal.addColorStop(0.88, 'rgba(255,255,255,1)');
  horizontal.addColorStop(1, 'rgba(255,255,255,0)');
  context.globalCompositeOperation = 'destination-in';
  context.fillStyle = horizontal;
  context.fillRect(0, 0, 64, 16);
  const texture = new CanvasTexture(canvas);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const paintGeometry = new BoxGeometry(1, 1, 0.018);
const paintMaterial = new MeshBasicMaterial({ map: createBrushTexture(), transparent: true, opacity: 0.86, depthWrite: false, toneMapped: false });
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
      const width = explosion.paintWidth ?? 0.1;
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

const effectGeometry = new SphereGeometry(1, 8, 6);

function EffectView({ entity }: { entity: Entity }) {
  const explosion = entity.get(Explosion)!;
  const position = entity.get(ExplosionPosition)!;
  const group = useRef<import('three').Group>(null);
  const material = useMemo(() => new MeshBasicMaterial({ color: explosion.effect === 'smoke' ? '#7b838a' : explosion.color ?? '#ffffff', transparent: true, opacity: 1, depthWrite: false, toneMapped: false }), [explosion.effect, explosion.color]);
  const count = explosion.effect === 'smoke' ? 32 : 72;
  const directions = useMemo(() => Array.from({ length: count }, (_, index) => {
    const y = 1 - 2 * (index + 0.5) / count;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * 2.399963;
    return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  }), [count]);
  useFrame(({ clock }) => {
    if (group.current) {
      const holder = entity.get(ExplosionMesh);
      if (holder) holder.value = group.current;
    }
    const materialHolder = entity.get(ExplosionMaterial);
    if (materialHolder) materialHolder.value = material;
    const progress = Math.min(1, Math.max(0, 1 - explosion.time / explosion.maxTime));
    material.opacity = explosion.effect === 'smoke' ? (1 - progress) * 0.38 : 1 - progress;
    if (explosion.effect === 'firework' && explosion.color === '#b578d5') material.color.setHSL((clock.elapsedTime * 0.7) % 1, 0.82, 0.62);
    group.current?.children.forEach((child, index) => {
      const direction = directions[index];
      if (!direction) return;
      const distance = explosion.effect === 'smoke' ? 2.6 : 6;
      child.position.copy(direction).multiplyScalar(progress * distance);
      if (explosion.effect === 'smoke') child.position.y += progress * 1.1;
      else child.position.y -= progress * progress * 2;
      child.scale.setScalar(explosion.effect === 'smoke' ? 0.35 + progress * 2.2 : Math.max(0.025, 0.15 * (1 - progress * 0.65)));
    });
  });
  return (
    <group ref={group} name={explosion.effect === 'smoke' ? 'smoke-grenade-cloud' : 'firework-burst'} position={[position.x, position.y, position.z]}>
      {directions.map((_, index) => <mesh key={index} geometry={effectGeometry} material={material} />)}
      {explosion.effect === 'firework' && <pointLight color={explosion.color ?? '#ffffff'} intensity={4} distance={12} decay={2} />}
    </group>
  );
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
      {explosions.filter((entity) => !entity.get(Explosion)?.paintColor).map((entity) => entity.get(Explosion)?.effect ? <EffectView key={entity} entity={entity} /> : <ExplosionView key={entity} entity={entity} />)}
    </>
  );
}
