import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Points, PointsMaterial } from 'three';
import { useExtinguisherStore } from '../game/extinguisher';
import type { ExtinguisherSpray } from '../game/extinguisher';

function ExtinguisherJet({ spray }: { spray: ExtinguisherSpray }) {
  const points = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(72), 3));
    const material = new PointsMaterial({ color: '#f5f7f2', size: 0.17, transparent: true, depthWrite: false, opacity: 0.94 });
    const object = new Points(geometry, material);
    object.name = 'extinguisher-foam';
    object.frustumCulled = false;
    object.renderOrder = 5;
    return object;
  }, []);
  useEffect(() => () => {
    points.geometry.dispose();
    (points.material as PointsMaterial).dispose();
  }, [points]);
  useFrame((_, delta) => {
    spray.age += delta;
    const time = Math.min(spray.age, 0.65);
    const positions = points.geometry.getAttribute('position') as Float32BufferAttribute;
    for (let index = 0; index < 24; index++) {
      const spread = (index % 3 - 1) * (0.04 + time * 0.12);
      const elevation = (Math.floor(index / 3) % 4 - 1.5) * (0.025 + time * 0.08);
      positions.setXYZ(index,
        spray.origin.x + spray.direction.x * time * 8 + spread,
        spray.origin.y + spray.direction.y * time * 8 + elevation - time * time * 0.45,
        spray.origin.z + spray.direction.z * time * 8 + Math.sin(index * 2.3) * 0.08,
      );
    }
    positions.needsUpdate = true;
    points.visible = spray.age < 0.65;
    (points.material as PointsMaterial).opacity = Math.max(0, 0.94 * (1 - spray.age / 0.65));
  });
  return <primitive object={points} />;
}

export function ExtinguisherSprays() {
  const sprays = useExtinguisherStore((state) => state.sprays);
  return sprays.map((spray) => <ExtinguisherJet key={spray.id} spray={spray} />);
}
