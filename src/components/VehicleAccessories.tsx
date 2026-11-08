import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, CanvasTexture, DoubleSide, Mesh, NearestFilter, Raycaster, SRGBColorSpace, Vector3 } from 'three';
import type { Group } from 'three';
import type { Entity } from 'koota';
import { PixelPart } from './ItemModel';
import { VehicleMotion } from '../game/traits';
import { CABINS, PLANE_SCALE, type VehicleKind } from '../game/vehicleTypes';
import airplaneUrl from '../../assets/models/airplane.glb';
import { useVehicleControls } from '../game/vehicleControls';
import policeCarUrl from '../../assets/models/police-car.glb';
import fireTruckUrl from '../../assets/models/fire-truck.glb';
import jeepUrl from '../../assets/models/reference-jeep.glb';
import carriageUrl from '../../assets/models/reference-carriage.glb';
import cannonUrl from '../../assets/models/reference-cannon.glb';
import horseUrl from '../../assets/models/reference-horse.glb';

const vehicleModels = { police: policeCarUrl, firetruck: fireTruckUrl, jeep: jeepUrl, carriage: carriageUrl, cannon: cannonUrl };
type VehicleModelKind = keyof typeof vehicleModels;
for (const model of Object.values(vehicleModels)) useGLTF.preload(model);
useGLTF.preload(horseUrl);

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
    clone.rotation.y = kind === 'carriage' ? -Math.PI / 2 : kind === 'jeep' ? Math.PI : Math.PI / 2;
    const bounds = new Box3().setFromObject(clone);
    clone.position.y -= bounds.min.y;
    return { model: clone, top: bounds.max.y - bounds.min.y };
  }, [scene, kind, interior]);
  return <group name={`${kind}-reference-model`} userData={{ source: 'Hunyuan' }}><primitive object={model} />{kind === 'firetruck' && <EmergencyLights top={top} />}</group>;
}

function HarnessHorse({ entity, x, phase }: { entity: Entity; x: number; phase: number }) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF(horseUrl);
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
    const bounds = new Box3().setFromObject(clone);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const scale = 2.15 / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return clone;
  }, [scene]);
  useFrame(({ clock }) => {
    const moving = Math.abs(entity.get(VehicleMotion)?.speed ?? 0) > 0.05;
    const swing = moving ? Math.sin(clock.elapsedTime * 8 + phase) * 0.4 : 0;
    for (let index = 0; index < 4; index += 1) {
      const leg = group.current?.getObjectByName(`animal-leg-${index}`);
      if (leg) leg.rotation.x = swing * (index % 2 === 0 ? 1 : -1);
    }
  });
  return <group ref={group} position={[x, 0, -4.1]} rotation={[0, Math.PI, 0]} name="harness-horse" userData={{ source: 'Hunyuan' }}><primitive object={model} /></group>;
}

function planeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 20;
  const context = canvas.getContext('2d')!;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const radius = ((x - 7.5) / 7.5) ** 2 + ((y - 9.5) / 9.5) ** 2;
      if (radius > 1) continue;
      context.fillStyle = radius > 0.76 ? x + y < 17 ? '#c4d0d5' : '#84959f'
        : radius > 0.57 ? '#344652'
          : x >= 4 && x <= 5 && y >= 4 && y <= 6 || x >= 10 && x <= 11 && y >= 14 && y <= 15 ? '#b2d8e6'
            : y < 10 ? '#567b95' : '#2a465f';
      context.fillRect(x, y, 1, 1);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function PlaneDetails() {
  const { scene } = useGLTF(airplaneUrl);
  const surfaceAt = useMemo(() => {
    const model = scene.clone(true);
    model.rotation.y = -Math.PI / 2;
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    model.scale.set(7.2 * PLANE_SCALE / Math.max(size.x, 0.001), 2.5 * PLANE_SCALE / Math.max(size.y, 0.001), 8.2 * PLANE_SCALE / Math.max(size.z, 0.001));
    center.multiply(model.scale);
    model.position.set(-center.x, -bounds.min.y * model.scale.y, -center.z);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => {
        const clone = material.clone();
        clone.side = DoubleSide;
        return clone;
      }) : object.material.clone();
    });
    model.updateMatrixWorld(true);
    const cabin = CABINS.plane!;
    const raycaster = new Raycaster();
    return (side: number, z: number) => {
      raycaster.set(new Vector3(0, cabin.floor + 1.45, z), new Vector3(side, 0, 0));
      const hit = raycaster.intersectObject(model, true)[0];
      return hit ? Math.abs(hit.point.x) : cabin.halfWidth + 0.1;
    };
  }, [scene]);
  const cabin = CABINS.plane!;
  const y = cabin.floor + 1.45;
  const windowTexture = useMemo(planeWindowTexture, []);
  return (
    <group name="plane-livery">
      {[-1, 1].map((side) => <group key={side}>
        <Label text="louis blox" position={[side * (surfaceAt(side, cabin.front + 1.5) + 0.06), y, cabin.front + 1.5]} rotation={[0, side * Math.PI / 2, 0]} size={[4.2, 0.72]} color="#8b60cb" />
        {Array.from({ length: 14 }, (_, index) => {
          const z = cabin.front + 2 + index * 1.7;
          const x = surfaceAt(side, z);
          return <mesh key={index} name="plane-window" position={[side * (x + 0.07), y, z]} rotation={[0, side * Math.PI / 2, 0]}>
            <planeGeometry args={[1.25, 1.1]} />
            <meshBasicMaterial map={windowTexture} transparent depthWrite={false} />
          </mesh>;
        })}
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
