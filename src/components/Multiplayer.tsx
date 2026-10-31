import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { applyVoxelEdits, getWorldSeed, groupVoxelEdits, loadLevel, onVoxelEdit, snapshotVehicles, snapshotWorldEdits, streamChunks } from '../game/chunks';
import type { ChunkEdit } from '../game/chunks';
import { isPlayerSnapshot, resolveMultiplayerUrl } from '../game/multiplayer';
import type { PlayerSnapshot } from '../game/multiplayer';
import { useMultiplayerStore, useRemotePlayerStore } from '../game/multiplayerStore';
import { createWorldSave } from '../game/save';
import { useGameStore } from '../game/store';
import { useCharacterStore } from '../game/characterStore';
import { Chunk, Player, PlayerBody, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity } from '../game/traits';
import { PixelPart } from './ItemModel';
import { clearTeleportRequests, receiveTeleportRequest, receiveTeleportResponse, setTeleportSocket } from '../game/teleportRequests';
import { dismount } from '../game/vehicles';
import { applyVehicleRemoval, applyVehicleSnapshot, isVehicleSnapshot, onVehicleSync } from '../game/vehicleSync';
import type { VehicleSnapshot } from '../game/vehicleSync';
import { isOutfitKind, isWigSelection, OUTFITS, selectedWig } from '../game/outfits';
import type { OutfitKind, WigSelection } from '../game/outfits';
import { CharacterOutfit } from './CharacterOutfit';
import { hasWardrobeModel } from './WardrobeGlb';
import { sanitizeAppearance } from '../game/appearance';
import type { CharacterAppearance } from '../game/appearance';
import { receiveFriendAcceptance, receiveFriendRequest } from '../game/friends';
import { applyProjectileRemoval, applyProjectileSnapshot, isExplosionSnapshot, isProjectileSnapshot, onProjectileSync } from '../game/projectileSync';

type ServerMessage = {
  type?: unknown;
  playerId?: unknown;
  character?: unknown;
  name?: unknown;
  state?: unknown;
  players?: unknown;
  seed?: unknown;
  edits?: unknown;
  requestId?: unknown;
  from?: unknown;
  position?: unknown;
  vehicle?: unknown;
  vehicles?: unknown;
  vehicleId?: unknown;
  projectile?: unknown;
  projectileId?: unknown;
  explosion?: unknown;
  outfit?: unknown;
  wig?: unknown;
  appearance?: unknown;
  gameplayMode?: unknown;
};
type WorldSnapshot = { seed: number | null; edits: Array<[string, ChunkEdit]>; gameplayMode?: 'survival' | 'creative' };

function sendWorldInitialization(socket: WebSocket, world: World, force: boolean) {
  const edits = snapshotWorldEdits(world).flatMap(([, entries]) => entries);
  socket.send(JSON.stringify({ type: 'world-init', seed: getWorldSeed(world), edits: edits.slice(0, 256), gameplayMode: useGameStore.getState().gameplayMode, force }));
  for (let index = 256; index < edits.length; index += 256) {
    socket.send(JSON.stringify({ type: 'world-init-edits', edits: edits.slice(index, index + 256) }));
  }
  socket.send(JSON.stringify({ type: 'world-init-complete', force }));
}

