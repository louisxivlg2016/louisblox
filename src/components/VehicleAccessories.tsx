import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, NearestFilter, Vector3 } from 'three';
import type { Group } from 'three';
import type { Entity } from 'koota';
import { PixelPart } from './ItemModel';
import { VehicleMotion } from '../game/traits';
import type { VehicleKind } from '../game/vehicleTypes';
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

function HunyuanVehicle({ kind, interior, showOccupants }: { kind: VehicleModelKind; interior: boolean; showOccupants: boolean }) {
  const { scene } = useGLTF(vehicleModels[kind]);
  const { model, top } = useMemo(() => {
    const clone = scene.clone(true);
    clone.name = `${kind}-generated-model`;
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (interior || showOccupants) {
          material.transparent = true;
          material.opacity = interior ? 0.12 : 0.38;
          material.depthWrite = false;
        }
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    clone.rotation.y = kind === 'carriage' || kind === 'cannon' ? -Math.PI / 2 : kind === 'jeep' || kind === 'firetruck' ? Math.PI : Math.PI / 2;
    const bounds = new Box3().setFromObject(clone);
    clone.position.y -= bounds.min.y;
    return { model: clone, top: bounds.max.y - bounds.min.y };
  }, [scene, kind, interior, showOccupants]);
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
  return <group ref={group} position={[x, 0.12, -4.1]} rotation={[0, Math.PI, 0]} name="harness-horse" userData={{ source: 'Hunyuan' }}><primitive object={model} /></group>;
}

export function VehicleAccessories({ entity, kind, interior = false, showOccupants = false }: { entity: Entity; kind: VehicleKind; interior?: boolean; showOccupants?: boolean }) {
  if (kind === 'plane') return null;
  if (kind in vehicleModels) return <>
    <HunyuanVehicle kind={kind as VehicleModelKind} interior={interior} showOccupants={showOccupants} />
    {kind === 'carriage' && <><HarnessHorse entity={entity} x={-0.8} phase={0} /><HarnessHorse entity={entity} x={0.8} phase={Math.PI} /></>}
  </>;
  return null;
}
