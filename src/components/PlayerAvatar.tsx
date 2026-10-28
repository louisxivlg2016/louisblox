import { useQueryFirst } from 'koota/react';
import { animalMaterial } from '../game/animalTextures';
import { useGameStore } from '../game/store';
import { Player, PlayerMesh } from '../game/traits';

function Part({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <mesh position={position} material={animalMaterial(color)} dispose={null}>
      <boxGeometry args={size} />
    </mesh>
  );
}

export function PlayerAvatar() {
  const entity = useQueryFirst(Player);
  const cameraMode = useGameStore((state) => state.cameraMode);
  if (!entity) return null;

  return (
    <group
      ref={(group) => {
        const holder = entity.get(PlayerMesh);
        if (holder) holder.value = group;
      }}
      visible={cameraMode === 'third'}
    >
      <Part position={[0, 1.08, 0]} size={[0.56, 0.66, 0.32]} color="#4d83a7" />
      <Part position={[0, 1.7, 0]} size={[0.48, 0.48, 0.48]} color="#e7a0aa" />
      <Part position={[0, 1.96, 0]} size={[0.5, 0.1, 0.5]} color="#49382f" />
      <Part position={[-0.11, 1.74, -0.25]} size={[0.09, 0.07, 0.025]} color="#f4f4ed" />
      <Part position={[0.11, 1.74, -0.25]} size={[0.09, 0.07, 0.025]} color="#f4f4ed" />
      <Part position={[-0.11, 1.74, -0.27]} size={[0.035, 0.05, 0.02]} color="#273b4b" />
      <Part position={[0.11, 1.74, -0.27]} size={[0.035, 0.05, 0.02]} color="#273b4b" />
      <Part position={[0, 1.62, -0.27]} size={[0.1, 0.08, 0.08]} color="#d98e9b" />
      <Part position={[-0.39, 1.07, 0]} size={[0.19, 0.66, 0.21]} color="#e7a0aa" />
      <Part position={[0.39, 1.07, 0]} size={[0.19, 0.66, 0.21]} color="#e7a0aa" />
      <Part position={[-0.15, 0.4, 0]} size={[0.23, 0.76, 0.27]} color="#354d6d" />
      <Part position={[0.15, 0.4, 0]} size={[0.23, 0.76, 0.27]} color="#354d6d" />
      <Part position={[-0.15, 0.07, -0.04]} size={[0.25, 0.14, 0.34]} color="#302b2b" />
      <Part position={[0.15, 0.07, -0.04]} size={[0.25, 0.14, 0.34]} color="#302b2b" />
    </group>
  );
}
