import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTrait } from 'koota/react';
import type { Entity } from 'koota';
import { CanvasTexture, Group, SRGBColorSpace, Sprite } from 'three';
import { AnimalLove, AnimalTame } from '../game/traits';

function drawHeart(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.beginPath();
  context.moveTo(x, y + size * 0.3);
  context.bezierCurveTo(x, y, x - size * 0.5, y, x - size * 0.5, y + size * 0.3);
  context.bezierCurveTo(x - size * 0.5, y + size * 0.58, x, y + size * 0.82, x, y + size);
  context.bezierCurveTo(x, y + size * 0.82, x + size * 0.5, y + size * 0.58, x + size * 0.5, y + size * 0.3);
  context.bezierCurveTo(x + size * 0.5, y, x, y, x, y + size * 0.3);
  context.fill();
}

function heartTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ff355e';
  drawHeart(context, 32, 8, 48);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function AnimalFriendship({ entity }: { entity: Entity }) {
  const tame = useTrait(entity, AnimalTame);
  const love = useTrait(entity, AnimalLove);
  const particles = useRef<Group>(null);
  const hearts = useRef<Array<Sprite | null>>([]);
  const texture = useMemo(heartTexture, []);
  const label = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 112;
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return { canvas, map };
  }, []);

  useEffect(() => () => {
    texture.dispose();
    label.map.dispose();
  }, [texture, label]);

  useEffect(() => {
    if (!tame?.tamed) return;
    const context = label.canvas.getContext('2d')!;
    context.clearRect(0, 0, 512, 112);
    context.fillStyle = 'rgba(20, 25, 34, 0.82)';
    context.fillRect(4, 4, 504, 104);
    context.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    context.lineWidth = 4;
    context.strokeRect(6, 6, 500, 100);
    context.fillStyle = '#ff355e';
    drawHeart(context, 62, 25, 58);
    context.fillStyle = '#ffffff';
    context.font = 'bold 38px sans-serif';
    context.textBaseline = 'middle';
    context.fillText(`Amitié ${tame.friendship} · ${tame.happiness} %`, 108, 58);
    label.map.needsUpdate = true;
  }, [label, tame?.tamed, tame?.friendship, tame?.happiness]);

  useFrame(() => {
    const time = entity.get(AnimalLove)?.time ?? 0;
    if (!particles.current) return;
    particles.current.visible = time > 0;
    if (time <= 0) return;
    const progress = 2.4 - time;
    hearts.current.forEach((heart, index) => {
      if (!heart) return;
      heart.position.set((index - 1) * 0.7 + Math.sin(progress * 4 + index) * 0.15, 3 + progress * 0.9 + index * 0.12, 0);
      heart.scale.setScalar(0.48 + Math.sin(progress * 7 + index) * 0.08);
    });
  });

  if (!tame?.tamed && !love) return null;
  return (
    <>
      {tame?.tamed && <sprite position={[0, 3.8, 0]} scale={[3.6, 0.79, 1]} renderOrder={30}>
        <spriteMaterial map={label.map} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>}
      <group ref={particles} visible={false}>
        {[0, 1, 2].map((index) => (
          <sprite key={index} ref={(heart) => { hearts.current[index] = heart; }} renderOrder={31}>
            <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
          </sprite>
        ))}
      </group>
    </>
  );
}
