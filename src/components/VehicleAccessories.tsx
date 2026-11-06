import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, CanvasTexture, Mesh, NearestFilter, SRGBColorSpace } from 'three';
import type { Group } from 'three';
import type { Entity } from 'koota';
import { PixelPart } from './ItemModel';
import { VehicleMotion } from '../game/traits';
import type { VehicleKind } from '../game/vehicleTypes';
import { useVehicleControls } from '../game/vehicleControls';
import policeCarUrl from '../../assets/models/police-car.glb';
import fireTruckUrl from '../../assets/models/fire-truck.glb';

const emergencyModels = { police: policeCarUrl, firetruck: fireTruckUrl };
for (const model of Object.values(emergencyModels)) useGLTF.preload(model);

function labelTexture(text: string, color = '#ffffff', background?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, 256, 64);
  }
  context.fillStyle = color;
  context.font = 'bold 38px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 128, 34);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function Label({ text, position, rotation = [0, 0, 0], size = [2, 0.5], color = '#ffffff', background }: { text: string; position: [number, number, number]; rotation?: [number, number, number]; size?: [number, number]; color?: string; background?: string }) {
  const texture = useMemo(() => labelTexture(text, color, background), [text, color, background]);
  return <mesh position={position} rotation={rotation}><planeGeometry args={size} /><meshBasicMaterial map={texture} transparent depthWrite={false} /></mesh>;
}

function Wheel({ position, radius = 0.65, register }: { position: [number, number, number]; radius?: number; register: (group: Group | null) => void }) {
  return (
    <group ref={register} position={position} name="animated-wheel">
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index / 12 * Math.PI * 2;
        return <PixelPart key={index} position={[0, Math.sin(angle) * radius, Math.cos(angle) * radius]} size={[0.42, 0.32, 0.32]} color="#24272c" />;
      })}
      <PixelPart position={[0, 0, 0]} size={[0.46, radius * 1.55, 0.16]} color="#916c3b" />
      <PixelPart position={[0, 0, 0]} size={[0.46, 0.16, radius * 1.55]} color="#916c3b" />
      <PixelPart position={[0, 0, 0]} size={[0.5, 0.28, 0.28]} color="#a9b2b5" />
    </group>
  );
}

function Wheels({ width, length, register, radius = 0.65 }: { width: number; length: number; radius?: number; register: (index: number) => (group: Group | null) => void }) {
  return <>{[-1, 1].flatMap((side) => [-1, 1].map((end) => <Wheel key={`${side}-${end}`} position={[side * width, radius, end * length]} radius={radius} register={register(side * 2 + end + 3)} />))}</>;
}

function Glass({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return <mesh position={position}><boxGeometry args={size} /><meshLambertMaterial color="#8ab7d2" transparent opacity={0.42} depthWrite={false} /></mesh>;
}

function EmergencyLights({ police, top = 2.94 }: { police: boolean; top?: number }) {
  const enabled = useVehicleControls((state) => police ? state.police : state.firetruck);
  const red = useRef<Group>(null);
  const blue = useRef<Group>(null);
  useFrame(({ clock }) => {
    const alternate = Math.floor(clock.elapsedTime * 5) % 2 === 0;
    if (red.current) red.current.visible = !enabled || alternate;
    if (blue.current) blue.current.visible = !enabled || !alternate;
  });
  return (
    <group name="emergency-lights" position={[0, top - 2.94, 0]}>
      <PixelPart position={[0, 2.77, -1.35]} size={[1.75, 0.14, 0.48]} color="#3a444c" />
      <group ref={red} name="red-beacon"><PixelPart position={[-0.55, 2.96, -1.35]} size={[0.56, 0.27, 0.43]} color={police ? '#ef3b3b' : '#e83e35'} /></group>
      <group ref={blue} name="blue-beacon"><PixelPart position={[0.55, 2.96, -1.35]} size={[0.56, 0.27, 0.43]} color="#3875ef" /></group>
      <PixelPart position={[0, 2.94, -1.35]} size={[0.3, 0.22, 0.42]} color="#e9edf0" />
    </group>
  );
}

function HunyuanRoadVehicle({ entity, kind, interior }: { entity: Entity; kind: 'police' | 'firetruck'; interior: boolean }) {
  const { scene } = useGLTF(emergencyModels[kind]);
  const { model, top } = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (interior) {
          material.transparent = true;
          material.opacity = 0.12;
          material.depthWrite = false;
        }
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    const bounds = new Box3().setFromObject(clone);
    clone.position.y -= bounds.min.y;
    return { model: clone, top: bounds.max.y - bounds.min.y };
  }, [scene, kind, interior]);
  useFrame((_, delta) => {
    const speed = entity.get(VehicleMotion)?.speed ?? 0;
    model.traverse((object) => {
      if (object.name.startsWith('animated-wheel')) object.rotation.x += speed * delta / 0.75;
    });
  });
  return <group name={`${kind}-reference-model`} userData={{ source: 'Hunyuan' }}><primitive object={model} /><EmergencyLights police={kind === 'police'} top={top} /></group>;
}

