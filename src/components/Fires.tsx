import { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useQuery, useQueryFirst } from 'koota/react';
import type { Entity } from 'koota';
import { Box3, BoxGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, Vector3 } from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { Fire, FirePosition, Player, PlayerPosition } from '../game/traits';
import redFireUrl from '../../assets/models/red-fire.glb';

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

const SMOKE_PUFFS = 6;
const SMOKE_CAPACITY = 96 * SMOKE_PUFFS;
const smokeMaterial = new MeshBasicMaterial({ color: '#6d777f', transparent: true, opacity: 0.34, depthWrite: false });

function SmokeInstances({ fires }: { fires: readonly Entity[] }) {
  const smoke = useRef<InstancedMesh>(null);
  const capacity = Math.max(SMOKE_CAPACITY, fires.length * SMOKE_PUFFS);

  useFrame(({ clock }) => {
    if (!smoke.current) return;
    const time = clock.elapsedTime;
    let index = 0;
    for (const entity of fires) {
      const fire = entity.get(Fire);
      const position = entity.get(FirePosition);
      if (!fire || !position) continue;
      const flameScale = 1.2 + fire.age / 20;
      const offset = ((position.x * 0.17 + position.z * 0.29) % 1 + 1) % 1;
      for (let puff = 0; puff < SMOKE_PUFFS && index < capacity; puff += 1) {
        const progress = (time * 0.3 + puff / SMOKE_PUFFS + offset) % 1;
        const spread = 0.08 + progress * 0.65;
        const size = (0.16 + progress * 0.4) * Math.sin(progress * Math.PI) * (0.75 + flameScale * 0.2);
        const angle = time * 0.6 + puff * 1.9 + offset * Math.PI * 2;
        matrix.makeScale(size, size * 0.82, size);
        matrix.setPosition(
          position.x + Math.sin(angle) * spread + progress * 0.3,
          position.y - 0.5 + flameScale * 0.8 + progress * 3.4,
          position.z + Math.cos(angle * 0.83) * spread * 0.65,
        );
        smoke.current.setMatrixAt(index, matrix);
        index += 1;
      }
      if (index >= capacity) break;
    }
    smoke.current.count = index;
    smoke.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh name="fire-smoke" ref={smoke} args={[geometry, smokeMaterial, capacity]} count={0} frustumCulled={false} dispose={null} />;
}

function RedFlame({ entity }: { entity: Entity }) {
  const group = useRef<import('three').Group>(null);
  const { scene } = useGLTF(redFireUrl);
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
    const scale = (1.2 + fire.age / 20) / height;
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
      <SmokeInstances fires={fires} />
      <Suspense fallback={<FlameInstances fires={fires} />}>
        {fires.map((entity) => <RedFlame key={entity} entity={entity} />)}
      </Suspense>
      {position && <pointLight position={[position.x, position.y, position.z]} color="#ff632e" intensity={2.2} distance={12} decay={2} />}
    </>
  );
}
