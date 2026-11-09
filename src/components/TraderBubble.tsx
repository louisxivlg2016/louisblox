import { useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import type { Entity } from 'koota';
import { CanvasTexture, NearestFilter, Sprite, SpriteMaterial, SRGBColorSpace } from 'three';
import { MERCHANT_STORIES, useTradeStore } from '../game/trading';
import { PlayerPosition, TraderPosition } from '../game/traits';

function bubbleTexture(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff4d8';
  context.strokeStyle = '#31573d';
  context.lineWidth = 6;
  context.beginPath();
  context.roundRect(5, 5, 502, 166, 16);
  context.fill();
  context.stroke();
  context.fillStyle = '#fff4d8';
  context.beginPath();
  context.moveTo(232, 168);
  context.lineTo(256, 188);
  context.lineTo(278, 168);
  context.fill();
  context.stroke();
  context.fillStyle = '#31573d';
  context.font = 'bold 18px monospace';
  context.textAlign = 'center';
  context.fillText('Marchand', 256, 31);
  context.fillStyle = '#27352b';
  context.font = 'bold 19px monospace';
  context.textAlign = 'left';
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > 464 && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  lines.slice(0, 5).forEach((value, index) => context.fillText(value, 24, 60 + index * 24));
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function TraderBubble({ entity }: { entity: Entity }) {
  const world = useWorld();
  const [near, setNear] = useState(false);
  const traderId = useTradeStore((state) => state.traderId);
  const storyId = useTradeStore((state) => state.storyId);
  const step = useTradeStore((state) => state.step);
  const story = useTradeStore((state) => state.story);
  const following = useTradeStore((state) => state.following);
  const active = traderId === entity;
  const lastStep = MERCHANT_STORIES[storyId].steps.length - 1;
  const text = active
    ? following
      ? MERCHANT_STORIES[storyId].companion
      : step === lastStep ? `${story} Choisis ta réponse ici.` : `${story} E pour la suite.`
    : 'Appuie sur moi pour écouter mon histoire.';
  const sprite = useMemo(() => {
    const material = new SpriteMaterial({ map: bubbleTexture(text), transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
    const object = new Sprite(material);
    object.name = 'trader-speech-bubble';
    object.userData = { traderId: entity, storyStep: step, following, text };
    object.scale.set(4.8, 1.8, 1);
    object.center.set(0.5, 0);
    object.renderOrder = 6;
    return object;
  }, [text, entity, step, following]);

  useEffect(() => () => {
    sprite.material.map?.dispose();
    sprite.material.dispose();
  }, [sprite]);

  useFrame(() => {
    const player = world.queryFirst(PlayerPosition)?.get(PlayerPosition);
    const trader = entity.get(TraderPosition);
    const visible = Boolean(player && trader && player.distanceToSquared(trader) < 10 * 10);
    if (visible !== near) setNear(visible);
  });

  return <primitive object={sprite} visible={near} position={[0, 2.45, 0]} />;
}