function RoadVehicle({ kind, register }: { kind: 'jeep' | 'police' | 'firetruck'; register: (index: number) => (group: Group | null) => void }) {
  const fire = kind === 'firetruck';
  const police = kind === 'police';
  const body = fire ? '#d63632' : police ? '#e2e7e7' : '#777b43';
  return (
    <group name={`${kind}-reference-model`}>
      <Wheels width={fire ? 1.5 : 1.36} length={fire ? 2.3 : 1.85} register={register} />
      <PixelPart position={[0, 1.02, 0]} size={[fire ? 3.05 : 2.65, 0.62, fire ? 6.2 : 5.1]} color={police ? '#272d36' : body} />
      <PixelPart position={[0, 1.45, fire ? -1.45 : -1.2]} size={[fire ? 2.85 : 2.45, 0.42, 1.8]} color={police ? '#242a33' : body} />
      <PixelPart position={[0, 1.5, fire ? 1.55 : 1.05]} size={[fire ? 2.85 : 2.4, 0.95, fire ? 2.6 : 1.8]} color={body} />
      <PixelPart position={[0, 2.58, fire ? -1.35 : 0.05]} size={[fire ? 2.75 : 2.36, 0.2, fire ? 2.15 : 2.35]} color={body} />
      {[-1, 1].map((side) => <PixelPart key={side} position={[side * (fire ? 1.36 : 1.19), 1.95, fire ? -1.35 : 0.05]} size={[0.16, 1.05, fire ? 2.15 : 2.3]} color={body} />)}
      <Glass position={[0, 2.02, fire ? -2.46 : -1.12]} size={[fire ? 2.42 : 2.12, 0.86, 0.06]} />
      {[-1, 1].map((side) => <Glass key={side} position={[side * (fire ? 1.47 : 1.28), 2.02, fire ? -1.35 : 0.05]} size={[0.04, 0.83, fire ? 1.75 : 1.9]} />)}
      <PixelPart position={[0, 1.03, fire ? -3.15 : -2.58]} size={[fire ? 1.5 : 1.25, 0.55, 0.08]} color="#242a30" />
      {Array.from({ length: 7 }, (_, index) => <PixelPart key={index} position={[(index - 3) * 0.19, 1.04, fire ? -3.21 : -2.64]} size={[0.07, 0.5, 0.04]} color="#a9b4b8" />)}
      {[-1, 1].map((side) => <PixelPart key={side} position={[side * (fire ? 1.1 : 0.94), 1.22, fire ? -3.21 : -2.65]} size={[0.38, 0.29, 0.07]} color="#fff0b2" />)}
      {fire && <>
        <PixelPart position={[0, 3, 1.3]} size={[0.75, 0.16, 5.2]} color="#a6b1b7" />
        {[-1, 1].map((side) => <PixelPart key={side} position={[side * 0.38, 3.18, 1.3]} size={[0.11, 0.28, 5.2]} color="#c3cdd1" />)}
        {Array.from({ length: 12 }, (_, index) => <PixelPart key={index} position={[0, 3.18, -1.1 + index * 0.43]} size={[0.8, 0.1, 0.1]} color="#bec9ce" />)}
        {[-1, 1].map((side) => <group key={side}><PixelPart position={[side * 1.52, 1.55, 1.3]} size={[0.05, 0.16, 2.6]} color="#f6d548" /><PixelPart position={[side * 1.53, 1.78, 1.3]} size={[0.05, 0.14, 2.6]} color="#f0f1e9" /><Label text="FIRE" position={[side * 1.55, 1.96, 1.1]} rotation={[0, side * Math.PI / 2, 0]} size={[1.6, 0.45]} /></group>)}
      </>}
      {police && <>
        {[-1, 1].map((side) => <group key={side}><Label text="POLICE" position={[side * 1.345, 1.35, 0.1]} rotation={[0, side * Math.PI / 2, 0]} size={[1.95, 0.46]} color="#202c42" /><Label text="911" position={[side * 1.35, 1.2, 1.94]} rotation={[0, side * Math.PI / 2, 0]} size={[0.85, 0.4]} /></group>)}
      </>}
      {kind === 'jeep' && <><PixelPart position={[0, 1.55, 2.42]} size={[1.05, 1.05, 0.35]} color="#292d30" /><PixelPart position={[0, 1.55, 2.62]} size={[0.44, 0.44, 0.08]} color="#83864a" /><PixelPart position={[0, 2.59, -0.78]} size={[2.4, 0.15, 0.15]} color="#737743" /><Glass position={[0, 2.08, -0.82]} size={[2.16, 0.86, 0.05]} /></>}
      {kind !== 'jeep' && <EmergencyLights police={police} />}
    </group>
  );
}

