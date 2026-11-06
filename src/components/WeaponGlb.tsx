import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { CanvasTexture, Color, Mesh, NearestFilter } from 'three';
import type { Texture } from 'three';
import { usePaintballStore } from '../game/paintball';
import autoRifleUrl from '../../assets/models/weapon-auto-rifle.glb';
import bombLauncherUrl from '../../assets/models/weapon-bomb-launcher.glb';
import pistolUrl from '../../assets/models/weapon-pistol.glb';
import paintballUrl from '../../assets/models/weapon-paintball.glb';

const models = { 'auto-rifle': autoRifleUrl, 'bomb-launcher': bombLauncherUrl, pistol: pistolUrl, paintball: paintballUrl };
for (const model of Object.values(models)) useGLTF.preload(model);

type WeaponKind = keyof typeof models;

function recolorTexture(source: Texture, metalColor?: string, paintColor?: string): Texture {
  if (!metalColor && !paintColor) return source;
  const image = source.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const metal = metalColor ? new Color(metalColor).getRGB({ r: 0, g: 0, b: 0 }) : null;
  const paint = paintColor ? new Color(paintColor).getRGB({ r: 0, g: 0, b: 0 }) : null;
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const maximum = Math.max(red, green, blue);
    const brightness = maximum / 255;
    const yellow = red > 110 && green > 110 && blue < Math.min(red, green) * 0.85;
    const neutral = maximum - Math.min(red, green, blue) < 50 && brightness > 0.12;
    const target = paint && yellow ? paint : metal && neutral ? metal : null;
    if (!target) continue;
    pixels.data[index] = Math.min(255, target.r * 255 * brightness);
    pixels.data[index + 1] = Math.min(255, target.g * 255 * brightness);
    pixels.data[index + 2] = Math.min(255, target.b * 255 * brightness);
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = source.colorSpace;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  texture.flipY = source.flipY;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function WeaponGlb({ kind, metalColor }: { kind: WeaponKind; metalColor?: string }) {
  const paintColor = usePaintballStore((state) => kind === 'paintball' ? state.color : undefined);
  const { scene } = useGLTF(models[kind]);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.name = `weapon-${kind}`;
    clone.userData.source = 'Hunyuan';
    if (paintColor) clone.userData.paintColor = paintColor;
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material.map) continue;
        material.map = recolorTexture(material.map, metalColor, paintColor);
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    return clone;
  }, [scene, kind, metalColor, paintColor]);
  return <primitive object={model} />;
}

export function WeaponWithFallback(props: Parameters<typeof WeaponGlb>[0]) {
  return <Suspense fallback={null}><WeaponGlb {...props} /></Suspense>;
}
