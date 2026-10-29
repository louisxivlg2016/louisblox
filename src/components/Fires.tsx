import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useQuery, useQueryFirst } from 'koota/react';
import type { Entity } from 'koota';
import type { Group } from 'three';
import { Fire, FirePosition, Player, PlayerPosition } from '../game/traits';
import { BlockKind } from '../game/voxel';
import { CampfireModel } from './SpecialBlocks';

function FireView({ entity, lit }: { entity: Entity; lit: boolean }) {
  const group = useRef<Group>(null);
  const position = entity.get(FirePosition)!;
  const destructive = entity.get(Fire)!.kind === BlockKind.Wildfire;
  useFrame(() => {
    if (!group.current) return;
    const age = entity.get(Fire)?.age ?? 0;
    group.current.scale.setScalar(1.2 + Math.min(age / 20, 1.6));
  });
  return (
    <group ref={group} position={[position.x, position.y - 0.5, position.z]}>
      <CampfireModel destructive={destructive} withLight={lit} />
    </group>
  );
}

export function Fires() {
  const fires = useQuery(Fire, FirePosition);
  const player = useQueryFirst(Player);
  const playerPosition = player?.get(PlayerPosition);
  const distance = (entity: Entity) => {
    const position = entity.get(FirePosition)!;
    return playerPosition ? position.distanceToSquared(playerPosition) : 0;
  };
  const nearest = new Set([...fires].sort((a, b) => distance(a) - distance(b)).slice(0, 4));
  return fires.map((entity) => <FireView key={entity} entity={entity} lit={nearest.has(entity)} />);
}
