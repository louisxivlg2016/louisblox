import { useMemo } from 'react';
import { ExtrudeGeometry, Shape } from 'three';

function lensGeometry() {
  const shape = new Shape();
  const width = 0.22;
  const height = 0.13;
  const radius = 0.035;
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return new ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 8 });
}

export function PoliceSunglasses() {
  const geometry = useMemo(lensGeometry, []);
  const material = <meshStandardMaterial color="#111b29" roughness={0.22} metalness={0.18} />;
  return (
    <group name="police-sunglasses" position={[0, 0.245, 0.255]} rotation={[0.04, 0, 0]}>
      <mesh geometry={geometry} position={[-0.13, 0, 0]}>{material}</mesh>
      <mesh geometry={geometry} position={[0.13, 0, 0]}>{material}</mesh>
      <mesh position={[0, 0.015, 0.015]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.014, 0.014, 0.075, 12]} />{material}</mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.25, 0.005, -0.12]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.36, 10]} />{material}</mesh>)}
    </group>
  );
}
