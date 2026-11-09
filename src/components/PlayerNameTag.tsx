import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import { CanvasTexture, NearestFilter, Sprite, SpriteMaterial, Vector3 } from 'three';
import { playerIdentity } from '../game/playerIdentity';
import { PlayerPosition } from '../game/traits';
import { useTribeStore } from '../game/tribes';

export function PlayerNameTag({ name, playerId }: { name: string; playerId?: string }) {
  const world = useWorld();
  const tribes = useTribeStore((state) => state.tribes);
  const [distance, setDistance] = useState<number | null>(null);
  const clock = useRef(0);
  const selfId = playerIdentity();
  const tribe = playerId ? tribes.find((candidate) => candidate.members.some((member) => member.playerId === selfId) && candidate.members.some((member) => member.playerId === playerId)) : undefined;
  const tag = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = tribe ? 128 : 96;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgba(12, 22, 32, 0.8)';
    context.fillRect(4, 4, 504, canvas.height - 8);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 7;
    context.strokeStyle = '#15202a';
    context.font = 'bold 34px monospace';
    context.strokeText(name.slice(0, 24), 256, tribe ? 35 : 49, 482);
    context.fillStyle = '#ffffff';
    context.fillText(name.slice(0, 24), 256, tribe ? 35 : 49, 482);
    if (tribe) {
      const subtitle = `${tribe.name} · ${distance ?? '…'} m`;
      context.font = 'bold 28px monospace';
      context.strokeStyle = '#1d3424';
      context.strokeText(subtitle, 256, 88, 482);
      context.fillStyle = '#b8e69f';
      context.fillText(subtitle, 256, 88, 482);
    }
    const texture = new CanvasTexture(canvas);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new Sprite(material);
    sprite.name = 'remote-player-name';
    sprite.userData = { playerName: name, playerId, tribeName: tribe?.name ?? null, distance: tribe ? distance : null };
    sprite.scale.set(2.7, tribe ? 0.68 : 0.51, 1);
    sprite.renderOrder = 5;
    return sprite;
  }, [name, playerId, tribe?.id, tribe?.name, distance]);
  useEffect(() => () => {
    tag.material.map?.dispose();
    tag.material.dispose();
  }, [tag]);
  useFrame((_, delta) => {
    if (!tribe) {
      if (distance !== null) setDistance(null);
      return;
    }
    clock.current += delta;
    if (clock.current < 0.2) return;
    clock.current = 0;
    const player = world.queryFirst(PlayerPosition)?.get(PlayerPosition);
    if (!player) return;
    const other = tag.getWorldPosition(new Vector3());
    const next = Math.max(0, Math.round(Math.hypot(player.x - other.x, player.z - other.z)));
    if (next !== distance) setDistance(next);
  });
  return <primitive object={tag} position={[0, 2.6, 0]} />;
}
