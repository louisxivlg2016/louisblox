import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { applyVoxelEdits, getWorldSeed, groupVoxelEdits, loadLevel, onVoxelEdit, snapshotWorldEdits } from '../game/chunks';
import type { ChunkEdit } from '../game/chunks';
import { isPlayerSnapshot, resolveMultiplayerUrl } from '../game/multiplayer';
import type { PlayerSnapshot } from '../game/multiplayer';
import { useMultiplayerStore, useRemotePlayerStore } from '../game/multiplayerStore';
import { createWorldSave } from '../game/save';
import { useGameStore } from '../game/store';
import { useCharacterStore } from '../game/characterStore';
import { Chunk, Player, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity } from '../game/traits';
import { PixelPart } from './ItemModel';

type ServerMessage = {
  type?: unknown;
  playerId?: unknown;
  character?: unknown;
  name?: unknown;
  state?: unknown;
  players?: unknown;
  seed?: unknown;
  edits?: unknown;
};
type WorldSnapshot = { seed: number | null; edits: Array<[string, ChunkEdit]> };

function RemoteAvatar({ playerId, state, character }: { playerId: string; state: PlayerSnapshot; character: 'boy' | 'girl' }) {
  const group = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const phase = useRef(0);
  const target = useMemo(() => new Vector3(), []);
  const hue = [...playerId].reduce((value, character) => (value * 31 + character.charCodeAt(0)) % 360, 0);
  const girl = character === 'girl';
  const body = girl ? '#9a5f9f' : `hsl(${hue}, 45%, 48%)`;
  const hair = girl ? '#56372e' : '#49382f';
  const legs = girl ? '#4b405e' : '#354d6d';

  useFrame((_, delta) => {
    if (!group.current) return;
    const amount = 1 - Math.exp(-delta * 14);
    target.set(state.x, state.y, state.z);
    group.current.position.lerp(target, amount);
    const angle = Math.atan2(Math.sin(state.yaw - group.current.rotation.y), Math.cos(state.yaw - group.current.rotation.y));
    group.current.rotation.y += angle * amount;
    if (state.moving) phase.current += delta * 8;
    const swing = state.moving ? Math.sin(phase.current) * 0.7 : 0;
    if (leftArm.current) leftArm.current.rotation.x += (swing - leftArm.current.rotation.x) * amount;
    if (rightArm.current) rightArm.current.rotation.x += (-swing - rightArm.current.rotation.x) * amount;
    if (leftLeg.current) leftLeg.current.rotation.x += (-swing - leftLeg.current.rotation.x) * amount;
    if (rightLeg.current) rightLeg.current.rotation.x += (swing - rightLeg.current.rotation.x) * amount;
  });

  return (
    <group ref={group} position={[state.x, state.y, state.z]}>
      <PixelPart position={[0, 1.08, 0]} size={[0.56, 0.66, 0.32]} color={body} />
      <PixelPart position={[0, 1.7, 0]} size={[0.48, 0.48, 0.48]} color="#e7a0aa" />
      <PixelPart position={[0, 1.96, 0]} size={[0.5, 0.1, 0.5]} color={hair} />
      {girl && (
        <>
          <PixelPart position={[0, 1.58, 0.24]} size={[0.5, 0.65, 0.12]} color={hair} />
          <PixelPart position={[-0.24, 1.59, 0.08]} size={[0.1, 0.55, 0.28]} color={hair} />
          <PixelPart position={[0.24, 1.59, 0.08]} size={[0.1, 0.55, 0.28]} color={hair} />
        </>
      )}
      <PixelPart position={[-0.11, 1.74, -0.25]} size={[0.09, 0.07, 0.025]} color="#f4f4ed" />
      <PixelPart position={[0.11, 1.74, -0.25]} size={[0.09, 0.07, 0.025]} color="#f4f4ed" />
      <PixelPart position={[-0.11, 1.74, -0.27]} size={[0.035, 0.05, 0.02]} color="#273b4b" />
      <PixelPart position={[0.11, 1.74, -0.27]} size={[0.035, 0.05, 0.02]} color="#273b4b" />
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
  return Object.entries(players).map(([playerId, state]) => <RemoteAvatar key={playerId} playerId={playerId} state={state} character={characters[playerId] ?? 'boy'} />);
}

export function MultiplayerConnection() {
  const world = useWorld();
  const socket = useRef<WebSocket | null>(null);
  const localPlayerId = useRef<string | null>(null);
  const roster = useRef(new Map<string, string>());
  const pendingWorld = useRef<WorldSnapshot | null>(null);
  const pendingEdits = useRef(new Map<string, ChunkEdit>());
  const applyingRemote = useRef(false);
  const worldInitSent = useRef(false);
  const enabled = useMultiplayerStore((state) => state.enabled);
  const connectionId = useMultiplayerStore((state) => state.connectionId);
  const room = useMultiplayerStore((state) => state.room);
  const server = useMultiplayerStore((state) => state.server);
  const playerName = useMultiplayerStore((state) => state.playerName);
  const character = useCharacterStore((state) => state.character);
  const generation = useGameStore((state) => state.generation);
  const lastGeneration = useRef(generation);

  useEffect(() => {
    const store = useMultiplayerStore.getState();
    const remote = useRemotePlayerStore.getState();
    localPlayerId.current = null;
    roster.current.clear();
    pendingWorld.current = null;
    pendingEdits.current.clear();
    worldInitSent.current = false;
    store.setPlayers([]);
    remote.setPlayers({});
    remote.setCharacters({});
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
    const applyPendingWorld = () => {
      const pending = pendingWorld.current;
      if (!pending || world.query(Chunk).length < 9) return;
      if (pending.seed === null) {
        const current = socket.current;
        if (current?.readyState === WebSocket.OPEN && !worldInitSent.current) {
          current.send(JSON.stringify({ type: 'world-init', seed: getWorldSeed(world), edits: snapshotWorldEdits(world) }));
          worldInitSent.current = true;
        }
        return;
      }
      const saved = createWorldSave(world);
      if (!saved) return;
      const unchanged = saved.seed === pending.seed && JSON.stringify(saved.edits) === JSON.stringify(groupVoxelEdits(pending.edits));
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
      pendingWorld.current = null;
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
    store.setStatus('connecting');

    const connect = () => {
      const next = new WebSocket(endpoint);
      socket.current = next;
      next.onopen = () => store.setStatus('online');
      next.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        let data: ServerMessage;
        try {
          data = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }
        if (data.type === 'world' && (data.seed === null || typeof data.seed === 'number') && Array.isArray(data.edits)) {
          pendingWorld.current = { seed: data.seed, edits: data.edits as Array<[string, ChunkEdit]> };
          applyPendingWorld();
          return;
        }
        if (data.type === 'edits' && Array.isArray(data.edits)) {
          applyingRemote.current = true;
          try {
            applyVoxelEdits(world, data.edits as Array<[string, ChunkEdit]>);
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
            for (const player of data.players as Array<{ playerId?: unknown; name?: unknown; character?: unknown; state?: unknown }>) {
              if (!player || typeof player.playerId !== 'string') continue;
              roster.current.set(player.playerId, typeof player.name === 'string' ? player.name : 'Joueur');
              characters[player.playerId] = player.character === 'girl' ? 'girl' : 'boy';
              if (isPlayerSnapshot(player.state)) updated[player.playerId] = player.state;
            }
            useRemotePlayerStore.getState().setPlayers(updated);
            useRemotePlayerStore.getState().setCharacters(characters);
          } else {
            roster.current.set(data.playerId, name);
            const character = data.character === 'girl' ? 'girl' : 'boy';
            useRemotePlayerStore.setState((current) => ({ characters: { ...current.characters, [data.playerId as string]: character } }));
          }
          syncRoster();
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
            delete players[data.playerId as string];
            delete characters[data.playerId as string];
            return { players, characters };
          });
        }
      };
      next.onerror = () => {
        store.setStatus('error', 'Serveur inaccessible. Nouvelle tentative…');
        next.close();
      };
      next.onclose = () => {
        if (socket.current === next) socket.current = null;
        if (disposed) return;
        localPlayerId.current = null;
        roster.current.clear();
        pendingWorld.current = null;
        pendingEdits.current.clear();
        worldInitSent.current = false;
        store.setPlayers([]);
        useRemotePlayerStore.getState().setPlayers({});
        useRemotePlayerStore.getState().setCharacters({});
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
      const state: PlayerSnapshot = { ...position, yaw: playerState.yaw, pitch: playerState.pitch, flying: playerState.flying, moving };
      current.send(JSON.stringify({ type: 'state', state }));
    }, 50);

    connect();
    return () => {
      disposed = true;
      window.clearInterval(sendTimer);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      unsubscribe();
      const current = socket.current;
      socket.current = null;
      if (current) {
        current.onclose = null;
        current.close();
      }
      localPlayerId.current = null;
      roster.current.clear();
      pendingWorld.current = null;
      pendingEdits.current.clear();
      store.setPlayers([]);
      useRemotePlayerStore.getState().setPlayers({});
      useRemotePlayerStore.getState().setCharacters({});
    };
  }, [world, enabled, connectionId, room, server, playerName, character]);

  useEffect(() => {
    if (lastGeneration.current === generation) return;
    lastGeneration.current = generation;
    if (!enabled) return;
    const current = socket.current;
    if (current?.readyState === WebSocket.OPEN) {
      current.send(JSON.stringify({ type: 'world-init', seed: getWorldSeed(world), edits: [], force: true }));
    }
  }, [world, generation, enabled]);

  return null;
}
