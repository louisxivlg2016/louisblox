import { useEffect, useRef } from 'react';
import { getBlockIndex, getColumnTop, onVoxelEdit } from '../game/chunks';
import { translate } from '../game/language';
import { useRemotePlayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { Player, PlayerPosition, PlayerState } from '../game/traits';
import { BLOCK_INFO, BlockKind, isWaterBlock, voxelKey } from '../game/voxel';
import { world } from '../game/world';

const SIZE = 164;
const RADIUS = 20;
const PIXELS = SIZE / (RADIUS * 2 + 1);
const allowedModes = new Set(['creative', 'survival', 'pirates', 'football', 'city-modern', 'city-ancient']);

export function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const coordinates = useRef<HTMLElement>(null);
  const gameplayMode = useGameStore((state) => state.gameplayMode);

  useEffect(() => {
    if (!allowedModes.has(gameplayMode) || !canvas.current) return;
    const element = canvas.current;
    const context = element.getContext('2d')!;
    let dirty = true;
    const draw = () => {
      if (!dirty) return;
      dirty = false;
      const playerEntity = world.queryFirst(Player);
      const player = playerEntity?.get(PlayerPosition);
      if (!player) return;
      const centerX = Math.round(player.x);
      const centerZ = Math.round(player.z);
      const blocks = getBlockIndex(world);
      context.clearRect(0, 0, SIZE, SIZE);
      for (let dz = -RADIUS; dz <= RADIUS; dz += 1) {
        for (let dx = -RADIUS; dx <= RADIUS; dx += 1) {
          const x = centerX + dx;
          const z = centerZ + dz;
          const top = getColumnTop(world, x, z);
          let block = top === undefined ? undefined : blocks.get(voxelKey(x, top, z));
          if (top !== undefined) {
            for (let y = top + 1; y <= top + 5; y += 1) {
              const above = blocks.get(voxelKey(x, y, z));
              if (above && (isWaterBlock(above.kind) || above.waterlogged)) block = above;
            }
          }
          context.fillStyle = block ? block.waterlogged ? BLOCK_INFO[BlockKind.Water].color : BLOCK_INFO[block.kind]?.color ?? '#657064' : '#17231c';
          context.fillRect((dx + RADIUS) * PIXELS, (dz + RADIUS) * PIXELS, Math.ceil(PIXELS), Math.ceil(PIXELS));
        }
      }
      for (const remote of Object.values(useRemotePlayerStore.getState().players)) {
        const dx = (remote.x - centerX) * PIXELS;
        const dz = (remote.z - centerZ) * PIXELS;
        if (Math.abs(dx) > SIZE / 2 - 5 || Math.abs(dz) > SIZE / 2 - 5) continue;
        context.fillStyle = '#ff665c';
        context.beginPath();
        context.arc(SIZE / 2 + dx, SIZE / 2 + dz, 3, 0, Math.PI * 2);
        context.fill();
      }
      const yaw = playerEntity?.get(PlayerState)?.yaw ?? 0;
      context.save();
      context.translate(SIZE / 2, SIZE / 2);
      context.rotate(-yaw);
      context.fillStyle = '#fff4a8';
      context.strokeStyle = '#3c3210';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -8);
      context.lineTo(6, 7);
      context.lineTo(0, 4);
      context.lineTo(-6, 7);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
      if (coordinates.current) coordinates.current.textContent = `${centerX} · ${centerZ}`;
    };
    const unsubscribe = onVoxelEdit(world, () => { dirty = true; });
    const timer = window.setInterval(() => { dirty = true; draw(); }, 500);
    draw();
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [gameplayMode]);

  if (!allowedModes.has(gameplayMode)) return null;
  return (
    <div className="minimap" aria-label={translate('Minicarte', 'Minimap')}>
      <canvas ref={canvas} width={SIZE} height={SIZE} role="img" aria-label={translate('Carte du terrain autour du joueur', 'Map of the terrain around the player')} />
      <span className="minimap-north">N</span>
      <small ref={coordinates} />
    </div>
  );
}
