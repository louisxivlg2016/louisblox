import { CanvasTexture, MeshBasicMaterial, NearestFilter } from 'three';

const paths = [
  [[8, 8], [8, 5], [6, 3], [6, 1]],
  [[8, 8], [5, 9], [3, 12], [1, 12]],
  [[8, 8], [11, 7], [13, 5], [15, 5]],
  [[8, 8], [10, 11], [12, 14], [12, 15]],
  [[8, 5], [10, 3], [12, 2]],
  [[5, 9], [5, 6], [3, 4], [1, 4]],
  [[11, 7], [12, 9], [15, 10]],
  [[10, 11], [8, 13], [7, 15]],
  [[6, 3], [4, 2], [2, 1]],
  [[8, 13], [5, 14], [3, 15]],
] as const;

export function createCrackMaterials() {
  return paths.map((_, stage) => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, 16, 16);
    context.lineCap = 'square';
    const drawPaths = (color: string, width: number) => {
      context.strokeStyle = color;
      context.lineWidth = width;
      for (let index = 0; index <= stage; index += 1) {
        const path = paths[index];
        context.beginPath();
        context.moveTo(path[0][0], path[0][1]);
        for (let point = 1; point < path.length; point += 1) context.lineTo(path[point][0], path[point][1]);
        context.stroke();
      }
    };
    drawPaths('rgba(10, 10, 10, 0.9)', 3);
    drawPaths('rgba(235, 235, 235, 0.72)', 1);
    const texture = new CanvasTexture(canvas);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    return new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  });
}
