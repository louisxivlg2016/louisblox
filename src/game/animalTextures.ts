import { CanvasTexture, Color, MeshLambertMaterial, NearestFilter, SRGBColorSpace } from 'three';

const materials = new Map<string, MeshLambertMaterial>();

export function animalMaterial(color: string) {
  const cached = materials.get(color);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d')!;
  const base = new Color(color);
  for (let x = 0; x < 16; x += 1) {
    for (let y = 0; y < 16; y += 1) {
      const variation = (((x * 17 + y * 31 + x * y * 7) % 13) - 6) * 0.006;
      context.fillStyle = base.clone().offsetHSL(0, 0, variation).getStyle();
      context.fillRect(x, y, 1, 1);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  const material = new MeshLambertMaterial({ map: texture });
  materials.set(color, material);
  return material;
}