function HarnessHorse({ entity, x, phase }: { entity: Entity; x: number; phase: number }) {
  const legs = useRef<Group>(null);
  useFrame(({ clock }) => {
    const moving = Math.abs(entity.get(VehicleMotion)?.speed ?? 0) > 0.05;
    if (legs.current) legs.current.rotation.x = moving ? Math.sin(clock.elapsedTime * 8 + phase) * 0.3 : 0;
  });
  return (
    <group position={[x, 0, -4.5]} name="harness-horse">
      <PixelPart position={[0, 1.15, 0]} size={[0.72, 0.72, 1.45]} color="#825439" />
      <PixelPart position={[0, 1.48, -0.62]} size={[0.45, 0.82, 0.42]} color="#8d5d3f" />
      <PixelPart position={[0, 1.85, -0.92]} size={[0.53, 0.52, 0.72]} color="#966443" />
      <PixelPart position={[0, 1.65, -1.3]} size={[0.48, 0.3, 0.32]} color="#c49675" />
      {[-1, 1].map((side) => <group key={side}><PixelPart position={[side * 0.2, 2.2, -0.83]} size={[0.12, 0.34, 0.13]} color="#785039" /><PixelPart position={[side * 0.28, 1.98, -1.09]} size={[0.04, 0.07, 0.07]} color="#161d21" /></group>)}
      <PixelPart position={[0, 1.72, -0.51]} size={[0.55, 0.62, 0.1]} color="#3b2d27" />
      <PixelPart position={[0, 1.1, 0.92]} size={[0.17, 0.68, 0.19]} color="#3d2c25" />
      <PixelPart position={[0, 1.52, -0.94]} size={[0.58, 0.1, 0.75]} color="#272e37" />
      <group ref={legs}>
        {[-1, 1].flatMap((side) => [-1, 1].map((end) => <group key={`${side}-${end}`}><PixelPart position={[side * 0.24, 0.48, end * 0.47]} size={[0.18, 0.78, 0.2]} color="#805238" /><PixelPart position={[side * 0.24, 0.1, end * 0.47]} size={[0.22, 0.19, 0.25]} color="#27272a" /></group>))}
      </group>
    </group>
  );
}

function Carriage({ entity, interior, register }: { entity: Entity; interior: boolean; register: (index: number) => (group: Group | null) => void }) {
  return (
    <group name="carriage-reference-model">
      <HarnessHorse entity={entity} x={-0.8} phase={0} /><HarnessHorse entity={entity} x={0.8} phase={Math.PI} />
      {[-1, 1].map((side) => <PixelPart key={side} position={[side * 0.65, 1.25, -3.3]} size={[0.055, 0.055, 3.4]} color="#392e27" />)}
      <Wheels width={1.38} length={1.45} register={register} radius={0.82} />
      <PixelPart position={[0, 0.88, 0.2]} size={[2.5, 0.26, 3.7]} color="#9b7634" />
      <PixelPart position={[0, 1.12, -2]} size={[2.1, 0.3, 0.9]} color="#2b2a2b" />
      <PixelPart position={[0, 1.46, -1.67]} size={[2.1, 0.7, 0.16]} color="#34353b" />
      <PixelPart position={[0, 3.05, 0.65]} size={[2.5, 0.25, 2.6]} color="#25272c" />
      <PixelPart position={[0, 3.2, 0.65]} size={[2.55, 0.09, 2.65]} color="#e5bb40" />
      {[-1, 1].flatMap((side) => [-0.55, 1.8].map((z) => <group key={`${side}-${z}`}><PixelPart position={[side * 1.13, 2, z]} size={[0.2, 2, 0.2]} color="#e2b33c" /><PixelPart position={[side * 1.24, 2.72, z]} size={[0.2, 0.35, 0.2]} color="#ffce54" /><PixelPart position={[side * 1.24, 2.35, z]} size={[0.21, 0.34, 0.21]} color="#f1a443" /></group>))}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 1.1, 2, 0.65]}><boxGeometry args={[0.12, 1.8, 2.25]} /><meshLambertMaterial color="#282932" transparent={interior} opacity={interior ? 0.08 : 1} /></mesh>)}
      <PixelPart position={[0, 1.85, 1.84]} size={[2.2, 1.45, 0.16]} color="#302d32" />
      <PixelPart position={[0, 2.03, -0.56]} size={[2.2, 0.85, 0.14]} color="#302d32" />
    </group>
  );
}

