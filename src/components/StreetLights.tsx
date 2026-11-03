import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, NearestFilter, Vector3 } from 'three';
import { PixelPart } from './ItemModel';
import parisStreetLampUrl from '../../assets/models/paris-street-lamp.glb';

function StreetLampLight({ lit }: { lit: boolean }) {
  if (!lit) return null;
  return <pointLight name="street-lamp-light" position={[0, 1.9, 0]} args={['#ffd38a', 7, 26, 1.4]} />;
}

export function NormalStreetLampModel({ lit = true }: { lit?: boolean }) {
  return (
    <group name="street-lamp">
      <PixelPart position={[0, 0.05, 0]} size={[0.5, 0.1, 0.5]} color="#505961" />
      <PixelPart position={[0, 0.89, 0]} size={[0.14, 1.68, 0.14]} color="#75818a" />
      <PixelPart position={[0, 1.61, 0]} size={[0.48, 0.08, 0.48]} color="#272d32" />
      <mesh position={[0, 1.84, 0]}>
        <boxGeometry args={[0.38, 0.4, 0.38]} />
        <meshBasicMaterial color="#ffe1a0" />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <PixelPart position={[side * 0.21, 1.84, -0.21]} size={[0.045, 0.45, 0.045]} color="#272d32" />
          <PixelPart position={[side * 0.21, 1.84, 0.21]} size={[0.045, 0.45, 0.045]} color="#272d32" />
        </group>
      ))}
      <PixelPart position={[0, 2.09, 0]} size={[0.54, 0.12, 0.54]} color="#272d32" />
      <PixelPart position={[0, 2.21, 0]} size={[0.1, 0.14, 0.1]} color="#272d32" />
      <StreetLampLight lit={lit} />
    </group>
  );
}

export function ParisStreetLampModel({ lit = true }: { lit?: boolean }) {
  const { scene } = useGLTF(parisStreetLampUrl);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (object.type !== 'Mesh') return;
      const mesh = object as import('three').Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const map = (material as import('three').MeshStandardMaterial).map;
        if (map) {
          map.magFilter = NearestFilter;
          map.minFilter = NearestFilter;
          map.generateMipmaps = false;
          map.needsUpdate = true;
        }
      }
    });
    const bounds = new Box3().setFromObject(clone);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const scale = 2.6 / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return clone;
  }, [scene]);
  return <group name="paris-street-lamp"><primitive object={model} /><StreetLampLight lit={lit} /></group>;
}
