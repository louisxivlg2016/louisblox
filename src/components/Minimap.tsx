import { useEffect, useRef, useState } from 'react';
import { getBlockIndex, getColumnTop, onVoxelEdit, streamChunks } from '../game/chunks';
import { releasePointerForOverlay, requestPlay } from '../game/input';
import { translate } from '../game/language';
import { useRemotePlayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { Player, PlayerPosition, PlayerState } from '../game/traits';
import { BLOCK_INFO, BlockKind, isWaterBlock, voxelKey } from '../game/voxel';
import { world } from '../game/world';

const CELL = 4;
const MINI_RADIUS = 20;
const MAP_RADIUS = 64;
const allowedModes = new Set(['creative', 'survival', 'pirates', 'football', 'city-modern', 'city-ancient']);

export function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const largeCanvas = useRef<HTMLCanvasElement>(null);
  const coordinates = useRef<HTMLElement>(null);
  const largeCoordinates = useRef<HTMLElement>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [viewCenter, setViewCenter] = useState<{ x: number; z: number } | null>(null);
  const drag = useRef<{ pointerId: number; clientX: number; clientY: number; x: number; z: number } | null>(null);
  const largeCache = useRef(new Map<string, string>());
  const lastStream = useRef(0);
  const gameplayMode = useGameStore((state) => state.gameplayMode);

  useEffect(() => {
    if (!allowedModes.has(gameplayMode) || !canvas.current) return;
    let dirty = true;
    const draw = (element: HTMLCanvasElement, radius: number, label: HTMLElement | null, large = false) => {
      const playerEntity = world.queryFirst(Player);
      const player = playerEntity?.get(PlayerPosition);
      if (!player) return;
      const size = element.width;
      const center = size / 2;
      const centerX = Math.round(large && viewCenter ? viewCenter.x : player.x);
      const centerZ = Math.round(large && viewCenter ? viewCenter.z : player.z);
      const blocks = getBlockIndex(world);
      const context = element.getContext('2d')!;
      context.clearRect(0, 0, size, size);
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const x = centerX + dx;
          const z = centerZ + dz;
          const key = `${x},${z}`;
          let color = large ? largeCache.current.get(key) : undefined;
          if (!color) {
            const top = getColumnTop(world, x, z);
            let block = top === undefined ? undefined : blocks.get(voxelKey(x, top, z));
            if (top !== undefined) {
              for (let y = top + 1; y <= top + 2; y += 1) {
                const above = blocks.get(voxelKey(x, y, z));
                if (above && (isWaterBlock(above.kind) || above.waterlogged)) block = above;
              }
            }
            color = block ? block.waterlogged ? BLOCK_INFO[BlockKind.Water].color : BLOCK_INFO[block.kind]?.color ?? '#657064' : '#17231c';
            if (large) largeCache.current.set(key, color);
          }
          context.fillStyle = color;
          context.fillRect((dx + radius) * CELL, (dz + radius) * CELL, CELL, CELL);
        }
      }
      for (const remote of Object.values(useRemotePlayerStore.getState().players)) {
        const dx = (remote.x - centerX) * CELL;
        const dz = (remote.z - centerZ) * CELL;
        if (Math.abs(dx) > center - 5 || Math.abs(dz) > center - 5) continue;
        context.fillStyle = '#ff665c';
        context.beginPath();
        context.arc(center + dx, center + dz, 4, 0, Math.PI * 2);
        context.fill();
      }
      const yaw = playerEntity?.get(PlayerState)?.yaw ?? 0;
      context.save();
      context.translate(center + (player.x - centerX) * CELL, center + (player.z - centerZ) * CELL);
      context.rotate(-yaw);
      context.fillStyle = '#fff4a8';
      context.strokeStyle = '#3c3210';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -10);
      context.lineTo(7, 8);
      context.lineTo(0, 5);
      context.lineTo(-7, 8);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
      if (label) label.textContent = `${centerX} · ${centerZ}`;
    };
    const update = () => {
      if (!dirty) return;
      dirty = false;
      if (canvas.current) draw(canvas.current, MINI_RADIUS, coordinates.current);
      if (mapOpen && largeCanvas.current) draw(largeCanvas.current, MAP_RADIUS, largeCoordinates.current, true);
    };
    const unsubscribe = onVoxelEdit(world, () => { dirty = true; largeCache.current.clear(); });
    const timer = window.setInterval(() => { dirty = true; update(); }, mapOpen ? 1000 : 500);
    update();
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [gameplayMode, mapOpen, viewCenter]);

  useEffect(() => {
    const toggleMap = (event: KeyboardEvent) => {
      if (event.code !== 'KeyG' || event.repeat || gameplayMode === 'football') return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLElement && target.isContentEditable) return;
      event.preventDefault();
      setMapOpen((current) => {
        if (current) {
          void requestPlay();
          return false;
        }
        useGameStore.getState().setMode('pause');
        releasePointerForOverlay();
        return true;
      });
    };
    window.addEventListener('keydown', toggleMap);
    return () => window.removeEventListener('keydown', toggleMap);
  }, [gameplayMode]);

  useEffect(() => {
    if (!mapOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return;
      event.preventDefault();
      setMapOpen(false);
      void requestPlay();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mapOpen]);

  if (!allowedModes.has(gameplayMode)) return null;
  const openMap = () => {
    useGameStore.getState().setMode('pause');
    setViewCenter(null);
    setMapOpen(true);
    releasePointerForOverlay();
  };
  const closeMap = () => {
    setMapOpen(false);
    void requestPlay();
  };
  const startMapDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const player = world.queryFirst(Player)?.get(PlayerPosition);
    const center = viewCenter ?? { x: player?.x ?? 0, z: player?.z ?? 0 };
    drag.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: center.x, z: center.z };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.cursor = 'grabbing';
  };
  const moveMapDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const next = { x: current.x + (current.clientX - event.clientX) / CELL, z: current.z + (current.clientY - event.clientY) / CELL };
    setViewCenter(next);
    const now = performance.now();
    if (now - lastStream.current >= 250) {
      lastStream.current = now;
      for (let index = 0; index < 9; index += 1) streamChunks(world, next.x, next.z);
    }
  };
  const endMapDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (viewCenter) for (let index = 0; index < 9; index += 1) streamChunks(world, viewCenter.x, viewCenter.z);
    event.currentTarget.style.cursor = 'grab';
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <>
      <div className="minimap" aria-label={translate('Minicarte', 'Minimap')}>
        <canvas ref={canvas} width={(MINI_RADIUS * 2 + 1) * CELL} height={(MINI_RADIUS * 2 + 1) * CELL} role="img" onDoubleClick={openMap} aria-label={translate('Carte pixelisée du terrain autour du joueur', 'Pixelated map of the terrain around the player')} />
        <span className="minimap-north">N</span>
        <small ref={coordinates} />
        <button type="button" className="minimap-expand" onClick={openMap}>{translate('Agrandir la carte', 'Open map')}</button>
      </div>
      {mapOpen && (
        <div className="world-map-backdrop" role="dialog" aria-modal="true" aria-label={translate('Carte du monde', 'World map')} onClick={(event) => { if (event.target === event.currentTarget) closeMap(); }}>
          <section className="world-map-panel">
            <div className="world-map-header">
              <strong>{translate('Carte du monde', 'World map')}</strong>
              <button type="button" className="secondary-button" onClick={closeMap}>{translate('Fermer', 'Close')}</button>
            </div>
            <canvas ref={largeCanvas} className="world-map-canvas" width={(MAP_RADIUS * 2 + 1) * CELL} height={(MAP_RADIUS * 2 + 1) * CELL} role="img" onPointerDown={startMapDrag} onPointerMove={moveMapDrag} onPointerUp={endMapDrag} onPointerCancel={endMapDrag} aria-label={translate('Grande carte pixelisée du terrain', 'Large pixelated terrain map')} />
            <small ref={largeCoordinates}>{viewCenter ? `${Math.round(viewCenter.x)} · ${Math.round(viewCenter.z)}` : undefined}</small>
          </section>
        </div>
      )}
    </>
  );
}
