import { Box3, CanvasTexture, Color, NearestFilter, SRGBColorSpace, Vector3 } from 'three';
import type { BufferGeometry, Material } from 'three';
import type { CharacterAppearance } from './appearance';

type MaskRegion = 'skin' | 'skin-soft' | 'hair' | 'eyes' | 'eyebrows' | 'uniform' | 'sleeves' | 'forearms' | 'classic-boy-band';

function maskCanvas(geometry: BufferGeometry, bounds: Box3, region: MaskRegion, width: number, height: number, flipY: boolean, princessHair = false, frontSign = 1, eyeBottom = 0.69, eyeTop = 0.697) {
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
    const z = indices.reduce((sum, index) => sum + position.getZ(index), 0) / 3;
    const vertical = (y - bounds.min.y) / size.y;
    const horizontal = Math.abs(x) < size.x * 0.4;
    const head = horizontal && vertical > 0.68;
    const arm = Math.abs(x) > size.x * 0.25 && vertical > 0.28 && vertical < 0.82;
    const leg = horizontal && vertical < 0.48;
    const eyes = z * frontSign > 0 && Math.abs(x) > size.x * 0.035 && Math.abs(x) < size.x * 0.14 && vertical > eyeBottom && vertical < eyeTop;
    const eyebrows = z * frontSign > 0 && Math.abs(x) > size.x * 0.025 && Math.abs(x) < size.x * 0.25 && vertical > 0.68 && vertical < 0.735;
    const lowerStrand = princessHair && z * frontSign > 0 && Math.abs(x) > size.x * 0.13 && Math.abs(x) < size.x * 0.33 && vertical > 0.38 && vertical < 0.7;
    const visible = region === 'classic-boy-band'
      ? horizontal && vertical > 0.34 && vertical < 0.76
      : region === 'uniform'
        ? vertical > 0.36 && vertical < 0.67
      : region === 'sleeves'
        ? arm && vertical >= 0.53
      : region === 'forearms'
        ? arm && vertical < 0.53
      : region === 'eyes'
        ? eyes
      : region === 'eyebrows'
        ? eyebrows
        : region === 'hair'
          ? horizontal && (vertical > 0.67 || lowerStrand) && !eyes
          : region === 'skin-soft'
            ? (head && vertical < 0.82 && !lowerStrand) || arm || leg
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

function detectFaceFront(geometry: BufferGeometry, bounds: Box3, pixels: Uint8ClampedArray, width: number, height: number, flipY: boolean) {
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  if (!uv) return 1;
  const size = bounds.getSize(new Vector3());
  const scores = { front: 0, back: 0 };
  for (let offset = 0; offset < (geometry.index?.count ?? position.count); offset += 3) {
    const indices = [geometry.index?.getX(offset) ?? offset, geometry.index?.getX(offset + 1) ?? offset + 1, geometry.index?.getX(offset + 2) ?? offset + 2];
    const x = indices.reduce((sum, index) => sum + position.getX(index), 0) / 3;
    const y = indices.reduce((sum, index) => sum + position.getY(index), 0) / 3;
    const z = indices.reduce((sum, index) => sum + position.getZ(index), 0) / 3;
    const vertical = (y - bounds.min.y) / size.y;
    if (Math.abs(x) > size.x * 0.3 || vertical < 0.65 || vertical > 0.85) continue;
    const u = indices.reduce((sum, index) => sum + uv.getX(index), 0) / 3;
    const v = indices.reduce((sum, index) => sum + uv.getY(index), 0) / 3;
    const px = Math.max(0, Math.min(width - 1, Math.floor(u * width)));
    const py = Math.max(0, Math.min(height - 1, Math.floor((flipY ? 1 - v : v) * height)));
    const index = (py * width + px) * 4;
    if (pixels[index + 3] < 128) continue;
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const exposedSkin = red > 75 && green > 42 && blue > 32 && red > green * 1.03 && green > blue * 1.04 && red - green < 115;
    const eyeWhite = vertical > 0.65 && vertical < 0.73 && Math.min(red, green, blue) > 140;
    if (exposedSkin || eyeWhite) scores[z >= 0 ? 'front' : 'back'] += exposedSkin ? 2 : 0.5;
  }
  return scores.back > scores.front ? -1 : 1;
}

function skinPixel(red: number, green: number, blue: number, relaxed = false) {
  if (relaxed) return red > 45 && green > 25 && blue > 16 && red > green * 0.98 && green > blue * 1.03 && red < green * 2.4 && green < blue * 2.2;
  return red > 115 && green > 65 && blue > 55 && red > green * 1.06 && green > blue * 1.1 && red - green < 125 && green - blue < 105;
}

function hairPixel(red: number, green: number, blue: number, allowGrayHair: boolean, allowGoldHair = false) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const brown = red > green * 1.06 && green > blue * 1.1 && red < 190 && blue < 110;
  const gray = allowGrayHair && maximum - minimum < 45 && maximum > 85;
  const gold = red > 150 && green > 80 && red > green * 1.01 && green > blue * 1.35;
  if (gold) return allowGoldHair;
  return (brown || gray) && maximum > 30;
}

