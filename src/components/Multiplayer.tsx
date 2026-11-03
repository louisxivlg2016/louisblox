import { isGameplayMode, isMinigameMode } from '../game/worldMode';
import type { GameplayMode } from '../game/worldMode';
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
import { rememberWorld, useGameStore } from '../game/store';
import { useCharacterStore } from '../game/characterStore';
import { AnimalId, AnimalMotion, AnimalPosition, Chunk, Player, PlayerBody, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity } from '../game/traits';
import { getItemMeta } from '../game/items';
import { ItemModel, PixelPart } from './ItemModel';
import { clearTeleportRequests, receiveTeleportRequest, receiveTeleportResponse, setTeleportSocket } from '../game/teleportRequests';
import { dismount } from '../game/vehicles';
import { applyVehicleRemoval, applyVehicleSnapshot, isVehicleSnapshot, onVehicleSync } from '../game/vehicleSync';
import type { VehicleSnapshot } from '../game/vehicleSync';
import { isOutfitKind, isWigSelection, OUTFITS, selectedWig } from '../game/outfits';
import type { OutfitKind, WigSelection } from '../game/outfits';
import { CharacterOutfit } from './CharacterOutfit';
import { hasFullCharacter } from './FullCharacterGlb';
import { sanitizeAppearance } from '../game/appearance';
import type { CharacterAppearance } from '../game/appearance';
import { receiveFriendAcceptance, receiveFriendRequest, registerSelfProfile } from '../game/friends';
import { playerIdentity } from '../game/playerIdentity';
import { applyProjectileRemoval, applyProjectileSnapshot, isExplosionSnapshot, isPaintSplashSnapshot, isProjectileSnapshot, onProjectileSync } from '../game/projectileSync';
import { clearChat, receiveChatMessage, setChatSocket } from '../game/chat';
import { clearBattle, receiveBattleElimination, receiveBattleKnockback, receiveBattleRespawn, receiveBattleState, setBattleLocalPlayer, setBattleSocket, useBattleStore } from '../game/battle';
import { activeEffectKeys } from '../game/effects';
import { battleTeamColor } from '../game/battleArena';
import { removeBattleTargetPose, updateBattleTargetPose } from '../game/battleCombat';
import { useEmoteStore } from '../game/emotes';
import { receiveAppleGift } from '../game/gifts';
import { applyProtection, isWorldProtection, setProtectionSocket, useProtectionStore } from '../game/protection';
import { clearMinigames, receiveMinigameMessage, setMinigameSocket } from '../game/minigameSync';

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
  paint?: unknown;
  outfit?: unknown;
  wig?: unknown;
  appearance?: unknown;
  gameplayMode?: unknown;
  worldId?: unknown;
  template?: unknown;
  protection?: unknown;
};
type WorldSnapshot = { seed: number | null; edits: Array<[string, ChunkEdit]>; gameplayMode?: import('../game/worldMode').GameplayMode; worldId?: string; template?: import('../game/worldMode').WorldTemplate; protection?: import('../game/protection').WorldProtection };

let requestedRoomMode: GameplayMode | null = null;

export function requestRoomMode(mode: GameplayMode | null) {
  requestedRoomMode = mode;
}

