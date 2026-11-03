import { Box3, CanvasTexture, Color, NearestFilter, SRGBColorSpace, Vector3 } from 'three';
import type { BufferGeometry, Material } from 'three';
import type { CharacterAppearance } from './appearance';

function maskCanvas(geometry: BufferGeometry, bounds: Box3, hair: boolean, width: number, height: number, flipY: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  if (!uv) return context;
  const size = bounds.getSize(new Vector3());
  const count = geometry.index?.count ?? position.count;
  context.fillStyle = '#ffffff';
  for (let offset = 0; offset < count; offset += 3) {
    const indices = [geometry.index?.getX(offset) ?? offset, geometry.index?.getX(offset + 1) ?? offset + 1, geometry.index?.getX(offset + 2) ?? offset + 2];
    const x = indices.reduce((sum, index) => sum + position.getX(index), 0) / 3;
    const y = indices.reduce((sum, index) => sum + position.getY(index), 0) / 3;
    const horizontal = Math.abs(x) < size.x * 0.4;
    const head = horizontal && y > bounds.min.y + size.y * 0.68;
    const arm = Math.abs(x) > size.x * 0.25 && y > bounds.min.y + size.y * 0.28 && y < bounds.min.y + size.y * 0.82;
    const leg = horizontal && y < bounds.min.y + size.y * 0.48;
    const visible = hair
      ? horizontal && y > bounds.min.y + size.y * 0.67
      : head || arm || leg;
    if (!visible) continue;
    context.beginPath();
    indices.forEach((index, corner) => {
      const px = uv.getX(index) * width;
      const py = (flipY ? 1 - uv.getY(index) : uv.getY(index)) * height;
      if (corner === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.closePath();
    context.fill();
  }
  return context;
}

function skinPixel(red: number, green: number, blue: number) {
  return red > 115 && green > 65 && blue > 55 && red > green * 1.06 && green > blue * 1.1 && red - green < 125 && green - blue < 105;
}

function hairPixel(red: number, green: number, blue: number, allowGrayHair: boolean) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const brown = red > green * 1.06 && green > blue * 1.1 && red < 190 && blue < 110;
  const gray = allowGrayHair && maximum - minimum < 45 && maximum > 85;
  const gold = red > 150 && green > 95 && blue < Math.min(red, green) * 0.62 && green > blue * 1.5;
  return (brown || gray) && !gold && maximum > 30;
}

export function colorCharacterMaterial(source: Material & { map?: import('three').Texture | null }, geometry: BufferGeometry, bounds: Box3, appearance: Pick<CharacterAppearance, 'skinColor' | 'hairColor'>, allowGrayHair = false) {
  const material = source.clone();
  const image = material.map?.image as { width?: number; height?: number } | undefined;
  if (!material.map || !image?.width || !image.height || !geometry.getAttribute('uv')) return material;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(material.map.image as CanvasImageSource, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const skinMask = maskCanvas(geometry, bounds, false, canvas.width, canvas.height, material.map.flipY).getImageData(0, 0, canvas.width, canvas.height).data;
  const hairMask = maskCanvas(geometry, bounds, true, canvas.width, canvas.height, material.map.flipY).getImageData(0, 0, canvas.width, canvas.height).data;
  const skin = new Color(appearance.skinColor).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const hair = new Color(appearance.hairColor).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const brightness = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
    const factor = Math.min(1.35, 0.65 + brightness * 0.65);
    const target = skinMask[index + 3] > 0 && skinPixel(red, green, blue) ? skin : hairMask[index + 3] > 0 && hairPixel(red, green, blue, allowGrayHair) ? hair : null;
    if (!target) continue;
    pixels.data[index] = Math.min(255, target.r * 255 * factor);
    pixels.data[index + 1] = Math.min(255, target.g * 255 * factor);
    pixels.data[index + 2] = Math.min(255, target.b * 255 * factor);
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = material.map.colorSpace;
  texture.wrapS = material.map.wrapS;
  texture.wrapT = material.map.wrapT;
  texture.flipY = material.map.flipY;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  material.map = texture;
  material.needsUpdate = true;
  return material;
}
