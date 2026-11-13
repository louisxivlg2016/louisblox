import { useLayoutEffect, useRef } from 'react';
import { DoubleSide, Matrix4, MeshLambertMaterial, PlaneGeometry } from 'three';
import type { InstancedMesh } from 'three';
import { BlockKind } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import { appleTexture } from '../game/appleTexture';

const geometry = new PlaneGeometry(0.9, 0.9);
const material = new MeshLambertMaterial({ map: appleTexture(), alphaTest: 0.1, side: DoubleSide });
const matrix = new Matrix4();
const faces = [
  { name: 'front', offset: [0, 0, 0.502], rotation: 0 },
  { name: 'back', offset: [0, 0, -0.502], rotation: Math.PI },
  { name: 'right', offset: [0.502, 0, 0], rotation: Math.PI / 2 },
  { name: 'left', offset: [-0.502, 0, 0], rotation: -Math.PI / 2 },
] as const;

function AppleFace({ blocks, face }: { blocks: Voxel[]; face: (typeof faces)[number] }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    blocks.forEach((block, index) => {
      matrix.makeRotationY(face.rotation);
      matrix.setPosition(block.x + face.offset[0], block.y + face.offset[1], block.z + face.offset[2]);
      mesh.current!.setMatrixAt(index, matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [blocks, face]);
  return <instancedMesh ref={mesh} name={`apple-image-${face.name}`} args={[geometry, material, blocks.length]} />;
}

export function AppleInstances({ blocks }: { blocks: Voxel[] }) {
  const apples = blocks.filter((block) => block.kind === BlockKind.Apple);
  if (apples.length === 0) return null;
  return faces.map((face) => <AppleFace key={face.name} blocks={apples} face={face} />);
}
