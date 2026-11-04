import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, CanvasTexture, Mesh, NearestFilter, SRGBColorSpace, Vector3 } from 'three';
import type { Texture } from 'three';
import raceCarUrl from '../../assets/models/raceCar.glb';
import blueCarUrl from '../../assets/models/blueCar.glb';
import airplaneUrl from '../../assets/models/airplane.glb';
import trainUrl from '../../assets/models/train.glb';
import { BoatModel, CarModel } from './ItemModel';
import { PLANE_SCALE } from '../game/vehicles';

const models = {
  raceCar: raceCarUrl,
  blueCar: blueCarUrl,
  airplane: airplaneUrl,
  train: trainUrl,
};
const dimensions = {
  raceCar: [3, 2.6, 5.5],
  blueCar: [3.6, 3.4, 6.6],
  airplane: [7.2 * PLANE_SCALE, 2.5 * PLANE_SCALE, 8.2 * PLANE_SCALE],
  train: [2.8, 3.2, 10.5],
} as const;

function blueCarTexture(source: Texture) {
  const image = source.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    if (red < pixels.data[index + 1] + 3 || red < pixels.data[index + 2] + 3) continue;
    const brightness = Math.max(red, pixels.data[index + 1], pixels.data[index + 2]) / 255;
    pixels.data[index] = 52 * brightness;
    pixels.data[index + 1] = 124 * brightness;
    pixels.data[index + 2] = 208 * brightness;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function raceCarTexture(source: Texture, color: string) {
  const image = source.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const value = Number.parseInt(color.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  for (let index = 0; index < pixels.data.length; index += 4) {
    const r = pixels.data[index];
    const g = pixels.data[index + 1];
    const b = pixels.data[index + 2];
    if (g < r * 1.08 || b < r * 1.08 || g + b < 110 || Math.abs(g - b) > 110) continue;
    const brightness = Math.max(r, g, b) / 255;
    pixels.data[index] = red * brightness;
    pixels.data[index + 1] = green * brightness;
    pixels.data[index + 2] = blue * brightness;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function Model({ kind, color, interior }: { kind: 'car' | 'plane' | 'train' | 'boat'; color: string; interior: boolean }) {
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
        if (interior) {
          material.transparent = true;
          material.opacity = Math.min(material.opacity, kind === 'car' ? 0.03 : 0.18);
          material.depthWrite = false;
        }
        if (!material.map) continue;
        if (modelKind === 'blueCar') material.map = blueCarTexture(material.map);
        else if (modelKind === 'raceCar') material.map = raceCarTexture(material.map, color);
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    const quarterTurn = modelKind === 'train';
    if (modelKind === 'raceCar') clone.rotation.y = Math.PI / 2;
    if (modelKind === 'airplane') clone.rotation.y = -Math.PI / 2;
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
  }, [scene, modelKind, interior, kind, color]);
  return <primitive object={model} />;
}

export function VehicleGlb({ kind, color, interior = false }: { kind: 'car' | 'plane' | 'train' | 'boat'; color: string; interior?: boolean }) {
  if (kind === 'boat') return <group scale={[1.2, 1.2, 1.45]}><BoatModel color={color} /></group>;
  if (interior && kind === 'plane') return null;
  return (
    <Suspense fallback={kind === 'car' ? <CarModel color={color} /> : null}>
      <Model kind={kind} color={color} interior={interior} />
    </Suspense>
  );
}
