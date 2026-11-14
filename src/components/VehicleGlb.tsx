import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, NearestFilter, Vector3 } from 'three';
import raceCarUrl from '../../assets/models/raceCar.glb';
import blueCarUrl from '../../assets/models/blueCar.glb';
import airplaneUrl from '../../assets/models/airplane.glb';
import trainUrl from '../../assets/models/train.glb';
import { BoatModel, CarModel } from './ItemModel';
import { PLANE_SCALE } from '../game/vehicles';
import type { VehicleKind } from '../game/vehicleTypes';
import { VehicleAccessories } from './VehicleAccessories';

const models = {
  raceCar: raceCarUrl,
  blueCar: blueCarUrl,
  airplane: airplaneUrl,
  train: trainUrl,
};
const dimensions = {
  raceCar: [2.6, 2.2, 4.8],
  blueCar: [2.6, 2.2, 4.8],
  airplane: [7.2 * PLANE_SCALE, 2.5 * PLANE_SCALE, 8.2 * PLANE_SCALE],
  train: [3, 4.2, 8.5],
} as const;

function Model({ kind, color, interior, showOccupants }: { kind: 'car' | 'plane' | 'train' | 'boat'; color: string; interior: boolean; showOccupants: boolean }) {
  const modelKind = kind === 'car' && color.toLowerCase() === '#347cd0' ? 'blueCar' : kind === 'car' ? 'raceCar' : kind === 'plane' ? 'airplane' : 'train';
  const { scene } = useGLTF(models[modelKind]);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.name = modelKind;
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (interior || showOccupants) {
          material.transparent = true;
          material.opacity = Math.min(material.opacity, interior ? kind === 'car' ? 0.03 : 0.18 : 0.38);
          material.depthWrite = false;
        }
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    const quarterTurn = modelKind === 'train';
    if (modelKind === 'raceCar' || modelKind === 'blueCar') clone.rotation.y = Math.PI / 2;
    if (modelKind === 'airplane') clone.rotation.y = Math.PI / 2;
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const [width, height, length] = dimensions[modelKind];
    const [localWidth, localLength] = quarterTurn ? [length, width] : [width, length];
    clone.scale.set(localWidth / Math.max(size.x, 0.001), height / Math.max(size.y, 0.001), localLength / Math.max(size.z, 0.001));
    center.multiply(clone.scale);
    if (quarterTurn) {
      center.applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      clone.rotation.y = Math.PI / 2;
    }
    clone.position.set(-center.x, -box.min.y * clone.scale.y, -center.z);
    return clone;
  }, [scene, modelKind, interior, kind, showOccupants]);
  return <primitive object={model} />;
}

export function VehicleGlb({ entity, kind, color, interior = false, showOccupants = false }: { entity: import('koota').Entity; kind: VehicleKind; color: string; interior?: boolean; showOccupants?: boolean }) {
  if (kind === 'boat') return <group scale={[1.2, 1.2, 1.45]}><BoatModel color={color} /></group>;
  if (kind === 'police' || kind === 'firetruck') return <Suspense fallback={null}><VehicleAccessories entity={entity} kind={kind} interior={interior} showOccupants={showOccupants} /></Suspense>;
  if (kind === 'jeep' || kind === 'carriage' || kind === 'cannon') return <VehicleAccessories entity={entity} kind={kind} interior={interior} showOccupants={showOccupants} />;
  return (
    <Suspense fallback={kind === 'car' ? <CarModel color={color} /> : null}>
      {!interior || kind !== 'plane' ? <Model kind={kind} color={color} interior={interior} showOccupants={showOccupants} /> : null}
      <VehicleAccessories entity={entity} kind={kind} showOccupants={showOccupants} />
    </Suspense>
  );
}