function irisPixel(red: number, green: number, blue: number) {
  const maximum = Math.max(red, green, blue);
  return maximum > 24 && maximum < 215 && !skinPixel(red, green, blue);
}

function eyebrowPixel(red: number, green: number, blue: number) {
  const maximum = Math.max(red, green, blue);
  return maximum > 8 && maximum < 190 && red >= blue * 0.85 && green >= blue * 0.85;
}

export function removeClassicBoyBand(source: Material & { map?: import('three').Texture | null }, geometry: BufferGeometry, bounds: Box3) {
  const material = source.clone();
  const image = material.map?.image as { width?: number; height?: number } | undefined;
  if (!material.map || !image?.width || !image.height || !geometry.getAttribute('uv')) return material;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(material.map.image as CanvasImageSource, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const mask = maskCanvas(geometry, bounds, 'classic-boy-band', canvas.width, canvas.height, material.map.flipY).getImageData(0, 0, canvas.width, canvas.height).data;
  const shirt = new Color('#526b45').getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  let removed = 0;
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (mask[index + 3] === 0) continue;
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    if (!hairPixel(red, green, blue, false) || skinPixel(red, green, blue)) continue;
    const brightness = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
    const factor = 0.8 + brightness * 0.45;
    pixels.data[index] = Math.min(255, shirt.r * 255 * factor);
    pixels.data[index + 1] = Math.min(255, shirt.g * 255 * factor);
    pixels.data[index + 2] = Math.min(255, shirt.b * 255 * factor);
    removed += 1;
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
  material.userData.removedBandPixels = removed;
  material.needsUpdate = true;
  return material;
}

export function colorCharacterMaterial(source: Material & { map?: import('three').Texture | null }, geometry: BufferGeometry, bounds: Box3, appearance: Pick<CharacterAppearance, 'skinColor' | 'hairColor' | 'eyeColor' | 'eyebrowColor' | 'clothingColor' | 'originalHairColor' | 'originalSkinColor'>, allowGrayHair = false, princessHair = false, outfit?: import('./outfits').OutfitKind | 'classic-girl' | 'classic-boy') {
  const material = source.clone();
  const image = material.map?.image as { width?: number; height?: number } | undefined;
  if (!material.map || !image?.width || !image.height || !geometry.getAttribute('uv')) return material;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(material.map.image as CanvasImageSource, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const frontSign = detectFaceFront(geometry, bounds, pixels.data, canvas.width, canvas.height, material.map.flipY);
  const skinMask = maskCanvas(geometry, bounds, 'skin', canvas.width, canvas.height, material.map.flipY, false, frontSign).getImageData(0, 0, canvas.width, canvas.height).data;
  const softSkinMask = maskCanvas(geometry, bounds, 'skin-soft', canvas.width, canvas.height, material.map.flipY, false, frontSign).getImageData(0, 0, canvas.width, canvas.height).data;
  const hairMask = maskCanvas(geometry, bounds, 'hair', canvas.width, canvas.height, material.map.flipY, princessHair, frontSign).getImageData(0, 0, canvas.width, canvas.height).data;
  const eyeMask = maskCanvas(geometry, bounds, 'eyes', canvas.width, canvas.height, material.map.flipY, false, frontSign, outfit === 'princess' ? 0.79 : 0.69, outfit === 'princess' ? 0.85 : outfit === 'classic-girl' ? 0.72 : 0.697).getImageData(0, 0, canvas.width, canvas.height).data;
  const eyeAreaMask = maskCanvas(geometry, bounds, 'eyes', canvas.width, canvas.height, material.map.flipY, false, frontSign, outfit === 'princess' ? 0.7 : 0.655, outfit === 'princess' ? 0.87 : 0.697).getImageData(0, 0, canvas.width, canvas.height).data;
  const eyebrowMask = maskCanvas(geometry, bounds, 'eyebrows', canvas.width, canvas.height, material.map.flipY, false, frontSign).getImageData(0, 0, canvas.width, canvas.height).data;
  const eyeDetails = new Uint8Array(canvas.width * canvas.height);
  const eyeRadius = Math.max(2, Math.round(canvas.width / 85));
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (eyeAreaMask[index + 3] === 0 || Math.min(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]) < 110) continue;
    const x = index / 4 % canvas.width;
    const y = Math.floor(index / 4 / canvas.width);
    for (let dy = -eyeRadius; dy <= eyeRadius; dy += 1) {
      for (let dx = -eyeRadius; dx <= eyeRadius; dx += 1) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) eyeDetails[py * canvas.width + px] = 1;
      }
    }
  }
  material.userData.faceFrontSign = frontSign;
  const skin = appearance.originalSkinColor || outfit === 'knight' ? null : new Color(appearance.skinColor).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const hair = appearance.originalHairColor || outfit === 'knight' || outfit === 'trader' || outfit === 'firefighter' ? null : new Color(appearance.hairColor).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const eyes = outfit === 'louis15' ? null : new Color(appearance.eyeColor).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const eyebrows = outfit === 'knight' || outfit === 'firefighter' || outfit === 'trader' ? null : new Color(appearance.eyebrowColor ?? appearance.hairColor).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const uniformColor = appearance.clothingColor ?? (outfit === 'pirate' ? '#b6373b' : outfit === 'footballer' ? '#2868b3' : null);
  const uniform = uniformColor ? new Color(uniformColor).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace) : null;
  const uniformMask = uniform
    ? maskCanvas(geometry, bounds, 'uniform', canvas.width, canvas.height, material.map.flipY, false, frontSign).getImageData(0, 0, canvas.width, canvas.height).data
    : null;
  const sleeveMask = outfit === 'footballer' ? maskCanvas(geometry, bounds, 'sleeves', canvas.width, canvas.height, material.map.flipY, false, frontSign).getImageData(0, 0, canvas.width, canvas.height).data : null;
  const forearmMask = outfit === 'footballer' ? maskCanvas(geometry, bounds, 'forearms', canvas.width, canvas.height, material.map.flipY, false, frontSign).getImageData(0, 0, canvas.width, canvas.height).data : null;
  let eyebrowPixels = 0;
  let skinPixels = 0;
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const brightness = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
    const factor = Math.min(1.35, 0.65 + brightness * 0.65);
    const uniformPixel = uniformMask && uniformMask[index + 3] > 0 && !skinPixel(red, green, blue) && (appearance.clothingColor
      ? brightness < 0.96
      : outfit === 'footballer'
        ? brightness < 0.78
        : Math.max(red, green, blue) > 55 && red > green * 1.08 && green > blue * 1.07);
    const target = sleeveMask && sleeveMask[index + 3] > 0 && uniform
      ? uniform
      : forearmMask && forearmMask[index + 3] > 0 && skin
        ? skin
        : skinMask[index + 3] > 0 && (skinPixel(red, green, blue) || softSkinMask[index + 3] > 0 && skinPixel(red, green, blue, true))
      ? skin
      : eyeMask[index + 3] > 0 && (outfit === 'princess' || outfit === 'classic-girl' || outfit === 'footballer' || outfit === 'police' || eyeDetails[index / 4] > 0) && irisPixel(red, green, blue)
        ? eyes
        : eyebrowMask[index + 3] > 0 && eyebrowPixel(red, green, blue)
          ? eyebrows
          : hairMask[index + 3] > 0 && !skinPixel(red, green, blue) && hairPixel(red, green, blue, allowGrayHair, outfit === 'footballer' || outfit === 'classic-girl') ? hair
            : uniformPixel ? uniform : null;
    if (!target) continue;
    if (target === eyebrows) eyebrowPixels += 1;
    if (target === skin) skinPixels += 1;
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
  material.userData.eyebrowPixels = eyebrowPixels;
  material.userData.skinPixels = skinPixels;
  material.needsUpdate = true;
  return material;
}