function RemoteAvatar({ playerId, state, character, outfit, wig, appearance }: { playerId: string; state: PlayerSnapshot; character: 'boy' | 'girl'; outfit: OutfitKind; wig: WigSelection; appearance?: CharacterAppearance }) {
  const group = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const phase = useRef(0);
  const target = useMemo(() => new Vector3(), []);
  const hue = [...playerId].reduce((value, character) => (value * 31 + character.charCodeAt(0)) % 360, 0);
  const girl = character === 'girl';
  const current = sanitizeAppearance(appearance, character);
  const body = current.clothingColor ?? (outfit === 'default' ? (girl ? '#9a5f9f' : `hsl(${hue}, 45%, 48%)`) : OUTFITS[outfit].body);
  const legs = current.clothingColor ?? (outfit === 'default' ? (girl ? '#4b405e' : '#354d6d') : OUTFITS[outfit].legs);
  const hasWig = selectedWig(outfit, wig) !== null;

  useFrame((_, delta) => {
    if (!group.current) return;
    const amount = 1 - Math.exp(-delta * 14);
    target.set(state.x, state.y + (state.flying ? 1 : 0), state.z);
    group.current.position.lerp(target, amount);
    group.current.rotation.order = 'YXZ';
    if (state.moving || state.flying || state.mounted) {
      const angle = Math.atan2(Math.sin(state.yaw - group.current.rotation.y), Math.cos(state.yaw - group.current.rotation.y));
      group.current.rotation.y += angle * amount;
    }
    const flightRotation = state.flying ? -Math.PI / 2 : 0;
    group.current.rotation.x += (flightRotation - group.current.rotation.x) * amount;
    if (state.moving) phase.current += delta * 8;
    const swing = state.moving ? Math.sin(phase.current) * 0.85 : 0;
    if (leftArm.current) leftArm.current.rotation.x += (swing - leftArm.current.rotation.x) * amount;
    if (rightArm.current) rightArm.current.rotation.x += (-swing - rightArm.current.rotation.x) * amount;
    if (leftLeg.current) leftLeg.current.rotation.x += (-swing - leftLeg.current.rotation.x) * amount;
    if (rightLeg.current) rightLeg.current.rotation.x += (swing - rightLeg.current.rotation.x) * amount;
    if (headRef.current) {
      const headYaw = Math.atan2(Math.sin(state.yaw - group.current.rotation.y), Math.cos(state.yaw - group.current.rotation.y));
      headRef.current.rotation.order = 'YXZ';
      headRef.current.rotation.y += (headYaw - headRef.current.rotation.y) * amount;
      headRef.current.rotation.x += (state.pitch - headRef.current.rotation.x) * amount;
    }
  });

  const headContent = (
    <>
      <PixelPart position={[0, 1.7, 0]} size={[0.48, 0.48, 0.48]} color="#e7a0aa" />
      {!hasWig && <PixelPart position={[0, 1.96, 0]} size={[0.5, 0.1, 0.5]} color={current.hairColor} />}
      {current.hairStyle === 'long' && !hasWig && (
        <>
          <PixelPart position={[0, 1.58, 0.24]} size={[0.5, 0.65, 0.12]} color={current.hairColor} />
          <PixelPart position={[-0.24, 1.59, 0.08]} size={[0.1, 0.55, 0.28]} color={current.hairColor} />
          <PixelPart position={[0.24, 1.59, 0.08]} size={[0.1, 0.55, 0.28]} color={current.hairColor} />
        </>
      )}
      <PixelPart position={[-0.11, 1.74, -0.25]} size={[0.09, 0.07, 0.025]} color="#f4f4ed" />
      <PixelPart position={[0.11, 1.74, -0.25]} size={[0.09, 0.07, 0.025]} color="#f4f4ed" />
      <PixelPart position={[-0.11, 1.74, -0.27]} size={[0.035, 0.05, 0.02]} color={current.eyeColor} />
      <PixelPart position={[0.11, 1.74, -0.27]} size={[0.035, 0.05, 0.02]} color={current.eyeColor} />
    </>
  );

  return (
    <group ref={group} position={[state.x, state.y, state.z]}>
      {!hasWardrobeModel(outfit) && <PixelPart position={[0, 1.08, 0]} size={[0.56, 0.66, 0.32]} color={body} />}
      <CharacterOutfit outfit={outfit} wig={wig} color={current.clothingColor} moving={state.moving} airborne={state.airborne} head={headContent} headRef={headRef} />
      <group ref={leftArm} position={[-0.39, 1.4, 0]}><PixelPart position={[0, -0.33, 0]} size={[0.19, 0.66, 0.21]} color="#e7a0aa" /></group>
      <group ref={rightArm} position={[0.39, 1.4, 0]}><PixelPart position={[0, -0.33, 0]} size={[0.19, 0.66, 0.21]} color="#e7a0aa" /></group>
      <group ref={leftLeg} position={[-0.15, 0.78, 0]}>
        <PixelPart position={[0, -0.38, 0]} size={[0.23, 0.76, 0.27]} color={legs} />
        <PixelPart position={[0, -0.71, -0.04]} size={[0.25, 0.14, 0.34]} color="#302b2b" />
      </group>
      <group ref={rightLeg} position={[0.15, 0.78, 0]}>
        <PixelPart position={[0, -0.38, 0]} size={[0.23, 0.76, 0.27]} color={legs} />
        <PixelPart position={[0, -0.71, -0.04]} size={[0.25, 0.14, 0.34]} color="#302b2b" />
      </group>
    </group>
  );
}