function sendWorldInitialization(socket: WebSocket, world: World, force: boolean) {
  const edits = snapshotWorldEdits(world).flatMap(([, entries]) => entries);
  socket.send(JSON.stringify({ type: 'world-init', seed: getWorldSeed(world), edits: edits.slice(0, 256), gameplayMode: useGameStore.getState().gameplayMode, worldId: useGameStore.getState().worldId, template: useGameStore.getState().worldTemplate, protection: useProtectionStore.getState().protection, force }));
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
  const team = useBattleStore((state) => state.teams[playerId]);
  useEffect(() => () => removeBattleTargetPose(playerId), [playerId]);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.visible = !state.effects?.includes('invisibility');
    const amount = 1 - Math.exp(-delta * 14);
    const seatedHeight = state.mounted && state.vehicleKind !== 'horse' ? state.vehicleKind === 'car' ? 0.9 : 0.7 : 0;
    const lyingHeight = !state.mounted && state.emote === 'lie' ? 0.18 : 0;
    target.set(state.x, state.y + (state.flying ? 1 : 0) + lyingHeight - seatedHeight, state.z);
    group.current.position.lerp(target, amount);
    group.current.rotation.order = 'YXZ';
    if (state.moving || state.flying || state.mounted) {
      const angle = Math.atan2(Math.sin(state.yaw - group.current.rotation.y), Math.cos(state.yaw - group.current.rotation.y));
      group.current.rotation.y += angle * amount;
    }
    const flightRotation = !state.mounted && state.emote === 'lie' ? -Math.PI / 2 : state.flying ? -Math.PI / 2 : 0;
    group.current.rotation.x += (flightRotation - group.current.rotation.x) * amount;
    const waving = state.emote === 'wave';
    if (waving) phase.current += delta * 10;
    else if (state.moving) phase.current += delta * 8;
    const swing = state.moving ? Math.sin(phase.current) * 0.85 : 0;
    if (leftArm.current) leftArm.current.rotation.x += (swing - leftArm.current.rotation.x) * amount;
    if (rightArm.current) {
      rightArm.current.rotation.x += ((waving ? Math.PI : -swing) - rightArm.current.rotation.x) * amount;
      rightArm.current.rotation.z += ((waving ? Math.sin(phase.current) * 0.45 : 0) - rightArm.current.rotation.z) * amount;
    }
    const legRotation = state.mounted || state.emote === 'sit' ? -Math.PI / 2 : null;
    if (leftLeg.current) leftLeg.current.rotation.x += ((legRotation ?? -swing) - leftLeg.current.rotation.x) * amount;
    if (rightLeg.current) rightLeg.current.rotation.x += ((legRotation ?? swing) - rightLeg.current.rotation.x) * amount;
    if (headRef.current) {
      const headYaw = Math.atan2(Math.sin(state.yaw - group.current.rotation.y), Math.cos(state.yaw - group.current.rotation.y));
      headRef.current.rotation.order = 'YXZ';
      headRef.current.rotation.y += (headYaw - headRef.current.rotation.y) * amount;
      headRef.current.rotation.x = state.pitch;
    }
    updateBattleTargetPose(playerId, group.current.position, group.current.rotation.y, group.current.rotation.x < -Math.PI / 4);
  });

  const headContent = (
    <>
      <PixelPart position={[0, 1.7, 0]} size={[0.48, 0.48, 0.48]} color={current.skinColor} />
      {!hasWig && (
        <group name="natural-hair">
          <PixelPart position={[0, 1.96, 0]} size={[0.5, 0.1, 0.5]} color={current.hairColor} />
          <PixelPart position={[0, 1.75, 0.245]} size={[0.5, 0.35, 0.055]} color={current.hairColor} />
          <PixelPart position={[0, 1.88, -0.245]} size={[0.5, 0.12, 0.055]} color={current.hairColor} />
        </group>
      )}
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
      {!hasFullCharacter(outfit) && <PixelPart position={[0, 1.08, 0]} size={[0.56, 0.66, 0.32]} color={body} />}
      <CharacterOutfit outfit={outfit} wig={wig} color={current.clothingColor} moving={state.moving} airborne={state.airborne} remote seated={state.mounted} emote={state.emote} head={headContent} headRef={headRef} appearance={current} />
      {team && <group name="battle-team-marker" userData={{ team }}><PixelPart position={[0, 1.42, -0.21]} size={[0.58, 0.1, 0.06]} color={battleTeamColor(team)} /></group>}
      <group ref={leftArm} visible={!hasFullCharacter(outfit)} position={[-0.39, 1.4, 0]}><PixelPart position={[0, -0.33, 0]} size={[0.19, 0.66, 0.21]} color={current.skinColor} /></group>
      <group name="right-arm" ref={rightArm} position={[0.39, 1.4, 0]}>
        {!hasFullCharacter(outfit) && <PixelPart position={[0, -0.33, 0]} size={[0.19, 0.66, 0.21]} color={current.skinColor} />}
        {typeof state.selected === 'string' && (
          <group
            name="remote-held-item"
            position={[0.13, -0.48, -0.24]}
            scale={getItemMeta(state.selected).category === 'vehicle' ? 0.2 : 0.72}
            userData={{ item: state.selected }}
          >
            <ItemModel kind={state.selected} />
          </group>
        )}
      </group>
      <group ref={leftLeg} visible={!hasFullCharacter(outfit)} position={[-0.15, 0.78, 0]}>
        <PixelPart position={[0, -0.38, 0]} size={[0.23, 0.76, 0.27]} color={legs} />
        <group name="left-knee" position={[0, -0.72, 0]} rotation={[state.mounted || state.emote === 'sit' ? Math.PI / 2 : 0, 0, 0]}>
          <PixelPart position={[0, -0.25, 0]} size={[0.23, 0.5, 0.25]} color={legs} />
          <PixelPart position={[0, -0.5, -0.04]} size={[0.25, 0.14, 0.34]} color="#302b2b" />
        </group>
      </group>
      <group ref={rightLeg} visible={!hasFullCharacter(outfit)} position={[0.15, 0.78, 0]}>
        <PixelPart position={[0, -0.38, 0]} size={[0.23, 0.76, 0.27]} color={legs} />
        <group name="right-knee" position={[0, -0.72, 0]} rotation={[state.mounted || state.emote === 'sit' ? Math.PI / 2 : 0, 0, 0]}>
          <PixelPart position={[0, -0.25, 0]} size={[0.23, 0.5, 0.25]} color={legs} />
          <PixelPart position={[0, -0.5, -0.04]} size={[0.25, 0.14, 0.34]} color="#302b2b" />
        </group>
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
    clearChat();
    clearBattle();
    clearMinigames();
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
      url.searchParams.set('playerId', playerIdentity());
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
    let lastPresence = 0;
    const leaveDeletedRoom = (closing: WebSocket) => {
      if (socket.current === closing) socket.current = null;
      closing.onclose = null;
      closing.close();
      store.setEnabled(false);
      store.setStatus('offline', 'Le salon a été supprimé.');
    };
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
      const currentWorldId = pending.worldId ?? room;
      const wanted = requestedRoomMode;
      if (wanted) {
        if (pending.seed !== null && pending.gameplayMode === wanted) {
          requestedRoomMode = null;
        } else {
          const current = socket.current;
          if (current?.readyState !== WebSocket.OPEN) return;
          pendingWorld.current = null;
          worldInitSent.current = true;
          if (useGameStore.getState().gameplayMode === wanted) {
            requestedRoomMode = null;
            sendWorldInitialization(current, world, true);
          } else {
            useGameStore.getState().regenerate(wanted, room);
          }
          return;
        }
      }
      if (currentWorldId !== useGameStore.getState().worldId) {
        useGameStore.setState({ worldId: currentWorldId, worldName: currentWorldId });
        rememberWorld(currentWorldId);
      }
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
      saved.template = pending.template ?? saved.template ?? 'nature';
      useGameStore.setState({ worldTemplate: saved.template });
      saved.protection = pending.protection;
      useProtectionStore.getState().setProtection(pending.protection ?? null);
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
      useBattleStore.setState({ ready: isMinigameMode(pending.gameplayMode ?? 'creative') });
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

    const connect = async () => {
      try {
        await registerSelfProfile();
      } catch (error) {
        if (!disposed) {
          store.setStatus('error', error instanceof Error ? error.message : 'Impossible de réserver ce pseudo.');
        }
        return;
      }
      if (disposed) return;
      const next = new WebSocket(endpoint);
      socket.current = next;
      setTeleportSocket(next);
      setChatSocket(next);
      setBattleSocket(next);
      setMinigameSocket(next);
      setProtectionSocket(next);
      next.onopen = () => store.setStatus('online');
      next.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        let data: ServerMessage;
        try {
          data = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }
        if (data.type === 'room-deleted') {
          leaveDeletedRoom(next);
          return;
        }
        if (receiveMinigameMessage(data)) return;
        if (data.type === 'battle-state') {
          receiveBattleState(data);
          return;
        }
        if (data.type === 'battle-elimination') {
          receiveBattleElimination(data);
          return;
        }
        if (data.type === 'battle-respawn') {
          receiveBattleRespawn(data);
          return;
        }
        if (data.type === 'battle-knockback') {
          receiveBattleKnockback(data);
          return;
        }
        if (data.type === 'chat') {
          receiveChatMessage(data);
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
        if (data.type === 'apple-gift') {
          receiveAppleGift(world, data);
          return;
        }
        if ((data.type === 'projectile-spawn' || data.type === 'projectile-state') && isProjectileSnapshot(data.projectile)) {
          applyProjectileSnapshot(world, data.projectile);
          return;
        }
        if (data.type === 'projectile-remove' && typeof data.projectileId === 'string' && isExplosionSnapshot(data.explosion) && isPaintSplashSnapshot(data.paint)) {
          applyProjectileRemoval(world, data.projectileId, data.explosion, data.paint);
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
        if (data.type === 'protection-denied') {
          useGameStore.getState().setNotice('Territoire protégé : tu n’as pas l’autorisation de modifier ces blocs.');
          return;
        }
        if (data.type === 'protection') {
          applyProtection(data.protection);
          return;
        }
        if (data.type === 'world' && (data.seed === null || typeof data.seed === 'number') && Array.isArray(data.edits)) {
          pendingWorld.current = { seed: data.seed, edits: data.edits as Array<[string, ChunkEdit]>, gameplayMode: isGameplayMode(data.gameplayMode) ? data.gameplayMode : 'creative', worldId: typeof data.worldId === 'string' ? data.worldId : undefined, template: data.template === 'city-ancient' || data.template === 'city-modern' ? data.template : 'nature', protection: isWorldProtection(data.protection) ? data.protection : undefined };
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
            setBattleLocalPlayer(data.playerId);
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
      next.onclose = (event) => {
        if (event.code === 4003) {
          if (socket.current === next) socket.current = null;
          store.setEnabled(false);
          store.setStatus('error', 'Tu as été exclu de ce monde. Le créateur peut te réadmettre : rejoins ensuite ce salon.');
          useGameStore.setState({ mode: 'menu' });
          return;
        }
        if (event.code === 4004) {
          leaveDeletedRoom(next);
          return;
        }
        if (socket.current === next) {
          socket.current = null;
          clearTeleportRequests();
          clearChat();
          clearBattle();
    clearMinigames();
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
      if (current?.readyState === WebSocket.OPEN && Date.now() - lastPresence > 60000) {
        lastPresence = Date.now();
        current.send(JSON.stringify({ type: 'presence' }));
      }
      if (!current || current.readyState !== WebSocket.OPEN || useGameStore.getState().mode !== 'play') return;
      const entity = world.queryFirst(Player);
      const position = entity?.get(PlayerPosition);
      const playerState = entity?.get(PlayerState);
      const velocity = entity?.get(PlayerVelocity);
      const mounted = entity?.get(PlayerMount)?.vehicle;
      const horse = entity?.get(PlayerMount)?.kind === 'horse' && mounted
        ? { id: mounted.get(AnimalId)!, ...mounted.get(AnimalPosition)!, yaw: mounted.get(AnimalMotion)?.yaw ?? 0 }
        : undefined;
      if (!position || !playerState) return;
      const moving = Boolean(!mounted && playerState.grounded && !playerState.flying && velocity && Math.hypot(velocity.x, velocity.z) > 0.1);
      const airborne = Boolean(!playerState.grounded || playerState.flying || (velocity && Math.abs(velocity.y) > 2));
      const state: PlayerSnapshot = { ...position, yaw: playerState.yaw, pitch: playerState.pitch, flying: playerState.flying, moving, airborne, mounted: Boolean(mounted), vehicleKind: entity?.get(PlayerMount)?.kind ?? undefined, horse, emote: useEmoteStore.getState().current, selected: useGameStore.getState().selected, effects: activeEffectKeys() };
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
      setProtectionSocket(null);
      clearTeleportRequests();
      clearChat();
      clearBattle();
    clearMinigames();
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
      const force = requestedRoomMode !== null && requestedRoomMode === useGameStore.getState().gameplayMode;
      if (force) requestedRoomMode = null;
      sendWorldInitialization(current, world, force);
    }
  }, [world, generation, enabled]);

  return null;
}
