import { useMemo } from 'react';
import { Object3D } from 'three';

export function WorkerHeadlamp({ showHelmet = true }: { showHelmet?: boolean }) {
  const target = useMemo(() => new Object3D(), []);
  return (
    <group name="worker-headlamp">
      {showHelmet && <group name="worker-hard-hat" position={[0, 0.48, 0]}>
        <mesh scale={[1, 0.65, 1.05]}>
          <sphereGeometry args={[0.36, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f4c631" roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.015, 0.035]} scale={[1, 1, 1.12]}>
          <cylinderGeometry args={[0.43, 0.43, 0.055, 24]} />
          <meshStandardMaterial color="#e5ae18" roughness={0.58} />
        </mesh>
        <mesh position={[0, 0.21, 0]}>
          <boxGeometry args={[0.055, 0.075, 0.54]} />
          <meshStandardMaterial color="#ffd94b" roughness={0.5} />
        </mesh>
      </group>}
      <group position={[0, 0.47, 0.37]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.1, 20]} />
          <meshStandardMaterial color="#3d4649" metalness={0.45} roughness={0.32} />
        </mesh>
        <mesh name="worker-headlamp-lens" position={[0, 0, 0.056]}>
          <circleGeometry args={[0.084, 20]} />
          <meshStandardMaterial color="#fff8d7" emissive="#fff1a8" emissiveIntensity={3} toneMapped={false} />
        </mesh>
      </group>
      <primitive object={target} position={[0, 0.25, 12]} />
      <spotLight
        name="worker-headlamp-light"
        position={[0, 0.47, 0.45]}
        target={target}
        color="#fff1bd"
        intensity={85}
        distance={35}
        angle={Math.PI / 7}
        penumbra={0.45}
        decay={1.4}
      />
    </group>
  );
}

