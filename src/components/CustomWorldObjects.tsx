import { useEffect, useState } from 'react';
import { CanvasTexture, DoubleSide, NearestFilter, SRGBColorSpace } from 'three';
import { useGameStore } from '../game/store';
import type { CustomCharacter, CustomCharacterKind, CustomWorldImage } from '../game/worldCode';
import { PixelPart } from './ItemModel';

function usePixelTexture(url: string) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  useEffect(() => {
    let active = true;
    let result: CanvasTexture | null = null;
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (!active) return;
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext('2d')!;
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, 32, 32);
      result = new CanvasTexture(canvas);
      result.magFilter = NearestFilter;
      result.minFilter = NearestFilter;
      result.generateMipmaps = false;
      result.colorSpace = SRGBColorSpace;
      setTexture(result);
    };
    image.onerror = () => { if (active) setTexture(null); };
    image.src = url;
    return () => {
      active = false;
      result?.dispose();
    };
  }, [url]);
  return texture;
}

function PixelImage({ image }: { image: CustomWorldImage }) {
  const texture = usePixelTexture(image.url);
  return (
    <mesh name="custom-world-image" position={[image.x, image.y, image.z]} userData={{ url: image.url }}>
      <planeGeometry args={[image.width, image.height]} />
      {texture ? <meshBasicMaterial map={texture} color="#ffffff" transparent alphaTest={0.04} side={DoubleSide} toneMapped={false} /> : <meshBasicMaterial color="#35465c" side={DoubleSide} />}
    </mesh>
  );
}

const styles: Record<CustomCharacterKind, { skin: string; hair: string; body: string; legs: string; accent: string }> = {
  worker: { skin: '#c9926e', hair: '#4c2f1d', body: '#e77d28', legs: '#263b59', accent: '#f3ce35' },
  trader: { skin: '#c9926e', hair: '#e5e0cf', body: '#315a83', legs: '#3c3229', accent: '#e0b43e' },
  princess: { skin: '#e1ac8c', hair: '#6a3c20', body: '#9b4b91', legs: '#71356e', accent: '#f4d35e' },
  knight: { skin: '#c9926e', hair: '#4c2f1d', body: '#89939e', legs: '#4d5662', accent: '#c83d36' },
  pirate: { skin: '#c9926e', hair: '#30251e', body: '#7f3030', legs: '#2f2d36', accent: '#25222a' },
  police: { skin: '#c9926e', hair: '#30251e', body: '#294f7d', legs: '#202e46', accent: '#f1cb3f' },
  explorer: { skin: '#c9926e', hair: '#4c2f1d', body: '#657144', legs: '#4c3c2b', accent: '#9a6b36' },
};

function Accessories({ kind, style }: { kind: CustomCharacterKind; style: (typeof styles)[CustomCharacterKind] }) {
  if (kind === 'worker') return <><PixelPart position={[0, 1.94, 0]} size={[0.58, 0.14, 0.58]} color={style.accent} /><PixelPart position={[0, 2.04, 0]} size={[0.4, 0.14, 0.4]} color={style.accent} /><PixelPart position={[0, 1.05, -0.17]} size={[0.12, 0.62, 0.03]} color="#e5ec45" /></>;
  if (kind === 'trader') return <><PixelPart position={[0, 1.94, 0]} size={[0.6, 0.14, 0.6]} color="#294c74" /><PixelPart position={[0, 1.48, -0.18]} size={[0.36, 0.3, 0.12]} color={style.hair} /><PixelPart position={[0, 1.12, -0.18]} size={[0.12, 0.58, 0.04]} color={style.accent} /></>;
  if (kind === 'princess') return <><PixelPart position={[0, 1.96, 0]} size={[0.52, 0.12, 0.52]} color={style.accent} /><PixelPart position={[0, 1.54, 0.24]} size={[0.5, 0.8, 0.12]} color={style.hair} /><PixelPart position={[0, 1.3, -0.18]} size={[0.2, 0.2, 0.04]} color={style.accent} /></>;
  if (kind === 'knight') return <><PixelPart position={[0, 1.72, 0]} size={[0.56, 0.54, 0.56]} color="#9ca6af" /><PixelPart position={[0, 1.73, -0.29]} size={[0.46, 0.09, 0.04]} color="#313a44" /><PixelPart position={[0, 2.07, 0.05]} size={[0.12, 0.28, 0.18]} color={style.accent} /></>;
  if (kind === 'pirate') return <><PixelPart position={[0, 1.94, 0]} size={[0.72, 0.12, 0.64]} color={style.accent} /><PixelPart position={[0, 2.04, 0.05]} size={[0.42, 0.18, 0.4]} color={style.accent} /><PixelPart position={[0.27, 2.12, 0.06]} size={[0.08, 0.28, 0.08]} color="#eeeeDF" /></>;
  if (kind === 'police') return <><PixelPart position={[0, 1.94, 0]} size={[0.58, 0.14, 0.58]} color="#203b63" /><PixelPart position={[0, 1.89, -0.32]} size={[0.44, 0.06, 0.18]} color="#203b63" /><PixelPart position={[0.14, 1.19, -0.18]} size={[0.1, 0.13, 0.03]} color={style.accent} /></>;
  return <><PixelPart position={[0, 1.94, 0]} size={[0.68, 0.1, 0.62]} color={style.accent} /><PixelPart position={[0, 2.02, 0]} size={[0.44, 0.18, 0.42]} color={style.accent} /></>;
}

