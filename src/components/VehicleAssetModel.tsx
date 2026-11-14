import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, NearestFilter, Vector3 } from 'three';
import raceCarUrl from '../../assets/models/raceCar.glb';
import blueCarUrl from '../../assets/models/blueCar.glb';
import airplaneUrl from '../../assets/models/airplane.glb';
import trainUrl from '../../assets/models/train.glb';
import policeCarUrl from '../../assets/models/police-car.glb';
import fireTruckUrl from '../../assets/models/fire-truck.glb';
import jeepUrl from '../../assets/models/reference-jeep.glb';
import carriageUrl from '../../assets/models/reference-carriage.glb';
import cannonUrl from '../../assets/models/reference-cannon.glb';
import { PLANE_SCALE } from '../game/vehicleTypes';
import type { VehicleKind } from '../game/vehicleTypes';

const models = {
  raceCar: raceCarUrl,
  blueCar: blueCarUrl,
  airplane: airplaneUrl,
  train: trainUrl,
  police: policeCarUrl,
  firetruck: fireTruckUrl,
  jeep: jeepUrl,
  carriage: carriageUrl,
  cannon: cannonUrl,
};

const dimensions = {
  raceCar: [2.6, 2.2, 4.8],
  blueCar: [2.6, 2.2, 4.8],
  airplane: [7.2 * PLANE_SCALE, 2.5 * PLANE_SCALE, 8.2 * PLANE_SCALE],
  train: [2.8, 3.2, 10.5],
} as const;

type AssetKind = Exclude<VehicleKind, 'boat'>;
type ModelKind = keyof typeof models;

function Asset({ kind, color, preview }: { kind: AssetKind; color: string; preview: boolean }) {
  const modelKind: ModelKind = kind === 'car' ? color.toLowerCase() === '#347cd0' ? 'blueCar' : 'raceCar' : kind === 'plane' ? 'airplane' : kind;
  const { scene } = useGLTF(models[modelKind]);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.name = modelKind;
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
    if (modelKind in dimensions) {
      const quarterTurn = modelKind === 'train';
      if (modelKind === 'raceCar' || modelKind === 'blueCar') clone.rotation.y = Math.PI / 2;
      if (modelKind === 'airplane') clone.rotation.y = -Math.PI / 2;
      const box = new Box3().setFromObject(clone);
      const size = box.getSize(new Vector3());
      const center = box.getCenter(new Vector3());
      const [width, height, length] = dimensions[modelKind as keyof typeof dimensions];
      const [localWidth, localLength] = quarterTurn ? [length, width] : [width, length];
      clone.scale.set(localWidth / Math.max(size.x, 0.001), height / Math.max(size.y, 0.001), localLength / Math.max(size.z, 0.001));
      center.multiply(clone.scale);
      if (quarterTurn) {
        center.applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
        clone.rotation.y = Math.PI / 2;
      }
      clone.position.set(-center.x, -box.min.y * clone.scale.y, -center.z);
    } else {
      clone.rotation.y = modelKind === 'carriage' ? -Math.PI / 2 : modelKind === 'jeep' || modelKind === 'firetruck' ? Math.PI : Math.PI / 2;
      const bounds = new Box3().setFromObject(clone);
      clone.position.y -= bounds.min.y;
    }
    clone.updateMatrixWorld(true);
    return clone;
  }, [scene, modelKind]);
  const scale = useMemo(() => {
    if (!preview) return 1;
    const size = new Box3().setFromObject(model).getSize(new Vector3());
    return 3 / Math.max(size.x, size.y, size.z, 0.001);
  }, [model, preview]);
  return <group name={`${modelKind}-reference-model`} scale={scale}><primitive object={model} /></group>;
}

export function VehicleAssetModel({ kind, color, preview = false }: { kind: AssetKind; color: string; preview?: boolean }) {
  return <Suspense fallback={null}><Asset kind={kind} color={color} preview={preview} /></Suspense>;
}
