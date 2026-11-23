function pixelDataUrl(source: CanvasImageSource, width: number, height: number, scale: number) {
  const small = document.createElement('canvas');
  small.width = width;
  small.height = height;
  const smallContext = small.getContext('2d')!;
  smallContext.imageSmoothingEnabled = false;
  smallContext.drawImage(source, 0, 0, width, height);
  const output = document.createElement('canvas');
  output.width = width * scale;
  output.height = height * scale;
  const outputContext = output.getContext('2d')!;
  outputContext.imageSmoothingEnabled = false;
  outputContext.drawImage(small, 0, 0, output.width, output.height);
  return output.toDataURL('image/png');
}

export async function fileToPixelDataUrl(file: File, width = 96, height = 64, scale = 3) {
  if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('Choose a PNG, JPEG, GIF, or WebP image smaller than 8 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    return pixelDataUrl(bitmap, width, height, scale);
  } finally {
    bitmap.close();
  }
}

export async function captureGamePhoto() {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas canvas');
  if (!canvas || canvas.width === 0 || canvas.height === 0) throw new Error('The game is not ready for a photo.');
  const bitmap = await createImageBitmap(canvas);
  const width = 160;
  const height = Math.max(1, Math.round(width * canvas.height / canvas.width));
  try {
    const url = pixelDataUrl(bitmap, width, height, 4);
    const link = document.createElement('a');
    link.href = url;
    link.download = `louisblox-photo-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.png`;
    link.click();
    return url;
  } finally {
    bitmap.close();
  }
}