function PixelCharacter({ character }: { character: CustomCharacter }) {
  const style = styles[character.kind];
  return (
    <group name={`custom-character-${character.kind}`} position={[character.x, character.y, character.z]} userData={{ characterName: character.name ?? character.kind }}>
      <PixelPart position={[0, 1.68, 0]} size={[0.48, 0.48, 0.48]} color={style.skin} />
      <PixelPart position={[0, 1.92, 0.03]} size={[0.5, 0.1, 0.5]} color={style.hair} />
      <PixelPart position={[-0.11, 1.73, -0.25]} size={[0.08, 0.06, 0.025]} color="#f4f4ed" />
      <PixelPart position={[0.11, 1.73, -0.25]} size={[0.08, 0.06, 0.025]} color="#f4f4ed" />
      <PixelPart position={[-0.11, 1.73, -0.27]} size={[0.035, 0.045, 0.02]} color="#365378" />
      <PixelPart position={[0.11, 1.73, -0.27]} size={[0.035, 0.045, 0.02]} color="#365378" />
      <PixelPart position={[0, 1.07, 0]} size={[0.56, 0.66, 0.32]} color={style.body} />
      <PixelPart position={[-0.39, 1.07, 0]} size={[0.19, 0.66, 0.21]} color={style.skin} />
      <PixelPart position={[0.39, 1.07, 0]} size={[0.19, 0.66, 0.21]} color={style.skin} />
      <PixelPart position={[-0.15, 0.38, 0]} size={[0.23, 0.76, 0.27]} color={style.legs} />
      <PixelPart position={[0.15, 0.38, 0]} size={[0.23, 0.76, 0.27]} color={style.legs} />
      <PixelPart position={[-0.15, 0.06, -0.04]} size={[0.25, 0.14, 0.34]} color="#302b2b" />
      <PixelPart position={[0.15, 0.06, -0.04]} size={[0.25, 0.14, 0.34]} color="#302b2b" />
      <Accessories kind={character.kind} style={style} />
    </group>
  );
}

export function CustomWorldObjects({ preview = false, images, characters }: { preview?: boolean; images?: CustomWorldImage[]; characters?: CustomCharacter[] }) {
  const stored = useGameStore((state) => preview ? null : state.customWorld);
  const template = useGameStore((state) => preview ? null : state.worldTemplate);
  const worldImages = preview ? images ?? [] : template === 'custom' ? stored?.images ?? [] : [];
  const worldCharacters = preview ? characters ?? [] : template === 'custom' ? stored?.characters ?? [] : [];
  return (
    <>
      {worldImages.map((image, index) => <PixelImage key={`${image.x},${image.y},${image.z},${index}`} image={image} />)}
      {worldCharacters.map((character, index) => <PixelCharacter key={`${character.x},${character.y},${character.z},${index}`} character={character} />)}
    </>
  );
}
