import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, BoxGeometry, CanvasTexture, DataTexture, Mesh, MeshLambertMaterial, NearestFilter, RepeatWrapping, RGBAFormat, Vector3 } from 'three';
import type { Texture } from 'three';
import raceCarUrl from '../../assets/models/raceCar.glb';
import blueCarUrl from '../../assets/models/blueCar.glb';
import airplaneUrl from '../../assets/models/airplane.glb';
import metroUrl from '../../assets/models/metro.glb';
import trainUrl from '../../assets/models/train.glb';
import { BoatModel, CarModel } from './ItemModel';
import { METRO_LENGTH, PLANE_SCALE, TRAIN_LENGTH } from '../game/vehicles';
import type { VehicleKind } from '../game/vehicleTypes';
import { VehicleAccessories } from './VehicleAccessories';
import { PlaneTitle } from './PlaneTitle';
import { PoliceTitle } from './PoliceTitle';

const models = {
  raceCar: raceCarUrl,
  blueCar: blueCarUrl,
  airplane: airplaneUrl,
  train: trainUrl,
  metro: metroUrl,
};
const bluePixelData = new Uint8Array(16 * 16 * 4);
for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) {
  const index = (y * 16 + x) * 4;
  const shade = 210 + ((x * 37 + y * 61 + x * y) % 5) * 9;
  bluePixelData[index] = shade;
  bluePixelData[index + 1] = shade;
  bluePixelData[index + 2] = shade;
  bluePixelData[index + 3] = 255;
}
const bluePixelTexture = new DataTexture(bluePixelData, 16, 16, RGBAFormat);
bluePixelTexture.magFilter = NearestFilter;
bluePixelTexture.minFilter = NearestFilter;
bluePixelTexture.generateMipmaps = false;
bluePixelTexture.wrapS = RepeatWrapping;
bluePixelTexture.wrapT = RepeatWrapping;
bluePixelTexture.repeat.set(2, 2);
bluePixelTexture.needsUpdate = true;

function pixelCarTexture(source: Texture) {
  const image = source.image as { width?: number; height?: number } | undefined;
  if (!image?.width || !image.height) return source;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  context.drawImage(source.image as CanvasImageSource, 0, 0, 32, 32);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = source.colorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

const dimensions = {
  raceCar: [2.6, 2.2, 4.8],
  blueCar: [2.15, 2.05, 5.1],
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
      const partName = object.name.replaceAll('_', ' ').toLowerCase();
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        if (modelKind === 'blueCar' && partName === 'front windshield') {
          material.transparent = true;
          material.opacity = 0.28;
          material.depthWrite = false;
        }
        if (modelKind === 'blueCar' && !material.map) material.map = bluePixelTexture;
        if (!material.map) continue;
        if (kind === 'car') material.map = pixelCarTexture(material.map);
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
      if (modelKind === 'blueCar' && partName.startsWith('dark bumper')) object.scale.y *= 0.25;
      if (modelKind === 'blueCar' && partName === 'strong black chassis') object.scale.y *= 0.6;
    });
    if (modelKind === 'blueCar') {
      const glass = new MeshLambertMaterial({ color: '#9fd3e5', transparent: true, opacity: 0.28, depthWrite: false });
      for (const side of [-1, 1]) {
        const window = new Mesh(new BoxGeometry(0.035, 1.05, 2.35), glass);
        window.name = 'blue-side-window';
        window.position.set(side * 1.46, 2.42, 0);
        clone.add(window);
      }
      const rear = new Mesh(new BoxGeometry(2.75, 1.05, 0.035), glass);
      rear.name = 'blue-rear-window';
      rear.position.set(0, 2.42, -1.29);
      clone.add(rear);
    }
    const uniformScale = modelKind === 'metro' || modelKind === 'train';
    const quarterTurn = modelKind === 'raceCar' || modelKind === 'airplane';
    const targetLength = modelKind === 'train' ? TRAIN_LENGTH : METRO_LENGTH;
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const [width, height, length] = dimensions[modelKind];
    const [localWidth, localLength] = uniformScale ? [length, width] : [width, length];
    clone.scale.set(uniformScale ? targetLength / Math.max(size.x, size.y, size.z, 0.001) : quarterTurn ? localLength / Math.max(size.x, 0.001) : localWidth / Math.max(size.x, 0.001), uniformScale ? targetLength / Math.max(size.x, size.y, size.z, 0.001) : height / Math.max(size.y, 0.001), uniformScale ? targetLength / Math.max(size.x, size.y, size.z, 0.001) : quarterTurn ? localWidth / Math.max(size.z, 0.001) : localLength / Math.max(size.z, 0.001));
    if (modelKind === 'raceCar') clone.rotation.y = Math.PI / 2;
    if (modelKind === 'blueCar') clone.rotation.y = Math.PI;
    if (modelKind === 'airplane') clone.rotation.y = Math.PI / 2;
    center.multiply(clone.scale).applyAxisAngle(new Vector3(0, 1, 0), uniformScale ? Math.PI : clone.rotation.y);
    if (uniformScale) clone.rotation.y = Math.PI;
    clone.position.set(-center.x, -box.min.y * clone.scale.y, -center.z);
    return clone;
  }, [scene, modelKind, interior, kind]);
  return <primitive object={model} />;
}

export function VehicleGlb({ entity, kind, color, interior = false }: { entity: import('koota').Entity; kind: VehicleKind; color: string; interior?: boolean }) {
  if (kind === 'boat') return <group scale={[1.2, 1.2, 1.45]}><BoatModel color={color} hovercraft /></group>;
  if (kind === 'police' || kind === 'firetruck') return <Suspense fallback={null}><VehicleAccessories entity={entity} kind={kind} interior={interior} />{!interior && kind === 'police' && <PoliceTitle />}</Suspense>;
  if (kind === 'jeep' || kind === 'carriage' || kind === 'cannon') return <VehicleAccessories entity={entity} kind={kind} interior={interior} />;
  return (
    <Suspense fallback={kind === 'car' ? <CarModel color={color} /> : null}>
      {!interior || kind !== 'plane' && kind !== 'train' && kind !== 'metro' && kind !== 'car' ? <Model kind={kind} color={color} interior={interior} /> : null}
      <VehicleAccessories entity={entity} kind={kind} />
      {!interior && kind === 'plane' && <PlaneTitle />}
    </Suspense>
  );
}
