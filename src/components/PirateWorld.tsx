import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Mesh, NearestFilter } from 'three';
import { useGameStore } from '../game/store';
import treasureUrl from '../../assets/models/pirate-treasure.glb';

const TREASURE_LAYOUT = [
  { x: 0, y: 6.5, z: 0, scale: 0.24, objective: true },
  { x: -1, y: 5.5, z: -5, scale: 0.16, objective: false },
  { x: 1, y: 5.5, z: -5, scale: 0.16, objective: false },
  { x: -1, y: 5.5, z: 5, scale: 0.16, objective: false },
  { x: 1, y: 5.5, z: 5, scale: 0.16, objective: false },
] as const;

useGLTF.preload(treasureUrl);

function PirateTreasure({ team, center, index, layout }: { team: 'red' | 'blue'; center: number; index: number; layout: typeof TREASURE_LAYOUT[number] }) {
  const { scene } = useGLTF(treasureUrl);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    return clone;
  }, [scene]);
  return <group name={`pirate-treasure-${team}-${index}`} userData={{ source: 'Hunyuan', objective: layout.objective, team }} position={[center + layout.x, layout.y, layout.z]} scale={layout.scale}><primitive object={model} /></group>;
}

function PirateShip({ team, center }: { team: 'red' | 'blue'; center: number }) {
  return (
    <group name={`pirate-ship-${team}`} userData={{ source: 'Blocs Louisblox', team }}>
      {TREASURE_LAYOUT.map((layout, index) => <PirateTreasure key={`${layout.x},${layout.z}`} team={team} center={center} index={index} layout={layout} />)}
    </group>
  );
}

export function PirateWorld() {
  const gameplayMode = useGameStore((state) => state.gameplayMode);
  if (gameplayMode !== 'pirates') return null;
  return <Suspense fallback={null}><PirateShip team="red" center={-16} /><PirateShip team="blue" center={16} /></Suspense>;
}
