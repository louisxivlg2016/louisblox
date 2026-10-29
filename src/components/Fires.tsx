import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useQuery, useQueryFirst } from 'koota/react';
import type { Entity } from 'koota';
import { BoxGeometry, InstancedMesh, Matrix4, MeshBasicMaterial } from 'three';
import { Fire, FirePosition, Player, PlayerPosition } from '../game/traits';
import { BlockKind } from '../game/voxel';

const geometry = new BoxGeometry(1, 1, 1);
const matrix = new Matrix4();
const materials = {
  safeOuter: new MeshBasicMaterial({ color: '#ff9b28' }),
  safeInner: new MeshBasicMaterial({ color: '#ffe890' }),
  wildOuter: new MeshBasicMaterial({ color: '#ef4925' }),
  wildInner: new MeshBasicMaterial({ color: '#ffb12b' }),
};

function FlameInstances({ kind }: { kind: BlockKind }) {
  const fires = useQuery(Fire, FirePosition);
  const outer = useRef<InstancedMesh>(null);
  const inner = useRef<InstancedMesh>(null);
  const outerMaterial = kind === BlockKind.Wildfire ? materials.wildOuter : materials.safeOuter;
  const innerMaterial = kind === BlockKind.Wildfire ? materials.wildInner : materials.safeInner;

  useFrame(() => {
    if (!outer.current || !inner.current) return;
    let outerIndex = 0;
    let innerIndex = 0;
    for (const entity of fires) {
      const fire = entity.get(Fire);
      if (!fire || fire.kind !== kind || outerIndex >= 512 || innerIndex >= 256) continue;
      const position = entity.get(FirePosition)!;
      const scale = 1.2 + Math.min(fire.age / 20, 1.6);
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
      <instancedMesh ref={outer} args={[geometry, outerMaterial, 512]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={inner} args={[geometry, innerMaterial, 256]} frustumCulled={false} dispose={null} />
    </>
  );
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
  const destructive = nearest?.get(Fire)?.kind === BlockKind.Wildfire;
  return (
    <>
      <FlameInstances kind={BlockKind.Campfire} />
      <FlameInstances kind={BlockKind.Wildfire} />
      {position && <pointLight position={[position.x, position.y, position.z]} color={destructive ? '#ff632e' : '#ff9b45'} intensity={destructive ? 2.2 : 1.4} distance={12} decay={2} />}
    </>
  );
}
