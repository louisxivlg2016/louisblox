import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, CanvasTexture, Mesh, NearestFilter, SRGBColorSpace } from 'three';
import type { Group } from 'three';
import type { Entity } from 'koota';
import { PixelPart } from './ItemModel';
import { VehicleMotion } from '../game/traits';
import { PLANE_SCALE, type VehicleKind } from '../game/vehicleTypes';
import { useVehicleControls } from '../game/vehicleControls';
import policeCarUrl from '../../assets/models/police-car.glb';
import fireTruckUrl from '../../assets/models/fire-truck.glb';
import jeepUrl from '../../assets/models/reference-jeep.glb';
import carriageUrl from '../../assets/models/reference-carriage.glb';
import cannonUrl from '../../assets/models/reference-cannon.glb';

const vehicleModels = { police: policeCarUrl, firetruck: fireTruckUrl, jeep: jeepUrl, carriage: carriageUrl, cannon: cannonUrl };
type VehicleModelKind = keyof typeof vehicleModels;
for (const model of Object.values(vehicleModels)) useGLTF.preload(model);

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


function EmergencyLights({ top = 2.94 }: { top?: number }) {
  const enabled = useVehicleControls((state) => state.firetruck);
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
      <group ref={red} name="red-beacon"><PixelPart position={[-0.55, 2.96, -1.35]} size={[0.56, 0.27, 0.43]} color="#e83e35" /></group>
      <group ref={blue} name="blue-beacon"><PixelPart position={[0.55, 2.96, -1.35]} size={[0.56, 0.27, 0.43]} color="#3875ef" /></group>
      <PixelPart position={[0, 2.94, -1.35]} size={[0.3, 0.22, 0.42]} color="#e9edf0" />
    </group>
  );
}

function HunyuanVehicle({ kind, interior }: { kind: VehicleModelKind; interior: boolean }) {
  const { scene } = useGLTF(vehicleModels[kind]);
  const { model, top } = useMemo(() => {
    const clone = scene.clone(true);
    clone.name = `${kind}-generated-model`;
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
    clone.rotation.y = Math.PI / 2;
    const bounds = new Box3().setFromObject(clone);
    clone.position.y -= bounds.min.y;
    return { model: clone, top: bounds.max.y - bounds.min.y };
  }, [scene, kind, interior]);
  return <group name={`${kind}-reference-model`} userData={{ source: 'Hunyuan' }}><primitive object={model} />{kind === 'firetruck' && <EmergencyLights top={top} />}</group>;
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

function PlaneDetails() {
  const scale = PLANE_SCALE / 175;
  return (
    <group name="plane-livery">
      {[-1, 1].map((side) => <group key={side}>
        <Label text="louis blox" position={[side * 155 * scale, 163 * scale, -407 * scale]} rotation={[0, side * Math.PI / 2, 0]} size={[116 * scale, 26 * scale]} color="#8b60cb" />
        {Array.from({ length: 16 }, (_, index) => <group key={index} position={[side * 155 * scale, 125 * scale, (-330 + index * 17) * scale]}>
          <PixelPart position={[0, 0, 0]} size={[0.8 * scale, 27 * scale, 18 * scale]} color="#c6d4d8" />
          <PixelPart position={[side * 0.44 * scale, 0, 0]} size={[0.2 * scale, 22 * scale, 14 * scale]} color="#355773" />
          <PixelPart position={[side * 0.56 * scale, 7 * scale, -4 * scale]} size={[0.15 * scale, 4 * scale, 3 * scale]} color="#b3e4f1" />
          <PixelPart position={[side * 0.56 * scale, -7 * scale, 4 * scale]} size={[0.15 * scale, 2 * scale, 3 * scale]} color="#82b8d3" />
        </group>)}
      </group>)}
    </group>
  );
}

export function VehicleAccessories({ entity, kind, interior = false }: { entity: Entity; kind: VehicleKind; interior?: boolean }) {
  if (kind === 'plane') return <PlaneDetails />;
  if (kind in vehicleModels) return <>
    <HunyuanVehicle kind={kind as VehicleModelKind} interior={interior} />
    {kind === 'carriage' && <><HarnessHorse entity={entity} x={-0.8} phase={0} /><HarnessHorse entity={entity} x={0.8} phase={Math.PI} /></>}
  </>;
  return null;
}
