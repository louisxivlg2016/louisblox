const PNG_PREFIX = 'data:image/png;base64,';
export const PAINTING_IMAGE_SIZE = 32;
export const MAX_PAINTING_IMAGE_LENGTH = 20000;

export function cleanPaintingImage(value: unknown) {
  if (typeof value !== 'string' || value.length > MAX_PAINTING_IMAGE_LENGTH || !value.startsWith(PNG_PREFIX)) return undefined;
  const encoded = value.slice(PNG_PREFIX.length);
  return encoded.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ? value : undefined;
}

export async function pixelatePaintingFile(file: File) {
  if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('format');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = PAINTING_IMAGE_SIZE;
    canvas.height = PAINTING_IMAGE_SIZE;
    const context = canvas.getContext('2d')!;
    context.imageSmoothingEnabled = false;
    context.drawImage(bitmap, 0, 0, PAINTING_IMAGE_SIZE, PAINTING_IMAGE_SIZE);
    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}
