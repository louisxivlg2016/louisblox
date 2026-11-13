import { useMemo } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';

function wingGeometry(points: number[]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function ParachuteModel({ held = false }: { held?: boolean }) {
  const outer = useMemo(() => wingGeometry([0, 0, -0.45, -1.3, 0, 0.65, 1.3, 0, 0.65]), []);
  const inner = useMemo(() => wingGeometry([0, 0.018, -0.2, -0.66, 0.018, 0.48, 0.66, 0.018, 0.48]), []);
  return (
    <group name="delta-glider" position={held ? [0, 0.1, 0] : [0, 1.25, 0.38]} scale={held ? 0.35 : 0.8}>
      <mesh geometry={outer}><meshLambertMaterial color="#d94b45" side={DoubleSide} /></mesh>
      <mesh geometry={inner}><meshLambertMaterial color="#f0eadc" side={DoubleSide} /></mesh>
      <mesh position={[0, -0.025, 0.1]}><boxGeometry args={[0.045, 0.045, 1.15]} /><meshLambertMaterial color="#4a3028" /></mesh>
    </group>
  );
}

export function ParachutePackModel() {
  return <group name="parachute-pack"><ParachuteModel /></group>;
}
