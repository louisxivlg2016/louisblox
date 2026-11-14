import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, NearestFilter, Vector3 } from 'three';
import type { Group } from 'three';
import type { Entity } from 'koota';
import { VehicleMotion } from '../game/traits';
import type { VehicleKind } from '../game/vehicleTypes';
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

function HunyuanVehicle({ kind, interior, showOccupants }: { kind: VehicleModelKind; interior: boolean; showOccupants: boolean }) {
  const { scene } = useGLTF(vehicleModels[kind]);
  const model = useMemo(() => {
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
    clone.rotation.y = kind === 'carriage' || kind === 'cannon' ? -Math.PI / 2 : kind === 'jeep' || kind === 'firetruck' || kind === 'police' ? Math.PI : Math.PI / 2;
    const bounds = new Box3().setFromObject(clone);
    const targetLength = kind === 'police' ? 4.8 : kind === 'firetruck' ? 6.5 : null;
    if (targetLength !== null) {
      const size = bounds.getSize(new Vector3());
      const center = bounds.getCenter(new Vector3());
      const scale = targetLength / Math.max(size.x, size.y, size.z, 0.001);
      clone.scale.setScalar(scale);
      center.multiplyScalar(scale).applyAxisAngle(new Vector3(0, 1, 0), clone.rotation.y);
      clone.position.set(-center.x, -bounds.min.y * scale, -center.z);
    } else {
      clone.position.y -= bounds.min.y;
    }
    return clone;
  }, [scene, kind, interior, showOccupants]);
  return <group name={`${kind}-reference-model`} userData={{ source: 'Hunyuan' }}><primitive object={model} /></group>;
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
