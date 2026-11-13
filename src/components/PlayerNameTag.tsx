import { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { playerIdentity } from '../game/playerIdentity';
import { PlayerPosition } from '../game/traits';
import { useTribeStore } from '../game/tribes';

export function PlayerNameTag({ name, playerId }: { name: string; playerId?: string }) {
  const world = useWorld();
  const tribes = useTribeStore((state) => state.tribes);
  const [distance, setDistance] = useState<number | null>(null);
  const clock = useRef(0);
  const other = useRef(new Vector3());
  const tagObject = useRef<Group>(null);
  const selfId = playerIdentity();
  const tribe = playerId ? tribes.find((candidate) => candidate.members.some((member) => member.playerId === selfId) && candidate.members.some((member) => member.playerId === playerId)) : undefined;

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
    tagObject.current?.getWorldPosition(other.current);
    const tag = other.current;
    const next = Math.max(0, Math.round(Math.hypot(player.x - tag.x, player.z - tag.z)));
    if (next !== distance) setDistance(next);
  });

  return (
    <group
      name="remote-player-name"
      userData={{ playerName: name, playerId, tribeName: tribe?.name ?? null, distance: tribe ? distance : null }}
      position={[0, 2.6, 0]}
      ref={tagObject}
    >
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ minWidth: 120, padding: '7px 12px', color: '#fff', textAlign: 'center', whiteSpace: 'nowrap', background: 'rgba(12, 22, 32, 0.9)', border: '2px solid rgba(255,255,255,0.72)', fontFamily: 'monospace', fontWeight: 700, textShadow: '2px 2px 0 #15202a' }}>
          <div style={{ fontSize: 18 }}>{name.slice(0, 24)}</div>
          {tribe && <div style={{ marginTop: 4, color: '#b8e69f', fontSize: 15 }}>{tribe.name} · {distance ?? '…'} m</div>}
        </div>
      </Html>
    </group>
  );
}