function Cannon({ register }: { register: (index: number) => (group: Group | null) => void }) {
  return (
    <group name="cannon-reference-model" scale={1.2}>
      <Wheels width={1.02} length={0.3} register={register} radius={0.78} />
      <PixelPart position={[0, 0.72, 0.4]} size={[1.35, 0.44, 2.3]} color="#6d4829" />
      <PixelPart position={[0, 1.1, 0.4]} size={[0.74, 0.45, 1.7]} color="#7f532b" />
      <PixelPart position={[0, 1.52, -0.85]} size={[0.78, 0.74, 3.7]} color="#353d46" />
      <PixelPart position={[0, 1.55, -2.7]} size={[0.92, 0.87, 0.35]} color="#48525b" />
      <PixelPart position={[0, 1.55, -2.89]} size={[0.61, 0.57, 0.04]} color="#121a22" />
      {[-0.35, -1.35, -2.3].map((z) => <PixelPart key={z} position={[0, 1.52, z]} size={[0.86, 0.82, 0.16]} color="#c3943e" />)}
      <PixelPart position={[0, 1.92, 0.75]} size={[0.08, 0.46, 0.08]} color="#929da3" />
      <PixelPart position={[0, 2.14, 0.75]} size={[0.15, 0.08, 0.15]} color="#e6b64f" />
      {[-1, 1].map((side) => <PixelPart key={side} position={[side * 0.4, 1.14, 1.62]} size={[0.1, 0.1, 0.7]} color="#6c777d" />)}
    </group>
  );
}

function PlaneDetails() {
  return (
    <group name="plane-livery">
      {[-1, 1].map((side) => <group key={side}>
        <Label text="louis blox" position={[side * 155, 163, -407]} rotation={[0, side * Math.PI / 2, 0]} size={[116, 26]} color="#8b60cb" />
        {Array.from({ length: 16 }, (_, index) => <group key={index} position={[side * 155, 125, -330 + index * 17]}>
          <PixelPart position={[0, 0, 0]} size={[0.8, 27, 18]} color="#c6d4d8" />
          <PixelPart position={[side * 0.44, 0, 0]} size={[0.2, 22, 14]} color="#355773" />
          <PixelPart position={[side * 0.56, 7, -4]} size={[0.15, 4, 3]} color="#b3e4f1" />
          <PixelPart position={[side * 0.56, -7, 4]} size={[0.15, 2, 3]} color="#82b8d3" />
        </group>)}
      </group>)}
    </group>
  );
}

export function VehicleAccessories({ entity, kind, interior = false }: { entity: Entity; kind: VehicleKind; interior?: boolean }) {
  const wheels = useRef<Array<Group | null>>([]);
  useFrame((_, delta) => {
    const speed = entity.get(VehicleMotion)?.speed ?? 0;
    for (const wheel of wheels.current) {
      if (wheel && kind !== 'cannon') wheel.rotation.x += speed * delta / 0.75;
    }
  });
  const register = (index: number) => (group: Group | null) => { wheels.current[index] = group; };
  if (kind === 'plane') return <PlaneDetails />;
  if (kind === 'carriage') return <Carriage entity={entity} interior={interior} register={register} />;
  if (kind === 'cannon') return <Cannon register={register} />;
  if (kind === 'police' || kind === 'firetruck') return <HunyuanRoadVehicle entity={entity} kind={kind} interior={interior} />;
  if (kind === 'jeep') return <RoadVehicle kind={kind} register={register} />;
  return null;
}
