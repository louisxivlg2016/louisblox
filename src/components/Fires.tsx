import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useQuery, useQueryFirst } from 'koota/react';
import type { Entity } from 'koota';
import { Box3, BoxGeometry, CanvasTexture, Color, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { Fire, FirePosition, Player, PlayerPosition } from '../game/traits';
import { BlockKind } from '../game/voxel';
import redFireUrl from '../../assets/models/red-fire.glb';
import hunyuanFireUrl from '../../assets/models/hunyuan-fire.glb';

const geometry = new BoxGeometry(1, 1, 1);
const matrix = new Matrix4();
const outerMaterial = new MeshBasicMaterial({ color: '#ef4925' });
const innerMaterial = new MeshBasicMaterial({ color: '#ffb12b' });

function FlameInstances({ fires }: { fires: readonly Entity[] }) {
  const outer = useRef<InstancedMesh>(null);
  const inner = useRef<InstancedMesh>(null);
  const outerCapacity = Math.max(512, fires.length * 2);
  const innerCapacity = Math.max(256, fires.length);

  useFrame(() => {
    if (!outer.current || !inner.current) return;
    let outerIndex = 0;
    let innerIndex = 0;
    for (const entity of fires) {
      const fire = entity.get(Fire);
      if (!fire) continue;
      const position = entity.get(FirePosition)!;
      const scale = 1.2 + fire.age / 20;
      matrix.makeScale(0.26 * scale, 0.44 * scale, 0.26 * scale);
      matrix.setPosition(position.x, position.y - 0.5 + 0.22 * scale, position.z);
      outer.current.setMatrixAt(outerIndex, matrix);
      outerIndex += 1;
      matrix.makeScale(0.12 * scale, 0.16 * scale, 0.12 * scale);
      matrix.setPosition(position.x, position.y - 0.5 + 0.57 * scale, position.z);
      outer.current.setMatrixAt(outerIndex, matrix);
      outerIndex += 1;
      matrix.makeScale(0.13 * scale, 0.3 * scale, 0.13 * scale);
      matrix.setPosition(position.x, position.y - 0.5 + 0.34 * scale, position.z - 0.02 * scale);
      inner.current.setMatrixAt(innerIndex, matrix);
      innerIndex += 1;
    }
    outer.current.count = outerIndex;
    inner.current.count = innerIndex;
    outer.current.instanceMatrix.needsUpdate = true;
    inner.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={outer} args={[geometry, outerMaterial, outerCapacity]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={inner} args={[geometry, innerMaterial, innerCapacity]} frustumCulled={false} dispose={null} />
    </>
  );
}

const SMOKE_PUFFS = 10;
const SMOKE_CAPACITY = 96 * SMOKE_PUFFS;
const smokeGeometry = new PlaneGeometry(1, 1);
const smokePosition = new Vector3();
const smokeScale = new Vector3();
const smokeColor = new Color();
const smokeBaseColor = new Color('#454b52');
const smokeTopColor = new Color('#b8bec2');

function createSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  let seed = 731;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let puff = 0; puff < 20; puff += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 27;
    const x = 64 + Math.cos(angle) * distance;
    const y = 64 + Math.sin(angle) * distance;
    const radius = 25 + random() * 27;
    const opacity = 0.13 + random() * 0.12;
    const shade = Math.round(215 + random() * 40);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${shade},${shade},${shade},${opacity})`);
    gradient.addColorStop(0.42, `rgba(${shade},${shade},${shade},${opacity * 0.78})`);
    gradient.addColorStop(0.76, `rgba(${shade},${shade},${shade},${opacity * 0.24})`);
    gradient.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(canvas);
}

function SmokeInstances({ fires, main }: { fires: readonly Entity[]; main?: Entity }) {
  const smoke = useRef<InstancedMesh>(null);
  const capacity = Math.max(SMOKE_CAPACITY, fires.length * SMOKE_PUFFS);
  const smokeMaterial = useMemo(() => new MeshBasicMaterial({ map: createSmokeTexture(), transparent: true, opacity: 0.68, depthWrite: false, alphaTest: 0.004 }), []);

  useEffect(() => () => {
    smokeMaterial.map?.dispose();
    smokeMaterial.dispose();
  }, [smokeMaterial]);

  useFrame(({ clock, camera }) => {
    if (!smoke.current) return;
    const time = clock.elapsedTime;
    let index = 0;
    for (const entity of fires) {
      const fire = entity.get(Fire);
      const position = entity.get(FirePosition);
      if (!fire || !position) continue;
      const flameScale = entity === main ? Math.min(3, 1.2 + fire.age / 20) : 0.65;
      const offset = ((position.x * 0.17 + position.z * 0.29) % 1 + 1) % 1;
      for (let puff = 0; puff < SMOKE_PUFFS && index < capacity; puff += 1) {
        const progress = (time * 0.17 + puff / SMOKE_PUFFS + offset) % 1;
        const spread = 0.05 + progress * 0.62;
        const fadeScale = Math.max(0, Math.min(1, progress / 0.08, (1 - progress) / 0.2));
        const size = (0.3 + progress * 1.25) * (0.82 + flameScale * 0.13) * fadeScale;
        const angle = time * 0.38 + puff * 1.9 + offset * Math.PI * 2;
        smokePosition.set(
          position.x + Math.sin(angle) * spread + progress * progress * 1.15,
          position.y - 0.5 + flameScale * 0.78 + progress * 4.4,
          position.z + Math.cos(angle * 0.83) * spread * 0.65 + Math.sin(progress * 5 + offset) * progress * 0.16,
        );
        smokeScale.set(size * 1.15, size, 1);
        matrix.compose(smokePosition, camera.quaternion, smokeScale);
        smoke.current.setMatrixAt(index, matrix);
        smokeColor.copy(smokeBaseColor).lerp(smokeTopColor, progress * 0.9);
        smoke.current.setColorAt(index, smokeColor);
        index += 1;
      }
      if (index >= capacity) break;
    }
    smoke.current.count = index;
    smoke.current.instanceMatrix.needsUpdate = true;
    if (smoke.current.instanceColor) smoke.current.instanceColor.needsUpdate = true;
  });

  return <instancedMesh name="fire-smoke" ref={smoke} args={[smokeGeometry, smokeMaterial, capacity]} count={0} frustumCulled={false} dispose={null} />;
}

function RedFlame({ entity, main }: { entity: Entity; main: boolean }) {
  const group = useRef<import('three').Group>(null);
  const { scene } = useGLTF(entity.get(Fire)?.kind === BlockKind.Campfire ? redFireUrl : hunyuanFireUrl);
  const { model, center, minY, height } = useMemo(() => {
    const model = SkeletonUtils.clone(scene);
    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    return { model, center, minY: bounds.min.y, height: Math.max(0.01, bounds.max.y - bounds.min.y) };
  }, [scene]);
  useFrame(() => {
    const fire = entity.get(Fire);
    const position = entity.get(FirePosition);
    if (!group.current || !fire || !position) return;
    const scale = (main ? Math.min(3, 1.2 + fire.age / 20) : 0.65) / height;
    group.current.scale.setScalar(scale);
    group.current.position.set(position.x, position.y - 0.5, position.z);
    group.current.rotation.y = Math.sin(fire.age * 2) * 0.04;
  });
  return <group ref={group} name="red-fire"><primitive object={model} position={[-center.x, -minY, -center.z]} dispose={null} /></group>;
}

export function Fires() {
  const fires = useQuery(Fire, FirePosition);
  const player = useQueryFirst(Player);
  const playerPosition = player?.get(PlayerPosition);
  const distance = (entity: Entity) => {
    const position = entity.get(FirePosition)!;
    return playerPosition ? position.distanceToSquared(playerPosition) : 0;
  };
  const nearest = [...fires].sort((a, b) => distance(a) - distance(b))[0];
  const position = nearest?.get(FirePosition);
  return (
    <>
      <SmokeInstances fires={fires} main={nearest} />
      <Suspense fallback={<FlameInstances fires={fires} />}>
        {fires.map((entity) => <RedFlame key={entity} entity={entity} main={entity === nearest} />)}
      </Suspense>
      {position && <pointLight position={[position.x, position.y, position.z]} color="#ff632e" intensity={2.2} distance={12} decay={2} />}
    </>
  );
}
