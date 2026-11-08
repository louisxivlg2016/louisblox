import { useEffect, useMemo } from 'react';
import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';
import { PixelPart } from './ItemModel';
import { PARIS_STREET_SIGN_TEXT } from '../game/extraBlocks';

function parisSignTexture(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const district = (lines.length > 1 ? lines[0] : '4e arrondissement').toLocaleUpperCase('fr-FR');
  const street = (lines.length > 1 ? lines.slice(1).join(' ') : lines[0] || 'Rue de la Paix').toLocaleUpperCase('fr-FR');
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 104;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#164a72';
  context.fillRect(0, 0, 256, 104);
  context.strokeStyle = '#eef4e9';
  context.lineWidth = 3;
  context.strokeRect(3, 3, 250, 98);
  context.strokeStyle = '#0a304e';
  context.lineWidth = 2;
  context.strokeRect(8, 8, 240, 88);
  context.fillStyle = '#123f63';
  context.fillRect(10, 10, 236, 23);
  context.fillStyle = '#f4f7ef';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 15px monospace';
  context.fillText(district, 128, 22, 230);
  let size = 27;
  context.font = `bold ${size}px monospace`;
  while (context.measureText(street).width > 232 && size > 11) {
    size -= 1;
    context.font = `bold ${size}px monospace`;
  }
  context.fillText(street, 128, 66, 232);
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function ParisStreetSignModel({ text = PARIS_STREET_SIGN_TEXT, held = false }: { text?: string; held?: boolean }) {
  const texture = useMemo(() => parisSignTexture(text), [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group name="paris-street-sign" scale={held ? 0.65 : 1}>
      <PixelPart position={[0, 0.5, 0]} size={[1, 0.7, 0.06]} color="#183e32" />
      <mesh name="paris-street-plaque" position={[0, 0.5, 0.033]}>
        <planeGeometry args={[0.96, 0.66]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