export function RemoteAvatars() {
  const players = useRemotePlayerStore((state) => state.players);
  const characters = useRemotePlayerStore((state) => state.characters);
  const outfits = useRemotePlayerStore((state) => state.outfits);
  const wigs = useRemotePlayerStore((state) => state.wigs);
  const appearances = useRemotePlayerStore((state) => state.appearances);
  return Object.entries(players).map(([playerId, state]) => <RemoteAvatar key={playerId} playerId={playerId} state={state} character={characters[playerId] ?? 'boy'} outfit={outfits[playerId] ?? 'default'} wig={wigs[playerId] ?? 'auto'} appearance={appearances[playerId]} />);
}

export function MultiplayerConnection() {
  const world = useWorld();
  const socket = useRef<WebSocket | null>(null);
  const localPlayerId = useRef<string | null>(null);
  const roster = useRef(new Map<string, string>());
  const pendingWorld = useRef<WorldSnapshot | null>(null);
  const pendingSpawn = useRef<PlayerSnapshot | null>(null);
  const pendingVehicles = useRef(new Map<string, VehicleSnapshot>());
  const pendingEdits = useRef(new Map<string, ChunkEdit>());
  const applyingRemote = useRef(false);
  const worldInitSent = useRef(false);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const connectionId = useMultiplayerStore((state) => state.connectionId);
  const room = useMultiplayerStore((state) => state.room);
  const server = useMultiplayerStore((state) => state.server);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const character = useCharacterStore((state) => state.character);
  const outfit = useCharacterStore((state) => state.outfit);
  const wig = useCharacterStore((state) => state.wig);
  const appearance = useCharacterStore((state) => state.appearance);
  const generation = useGameStore((state) => state.generation);
  const lastGeneration = useRef(generation);

  useEffect(() => {
    const store = useMultiplayerStore.getState();
    const remote = useRemotePlayerStore.getState();
    localPlayerId.current = null;
    roster.current.clear();
    pendingWorld.current = null;
    pendingSpawn.current = null;
    pendingVehicles.current.clear();
    pendingEdits.current.clear();
    worldInitSent.current = false;
    clearTeleportRequests();
    store.setPlayers([]);
    remote.setPlayers({});
    remote.setCharacters({});
    remote.setOutfits({});
    remote.setWigs({});
    remote.setAppearances({});
    if (!enabled) {
      store.setStatus('offline');
      return;
    }

    let endpoint: string;
    try {
      const url = new URL(resolveMultiplayerUrl());
      url.searchParams.set('room', room);
      url.searchParams.set('name', playerName);
      url.searchParams.set('character', character);
      url.searchParams.set('outfit', outfit);
      url.searchParams.set('wig', wig);
      url.searchParams.set('appearance', JSON.stringify(appearance));
      endpoint = url.toString();
    } catch {
      store.setStatus('error', 'Adresse du serveur invalide. Utilise une adresse ws:// ou wss://.');
      return;
    }

    let disposed = false;
    let reconnectTimer: number | undefined;
    const syncRoster = () => {
      store.setPlayers([
        ...(localPlayerId.current ? [{ playerId: localPlayerId.current, name: playerName, self: true }] : []),
        ...[...roster.current].map(([playerId, name]) => ({ playerId, name })),
      ]);
    };
    const applyPendingVehicles = () => {
      if (pendingWorld.current || world.query(Chunk).length < 9) return;
      for (const vehicle of pendingVehicles.current.values()) applyVehicleSnapshot(world, vehicle);
      pendingVehicles.current.clear();
    };
    const applyPendingWorld = () => {
      const pending = pendingWorld.current;
      if (!pending || world.query(Chunk).length < 9) return;
      if (pending.seed === null) {
        const current = socket.current;
        if (current?.readyState === WebSocket.OPEN && !worldInitSent.current) {
          sendWorldInitialization(current, world, false);
          worldInitSent.current = true;
        }
        return;
      }
      const roomCreator = pendingSpawn.current === null;
      const saved = createWorldSave(world);
      if (!saved) return;
      saved.gameplayMode = pending.gameplayMode ?? saved.gameplayMode ?? 'creative';
      const unchanged = saved.seed === pending.seed && saved.gameplayMode === useGameStore.getState().gameplayMode && JSON.stringify(saved.edits) === JSON.stringify(groupVoxelEdits(pending.edits));
      if (!unchanged) {
        saved.seed = pending.seed;
        saved.edits = groupVoxelEdits(pending.edits);
        applyingRemote.current = true;
        try {
          loadLevel(world, useGameStore.getState().generation, saved);
        } finally {
          applyingRemote.current = false;
        }
      }
      const spawn = pendingSpawn.current;
      if (spawn) {
        const player = world.queryFirst(Player);
        if (player) {
          if (player.get(PlayerMount)?.vehicle) dismount(world);
          streamChunks(world, spawn.x, spawn.z);
          player.get(PlayerPosition)?.set(spawn.x, spawn.y, spawn.z);
          player.get(PlayerBody)?.value?.setTranslation(spawn, true);
          player.get(PlayerVelocity)?.set(0, 0, 0);
          player.set(PlayerState, { flying: spawn.flying, grounded: false });
          useGameStore.getState().setFlying(spawn.flying);
        }
        pendingSpawn.current = null;
      }
      pendingWorld.current = null;
      applyPendingVehicles();
      if (roomCreator) {
        const current = socket.current;
        if (current?.readyState === WebSocket.OPEN) {
          for (const car of snapshotVehicles(world)) {
            current.send(JSON.stringify({ type: 'vehicle-spawn', vehicle: { ...car, kind: car.kind ?? 'car' } }));
          }
        }
      }
      pendingEdits.current.clear();
    };
    const flushEdits = () => {
      const current = socket.current;
      if (!current || current.readyState !== WebSocket.OPEN || pendingEdits.current.size === 0) return;
      const edits = [...pendingEdits.current];
      pendingEdits.current.clear();
      for (let index = 0; index < edits.length; index += 256) current.send(JSON.stringify({ type: 'edits', edits: edits.slice(index, index + 256) }));
    };
    const unsubscribe = onVoxelEdit(world, (position, edit) => {
      if (applyingRemote.current || socket.current?.readyState !== WebSocket.OPEN) return;
      pendingEdits.current.set(position, edit);
    });
    const unsubscribeVehicles = onVehicleSync(world, (message) => {
      const current = socket.current;
      if (current?.readyState === WebSocket.OPEN) current.send(JSON.stringify(message));
    });
    const unsubscribeProjectiles = onProjectileSync(world, (message) => {
      const current = socket.current;
      if (current?.readyState === WebSocket.OPEN) current.send(JSON.stringify(message));
    });
    store.setStatus('connecting');

    const connect = () => {
      const next = new WebSocket(endpoint);
      socket.current = next;
      setTeleportSocket(next);
      next.onopen = () => store.setStatus('online');
      next.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        let data: ServerMessage;
        try {
          data = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }
        if (data.type === 'friend-request') {
          receiveFriendRequest(data);
          return;
        }
        if (data.type === 'friend-accept') {
          receiveFriendAcceptance(data);
          return;
        }
        if ((data.type === 'projectile-spawn' || data.type === 'projectile-state') && isProjectileSnapshot(data.projectile)) {
          applyProjectileSnapshot(world, data.projectile);
          return;
        }
        if (data.type === 'projectile-remove' && typeof data.projectileId === 'string' && isExplosionSnapshot(data.explosion)) {
          applyProjectileRemoval(world, data.projectileId, data.explosion);
          return;
        }
        if (data.type === 'vehicles' && Array.isArray(data.vehicles)) {
          pendingVehicles.current = new Map(data.vehicles.filter(isVehicleSnapshot).map((vehicle) => [vehicle.id, vehicle]));
          applyPendingVehicles();
          return;
        }
        if ((data.type === 'vehicle-spawn' || data.type === 'vehicle-state') && isVehicleSnapshot(data.vehicle)) {
          pendingVehicles.current.set(data.vehicle.id, data.vehicle);
          applyPendingVehicles();
          return;
        }
        if (data.type === 'vehicle-remove' && typeof data.vehicleId === 'string') {
          pendingVehicles.current.delete(data.vehicleId);
          applyVehicleRemoval(world, data.vehicleId);
          return;
        }
        if (data.type === 'teleport-request') {
          receiveTeleportRequest(data);
          return;
        }
        if (data.type === 'teleport-accept' || data.type === 'teleport-decline' || data.type === 'teleport-unavailable') {
          receiveTeleportResponse(data);
          return;
        }
        if (data.type === 'world' && (data.seed === null || typeof data.seed === 'number') && Array.isArray(data.edits)) {
          pendingWorld.current = { seed: data.seed, edits: data.edits as Array<[string, ChunkEdit]>, gameplayMode: data.gameplayMode === 'survival' ? 'survival' : 'creative' };
          applyPendingWorld();
          return;
        }
        if (data.type === 'edits' && Array.isArray(data.edits)) {
          const edits = data.edits as Array<[string, ChunkEdit]>;
          if (pendingWorld.current) {
            const latest = new Map(pendingWorld.current.edits);
            for (const [position, edit] of edits) latest.set(position, edit);
            pendingWorld.current.edits = [...latest];
          }
          applyingRemote.current = true;
          try {
            applyVoxelEdits(world, edits);
          } finally {
            applyingRemote.current = false;
          }
          return;
        }
        if (typeof data.playerId !== 'string') return;
        if (data.type === 'join') {
          const name = typeof data.name === 'string' ? data.name : 'Joueur';
          if (Array.isArray(data.players)) {
            localPlayerId.current = data.playerId;
            roster.current.clear();
            const updated: Record<string, PlayerSnapshot> = {};
            const characters: Record<string, 'boy' | 'girl'> = {};
            const outfits: Record<string, OutfitKind> = {};
            const wigs: Record<string, WigSelection> = {};
            const appearances: Record<string, CharacterAppearance> = {};
            for (const player of data.players as Array<{ playerId?: unknown; name?: unknown; character?: unknown; state?: unknown; outfit?: unknown; wig?: unknown; appearance?: unknown }>) {
              if (!player || typeof player.playerId !== 'string') continue;
              roster.current.set(player.playerId, typeof player.name === 'string' ? player.name : 'Joueur');
              characters[player.playerId] = player.character === 'girl' ? 'girl' : 'boy';
              outfits[player.playerId] = isOutfitKind(player.outfit) ? player.outfit : 'default';
              wigs[player.playerId] = isWigSelection(player.wig) ? player.wig : 'auto';
              appearances[player.playerId] = sanitizeAppearance(player.appearance, characters[player.playerId]);
              if (!pendingSpawn.current && isPlayerSnapshot(player.state)) pendingSpawn.current = { ...player.state };
              if (isPlayerSnapshot(player.state)) updated[player.playerId] = player.state;
            }
            useRemotePlayerStore.getState().setPlayers(updated);
            useRemotePlayerStore.getState().setCharacters(characters);
            useRemotePlayerStore.getState().setOutfits(outfits);
            useRemotePlayerStore.getState().setWigs(wigs);
            useRemotePlayerStore.getState().setAppearances(appearances);
          } else {
            roster.current.set(data.playerId, name);
            const character = data.character === 'girl' ? 'girl' : 'boy';
            useRemotePlayerStore.setState((current) => ({
              characters: { ...current.characters, [data.playerId as string]: character },
              outfits: { ...current.outfits, [data.playerId as string]: isOutfitKind(data.outfit) ? data.outfit : 'default' },
              wigs: { ...current.wigs, [data.playerId as string]: isWigSelection(data.wig) ? data.wig : 'auto' },
              appearances: { ...current.appearances, [data.playerId as string]: sanitizeAppearance(data.appearance, character) },
            }));
          }
          syncRoster();
        } else if (data.type === 'outfit' && isOutfitKind(data.outfit)) {
          useRemotePlayerStore.setState((current) => ({ outfits: { ...current.outfits, [data.playerId as string]: data.outfit as OutfitKind } }));
        } else if (data.type === 'wig' && isWigSelection(data.wig)) {
          useRemotePlayerStore.setState((current) => ({ wigs: { ...current.wigs, [data.playerId as string]: data.wig as WigSelection } }));
        } else if (data.type === 'appearance') {
          const character = useRemotePlayerStore.getState().characters[data.playerId] ?? 'boy';
          useRemotePlayerStore.setState((current) => ({ appearances: { ...current.appearances, [data.playerId as string]: sanitizeAppearance(data.appearance, character) } }));
        } else if (data.type === 'state' && isPlayerSnapshot(data.state)) {
          if (!roster.current.has(data.playerId)) {
            roster.current.set(data.playerId, 'Joueur');
            syncRoster();
          }
          const state = data.state;
          useRemotePlayerStore.setState((current) => ({ players: { ...current.players, [data.playerId as string]: state } }));
        } else if (data.type === 'leave') {
          roster.current.delete(data.playerId);
          syncRoster();
          useRemotePlayerStore.setState((current) => {
            const players = { ...current.players };
            const characters = { ...current.characters };
            const outfits = { ...current.outfits };
            const wigs = { ...current.wigs };
            const appearances = { ...current.appearances };
            delete players[data.playerId as string];
            delete characters[data.playerId as string];
            delete outfits[data.playerId as string];
            delete wigs[data.playerId as string];
            delete appearances[data.playerId as string];
            return { players, characters, outfits, wigs, appearances };
          });
        }
      };
      next.onerror = () => {
        store.setStatus('error', 'Serveur inaccessible. Nouvelle tentative…');
        next.close();
      };
      next.onclose = () => {
        if (socket.current === next) {
          socket.current = null;
          clearTeleportRequests();
        }
        if (disposed) return;
        localPlayerId.current = null;
        roster.current.clear();
        pendingWorld.current = null;
        pendingSpawn.current = null;
        pendingVehicles.current.clear();
        pendingEdits.current.clear();
        worldInitSent.current = false;
        store.setPlayers([]);
        useRemotePlayerStore.getState().setPlayers({});
        useRemotePlayerStore.getState().setCharacters({});
        useRemotePlayerStore.getState().setOutfits({});
        useRemotePlayerStore.getState().setAppearances({});
        useRemotePlayerStore.getState().setWigs({});
        store.setStatus('error', 'Connexion interrompue. Nouvelle tentative…');
        reconnectTimer = window.setTimeout(connect, 1500);
      };
    };

    const sendTimer = window.setInterval(() => {
      applyPendingWorld();
      flushEdits();
      const current = socket.current;
      if (!current || current.readyState !== WebSocket.OPEN || useGameStore.getState().mode !== 'play') return;
      const entity = world.queryFirst(Player);
      const position = entity?.get(PlayerPosition);
      const playerState = entity?.get(PlayerState);
      const velocity = entity?.get(PlayerVelocity);
      const mounted = entity?.get(PlayerMount)?.vehicle;
      if (!position || !playerState) return;
      const moving = Boolean(!mounted && playerState.grounded && !playerState.flying && velocity && Math.hypot(velocity.x, velocity.z) > 0.1);
      const airborne = Boolean(!playerState.grounded || playerState.flying || (velocity && Math.abs(velocity.y) > 2));
      const state: PlayerSnapshot = { ...position, yaw: playerState.yaw, pitch: playerState.pitch, flying: playerState.flying, moving, airborne, mounted: Boolean(mounted) };
      current.send(JSON.stringify({ type: 'state', state }));
    }, 50);

    connect();
    return () => {
      disposed = true;
      window.clearInterval(sendTimer);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      unsubscribe();
      unsubscribeVehicles();
      unsubscribeProjectiles();
      const current = socket.current;
      socket.current = null;
      clearTeleportRequests();
      if (current) {
        current.onclose = null;
        current.close();
      }
      localPlayerId.current = null;
      roster.current.clear();
      pendingWorld.current = null;
      pendingSpawn.current = null;
      pendingVehicles.current.clear();
      pendingEdits.current.clear();
      store.setPlayers([]);
      useRemotePlayerStore.getState().setPlayers({});
      useRemotePlayerStore.getState().setCharacters({});
      useRemotePlayerStore.getState().setOutfits({});
        useRemotePlayerStore.getState().setAppearances({});
      useRemotePlayerStore.getState().setWigs({});
    };
  }, [world, enabled, connectionId, room, server, playerName, character]);

  useEffect(() => {
    if (!enabled) return;
    const current = socket.current;
    if (current?.readyState !== WebSocket.OPEN) return;
    current.send(JSON.stringify({ type: 'outfit', outfit }));
    current.send(JSON.stringify({ type: 'wig', wig }));
  }, [enabled, connectionId, outfit, wig]);

  useEffect(() => {
    if (!enabled) return;
    const current = socket.current;
    if (current?.readyState === WebSocket.OPEN) current.send(JSON.stringify({ type: 'appearance', appearance }));
  }, [enabled, connectionId, appearance]);

  useEffect(() => {
    if (lastGeneration.current === generation) return;
    lastGeneration.current = generation;
    if (!enabled) return;
    const current = socket.current;
    if (current?.readyState === WebSocket.OPEN) {
      sendWorldInitialization(current, world, true);
    }
  }, [world, generation, enabled]);

  return null;
}
