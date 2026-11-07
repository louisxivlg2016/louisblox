import { useEffect, useMemo } from 'react';
import { CanvasTexture, NearestFilter, Sprite, SpriteMaterial } from 'three';

export function PlayerNameTag({ name }: { name: string }) {
  const tag = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgba(12, 22, 32, 0.8)';
    context.fillRect(4, 4, 504, 88);
    context.font = 'bold 34px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 7;
    context.strokeStyle = '#15202a';
    context.strokeText(name.slice(0, 24), 256, 49, 482);
    context.fillStyle = '#ffffff';
    context.fillText(name.slice(0, 24), 256, 49, 482);
    const texture = new CanvasTexture(canvas);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new Sprite(material);
    sprite.name = 'remote-player-name';
    sprite.userData.playerName = name;
    sprite.scale.set(2.7, 0.51, 1);
    sprite.renderOrder = 5;
    return sprite;
  }, [name]);
  useEffect(() => () => {
    tag.material.map?.dispose();
    tag.material.dispose();
  }, [tag]);
  return <primitive object={tag} position={[0, 2.6, 0]} />;
}
