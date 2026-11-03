import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, NearestFilter, Vector3 } from 'three';
import { PixelPart } from './ItemModel';
import parisStreetLampUrl from '../../assets/models/paris-street-lamp.glb';

function StreetLampLight({ lit, position, color, intensity, distance }: { lit: boolean; position: [number, number, number]; color: string; intensity: number; distance: number }) {
  if (!lit) return null;
  return <pointLight name="street-lamp-light" position={position} args={[color, intensity, distance, 1.4]} />;
}

export function NormalStreetLampModel({ lit = true }: { lit?: boolean }) {
  return (
    <group name="street-lamp-modern">
      <PixelPart position={[0, 0.06, 0]} size={[0.68, 0.12, 0.68]} color="#39434c" />
      <PixelPart position={[0, 0.2, 0]} size={[0.34, 0.28, 0.34]} color="#46535f" />
      <PixelPart position={[0, 2.2, 0]} size={[0.16, 4.2, 0.16]} color="#46535f" />
      <PixelPart position={[0, 2.7, -0.086]} size={[0.055, 1.35, 0.018]} color="#98b7c8" />
      <PixelPart position={[0.48, 4.24, 0]} size={[1.18, 0.14, 0.22]} color="#29353f" />
      <PixelPart position={[0.9, 4.17, 0]} size={[0.72, 0.16, 0.42]} color="#29353f" />
      <PixelPart position={[0.9, 4.27, 0]} size={[0.76, 0.05, 0.44]} color="#202a33" />
      <mesh name="modern-led-panel" position={[0.9, 4.075, 0]}>
        <boxGeometry args={[0.6, 0.025, 0.32]} />
        <meshBasicMaterial color="#eaf7ff" />
      </mesh>
      <StreetLampLight lit={lit} position={[0.9, 4, 0]} color="#e4f4ff" intensity={10} distance={34} />
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
    const scale = 3.1 / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return clone;
  }, [scene]);
  return <group name="paris-street-lamp"><primitive object={model} /><StreetLampLight lit={lit} position={[0, 2.9, 0]} color="#ffd38a" intensity={7} distance={26} /></group>;
}
