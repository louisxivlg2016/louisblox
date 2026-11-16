import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, NearestFilter, Vector3 } from 'three';
import raceCarUrl from '../../assets/models/raceCar.glb';
import blueCarUrl from '../../assets/models/blueCar.glb';
import airplaneUrl from '../../assets/models/airplane.glb';
import metroUrl from '../../assets/models/metro.glb';
import trainUrl from '../../assets/models/train.glb';
import { BoatModel, CarModel } from './ItemModel';
import { METRO_LENGTH, PLANE_SCALE, TRAIN_LENGTH } from '../game/vehicles';
import type { VehicleKind } from '../game/vehicleTypes';
import { VehicleAccessories } from './VehicleAccessories';

const models = {
  raceCar: raceCarUrl,
  blueCar: blueCarUrl,
  airplane: airplaneUrl,
  train: trainUrl,
  metro: metroUrl,
};
const dimensions = {
  raceCar: [2.6, 2.2, 4.8],
  blueCar: [2.2, 2.35, 5.1],
  airplane: [7.2 * PLANE_SCALE, 2.5 * PLANE_SCALE, 8.2 * PLANE_SCALE],
  train: [1.9, 2.4, TRAIN_LENGTH],
  metro: [2.2, 2.4, METRO_LENGTH],
} as const;

function Model({ kind, color, interior }: { kind: 'car' | 'plane' | 'train' | 'metro' | 'boat'; color: string; interior: boolean }) {
  const modelKind = kind === 'car' && color.toLowerCase() === '#347cd0' ? 'blueCar' : kind === 'car' ? 'raceCar' : kind === 'plane' ? 'airplane' : kind === 'train' ? 'train' : 'metro';
  const { scene } = useGLTF(models[modelKind]);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.name = modelKind;
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    const uniformScale = modelKind === 'metro' || modelKind === 'train';
    const targetLength = modelKind === 'train' ? TRAIN_LENGTH : METRO_LENGTH;
    if (modelKind === 'raceCar') clone.rotation.y = Math.PI / 2;
    if (modelKind === 'blueCar') clone.rotation.y = Math.PI;
    if (modelKind === 'airplane') clone.rotation.y = Math.PI / 2;
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const [width, height, length] = dimensions[modelKind];
    const [localWidth, localLength] = uniformScale ? [length, width] : [width, length];
    clone.scale.set(uniformScale ? targetLength / Math.max(size.x, size.y, size.z, 0.001) : localWidth / Math.max(size.x, 0.001), uniformScale ? targetLength / Math.max(size.x, size.y, size.z, 0.001) : height / Math.max(size.y, 0.001), uniformScale ? targetLength / Math.max(size.x, size.y, size.z, 0.001) : localLength / Math.max(size.z, 0.001));
    center.multiply(clone.scale);
    if (uniformScale) {
      center.applyAxisAngle(new Vector3(0, 1, 0), Math.PI);
      clone.rotation.y = Math.PI;
    }
    clone.position.set(-center.x, -box.min.y * clone.scale.y, -center.z);
    return clone;
  }, [scene, modelKind, interior, kind]);
  return <primitive object={model} />;
}

export function VehicleGlb({ entity, kind, color, interior = false }: { entity: import('koota').Entity; kind: VehicleKind; color: string; interior?: boolean }) {
  if (kind === 'boat') return <group scale={[1.2, 1.2, 1.45]}><BoatModel color={color} /></group>;
  if (kind === 'police' || kind === 'firetruck') return <Suspense fallback={null}><VehicleAccessories entity={entity} kind={kind} interior={interior} /></Suspense>;
  if (kind === 'jeep' || kind === 'carriage' || kind === 'cannon') return <VehicleAccessories entity={entity} kind={kind} interior={interior} />;
  return (
    <Suspense fallback={kind === 'car' ? <CarModel color={color} /> : null}>
      {!interior || kind !== 'plane' ? <Model kind={kind} color={color} interior={interior} /> : null}
      <VehicleAccessories entity={entity} kind={kind} />
    </Suspense>
  );
}
