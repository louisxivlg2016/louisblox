import { useEffect, useRef, useState } from 'react';
import { getBlockIndex, getColumnTop, onVoxelEdit, streamChunks } from '../game/chunks';
import { releasePointerForOverlay, requestPlay } from '../game/input';
import { translate } from '../game/language';
import { useRemotePlayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { Player, PlayerPosition, PlayerState } from '../game/traits';
import { BLOCK_INFO, BlockKind, isWaterBlock, voxelKey } from '../game/voxel';
import { world } from '../game/world';
import { useNavigationStore } from '../game/navigation';

const CELL = 4;
const MINI_RADIUS = 32;
const MAP_RADIUS = 96;
const allowedModes = new Set(['creative', 'survival', 'pirates', 'football', 'city-modern', 'city-ancient']);

function RouteGuide() {
  const destination = useNavigationStore((state) => state.destination);
  const clearDestination = useNavigationStore((state) => state.clearDestination);
  const arrow = useRef<HTMLElement>(null);
  const label = useRef<HTMLElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const worldId = useGameStore((state) => state.worldId);
  useEffect(() => {
    if (!destination || destination.worldId !== worldId) return;
    let animation = 0;
    const update = () => {
      const entity = world.queryFirst(Player);
      const position = entity?.get(PlayerPosition);
      if (position) {
        const dx = destination.x - position.x;
        const dz = destination.z - position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 2) {
          clearDestination();
          useGameStore.getState().setNotice(translate('Tu es arrivé à destination !', 'You have arrived at your destination!'));
          return;
        }
        const yaw = entity?.get(PlayerState)?.yaw ?? 0;
        const targetYaw = Math.atan2(-dx, -dz);
        const angle = Math.atan2(Math.sin(yaw - targetYaw), Math.cos(yaw - targetYaw));
        if (arrow.current) arrow.current.style.transform = `rotate(${angle}rad)`;
        if (label.current) label.current.textContent = `${translate('Itinéraire', 'Route')} · ${Math.round(distance)} m`;
        if (root.current) root.current.dataset.distance = String(Math.round(distance));
      }
      animation = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(animation);
  }, [destination, worldId, clearDestination]);
  if (!destination || destination.worldId !== worldId) return null;
  return (
    <div ref={root} className="route-guide" data-route-guide>
      <i ref={arrow} aria-hidden="true" />
      <span ref={label}>{translate('Itinéraire', 'Route')}</span>
      <button type="button" onClick={clearDestination} aria-label={translate('Effacer l’itinéraire', 'Clear route')}>{translate('Effacer', 'Clear')}</button>
    </div>
  );
}

export function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const largeCanvas = useRef<HTMLCanvasElement>(null);
  const coordinates = useRef<HTMLElement>(null);
  const largeCoordinates = useRef<HTMLElement>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [viewCenter, setViewCenter] = useState<{ x: number; z: number } | null>(null);
  const drag = useRef<{ pointerId: number; clientX: number; clientY: number; x: number; z: number; moved: boolean } | null>(null);
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
            if (large && block) largeCache.current.set(key, color);
          }
          context.fillStyle = color;
          context.fillRect((dx + radius) * CELL, (dz + radius) * CELL, CELL, CELL);
        }
      }
      const route = useNavigationStore.getState().destination;
      if (route && route.worldId === useGameStore.getState().worldId) {
        const startX = center + (player.x - centerX) * CELL;
        const startY = center + (player.z - centerZ) * CELL;
        const endX = center + (route.x - centerX) * CELL;
        const endY = center + (route.z - centerZ) * CELL;
        context.save();
        context.strokeStyle = '#ffe36e';
        context.lineWidth = large ? 4 : 2;
        context.setLineDash([10, 6]);
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        context.setLineDash([]);
        if (Math.abs(endX - center) <= center - 8 && Math.abs(endY - center) <= center - 8) {
          context.fillStyle = '#ff775c';
          context.strokeStyle = '#fff4c0';
          context.lineWidth = 2;
          context.beginPath();
          context.arc(endX, endY, large ? 7 : 5, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        }
        context.restore();
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
    const unsubscribeNavigation = useNavigationStore.subscribe(() => { dirty = true; update(); });
    const timer = window.setInterval(() => { dirty = true; update(); }, mapOpen ? 1000 : 500);
    update();
    return () => {
      unsubscribe();
      unsubscribeNavigation();
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
    const player = world.queryFirst(Player)?.get(PlayerPosition);
    if (player) for (let index = 0; index < 24; index += 1) streamChunks(world, player.x, player.z);
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
    drag.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: center.x, z: center.z, moved: false };
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.cursor = 'grabbing';
  };
  const moveMapDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved && Math.hypot(event.clientX - current.clientX, event.clientY - current.clientY) < 6) return;
    current.moved = true;
    const next = { x: current.x + (current.clientX - event.clientX) / CELL, z: current.z + (current.clientY - event.clientY) / CELL };
    setViewCenter(next);
    const now = performance.now();
    if (now - lastStream.current >= 250) {
      lastStream.current = now;
      for (let index = 0; index < 18; index += 1) streamChunks(world, next.x, next.z);
    }
  };
  const endMapDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (current.moved) {
      for (let index = 0; index < 24; index += 1) streamChunks(world, viewCenter?.x ?? current.x, viewCenter?.z ?? current.z);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      const scaleX = event.currentTarget.width / rect.width;
      const scaleY = event.currentTarget.height / rect.height;
      const x = Math.round(current.x + ((event.clientX - rect.left) * scaleX - event.currentTarget.width / 2) / CELL);
      const z = Math.round(current.z + ((event.clientY - rect.top) * scaleY - event.currentTarget.height / 2) / CELL);
      useNavigationStore.getState().setDestination(x, z);
      for (let index = 0; index < 24; index += 1) streamChunks(world, x, z);
    }
    event.currentTarget.style.cursor = 'grab';
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <>
      <RouteGuide />
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
            <canvas ref={largeCanvas} className="world-map-canvas" width={(MAP_RADIUS * 2 + 1) * CELL} height={(MAP_RADIUS * 2 + 1) * CELL} role="img" onPointerDown={startMapDrag} onPointerMove={moveMapDrag} onPointerUp={endMapDrag} onPointerCancel={endMapDrag} onLostPointerCapture={endMapDrag} aria-label={translate('Grande carte pixelisée du terrain à faire glisser pour explorer tout le monde', 'Large pixelated terrain map to drag and explore the whole world')} />
            <small ref={largeCoordinates}>{viewCenter ? `${Math.round(viewCenter.x)} · ${Math.round(viewCenter.z)}` : undefined}</small>
            <p className="world-map-hint">{translate('Touche la carte pour créer un itinéraire · fais glisser pour explorer', 'Tap the map to create a route · drag to explore')}</p>
          </section>
        </div>
      )}
    </>
  );
}
