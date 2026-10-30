import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { useWorld } from 'koota/react';
import { Color } from 'three';
import { getBlockIndex, loadLevel } from '../game/chunks';
import { readWorldSave } from '../game/save';
import { useGameStore } from '../game/store';
import { BlockKind, voxelKey } from '../game/voxel';
import { Animals } from './Animals';
import { Explosions } from './Explosions';
import { Hands } from './Hands';
import { Level } from './Level';
import { MeatDrops } from './MeatDrops';
import { PlayerView } from './Player';
import { Projectiles } from './Projectiles';
import { Systems } from './Systems';
import { TargetHighlight } from './TargetHighlight';
import { Vehicles } from './Vehicles';
import { Weather } from './Weather';
import { Fires } from './Fires';
import { Fish } from './Fish';
import { RemoteAvatars } from './Multiplayer';

const clouds = [
  [-15, 20, -18, 1.2],
  [10, 23, -24, 1.5],
  [22, 19, 4, 1],
  [-24, 22, 12, 1.4],
  [2, 25, 20, 1.1],
] as const;

function Clouds({ daylight }: { daylight: number }) {
  const color = daylight > 0.35 ? '#f4fbff' : '#40516a';
  return (
    <group>
      {clouds.map(([x, y, z, scale], index) => (
        <group key={index} position={[x, y, z]} scale={scale}>
          <mesh><boxGeometry args={[5, 1, 2]} /><meshLambertMaterial color={color} /></mesh>
          <mesh position={[-1.5, 0.7, 0]}><boxGeometry args={[2, 1, 2]} /><meshLambertMaterial color={color} /></mesh>
          <mesh position={[1, 0.5, 0]}><boxGeometry args={[2.5, 1, 2]} /><meshLambertMaterial color={color} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Atmosphere() {
  const environment = useGameStore((state) => state.environment);
  const camera = useThree((state) => state.camera);
  const world = useWorld();
  const angle = (environment.dayProgress - 0.25) * Math.PI * 2;
  const daylight = Math.max(0.08, Math.min(1, Math.sin(angle) * 0.9 + 0.3));
  const rainy = environment.weather !== 'clear';
  const skyDaylight = Math.max(0, (daylight - 0.2) / 0.8);
  const center = camera.position;
  const cameraBlock = getBlockIndex(world).get(voxelKey(Math.floor(center.x + 0.5), Math.floor(center.y + 0.5), Math.floor(center.z + 0.5)));
  const underwater = cameraBlock?.kind === BlockKind.Water;
  const waterColor = new Color('#217fac');
  const skyColor = underwater
    ? waterColor
    : rainy
      ? new Color('#46515b').lerp(new Color('#89949c'), daylight)
      : new Color('#000000').lerp(new Color('#55b5ef'), skyDaylight);
  const fogColor = underwater
    ? waterColor
    : rainy
      ? new Color('#56616a').lerp(new Color('#9aa4ab'), daylight)
      : new Color('#000000').lerp(new Color('#8bc8ed'), skyDaylight);
  const sunPosition: [number, number, number] = [center.x + Math.cos(angle) * 100, center.y + Math.sin(angle) * 100, center.z - 50];
  const moonPosition: [number, number, number] = [center.x - Math.cos(angle) * 100, center.y - Math.sin(angle) * 100, center.z - 50];
  const sunVisible = !underwater && !rainy && Math.sin(angle) > -0.05;
  const moonVisible = !underwater && !rainy && Math.sin(angle) < 0.05;

  return (
    <>
      <color attach="background" args={[skyColor]} />
      <fog attach="fog" args={[fogColor, underwater ? 0.1 : rainy ? 26 : 45, underwater ? 18 : rainy ? 90 : 130]} />
      <hemisphereLight args={['#d9f0ff', '#617043', 0.25 + daylight * 1.55]} />
      <directionalLight position={daylight > 0.25 ? sunPosition : moonPosition} intensity={0.08 + daylight * 2} color={daylight > 0.3 ? '#fff5d9' : '#91a9d4'} />
      <mesh position={sunPosition} visible={sunVisible}>
        <sphereGeometry args={[5, 24, 16]} />
        <meshBasicMaterial color="#ffe58a" fog={false} />
      </mesh>
      <mesh position={moonPosition} visible={moonVisible}>
        <sphereGeometry args={[4, 20, 14]} />
        <meshBasicMaterial color="#e5edff" fog={false} />
      </mesh>
      <Clouds daylight={daylight} />
    </>
  );
}

export function Game() {
  const world = useWorld();
  const generation = useGameStore((state) => state.generation);
  const mode = useGameStore((state) => state.mode);
  const level = useMemo(() => loadLevel(world, generation, readWorldSave()), [world, generation]);

  return (
    <>
      <Atmosphere />
      <Weather key={`weather-${generation}`} />
      <Animals key={`animals-${generation}`} />
      <Fish key={`fish-${generation}`} />
      <Vehicles key={`vehicles-${generation}`} />
      <Fires key={`fires-${generation}`} />
      <Projectiles key={`projectiles-${generation}`} />
      <MeatDrops key={`meat-${generation}`} />
      <Explosions key={`explosions-${generation}`} />
      <Physics gravity={[0, 0, 0]} paused={mode !== 'play'}>
        <Level key={`level-${generation}`} />
        <PlayerView key={`player-${generation}`} />
        <TargetHighlight key={`target-${generation}`} />
        <Systems key={`systems-${generation}`} spawn={level.spawn} />
      </Physics>
      <RemoteAvatars key={`multiplayer-${generation}`} />
      <Hands />
    </>
  );
}
