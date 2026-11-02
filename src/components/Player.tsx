import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody } from '@react-three/rapier';
import type { RapierCollider, RapierRigidBody } from '@react-three/rapier';
import { useWorld } from 'koota/react';
import { Player, PlayerBody, PlayerCollider, PlayerPosition } from '../game/traits';
import { PlayerAvatar } from './PlayerAvatar';

export function PlayerView() {
  const world = useWorld();
  const entity = world.queryFirst(Player);
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  useFrame(() => {
    const current = world.queryFirst(Player);
    if (!current) return;
    const bodyHolder = current.get(PlayerBody);
    const colliderHolder = current.get(PlayerCollider);
    if (bodyHolder) bodyHolder.value = body.current;
    if (colliderHolder) colliderHolder.value = collider.current;
  });
  if (!entity) return null;
  const position = entity.get(PlayerPosition)!;

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      canSleep={false}
      position={[position.x, position.y, position.z]}
    >
      <CapsuleCollider
        ref={collider}
        args={[0.55, 0.35]}
        position={[0, 0.9, 0]}
        friction={0}
      />
      <PlayerAvatar entity={entity} />
    </RigidBody>
  );
}
