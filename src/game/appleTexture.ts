import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';

let cached: CanvasTexture | null = null;

export function appleTexture() {
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d')!;
  const pixel = (x: number, y: number, width: number, height: number, color: string) => {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  };
  pixel(7, 2, 2, 4, '#654126');
  pixel(9, 2, 4, 2, '#438541');
  pixel(10, 1, 2, 1, '#559a4d');
  pixel(6, 4, 5, 1, '#c92d27');
  pixel(4, 5, 9, 1, '#e53830');
  pixel(3, 6, 11, 5, '#e53830');
  pixel(4, 11, 9, 2, '#d92f29');
  pixel(5, 13, 7, 1, '#c92d27');
  pixel(7, 14, 3, 1, '#a92725');
  pixel(4, 6, 3, 3, '#ff8b86');
  pixel(3, 7, 1, 2, '#ffaaa0');
  pixel(10, 6, 3, 5, '#c92d27');
  pixel(9, 11, 3, 2, '#b92725');
  cached = new CanvasTexture(canvas);
  cached.colorSpace = SRGBColorSpace;
  cached.magFilter = NearestFilter;
  cached.minFilter = NearestFilter;
  cached.generateMipmaps = false;
  return cached;
}
