import { CapsuleCollider, RigidBody } from '@react-three/rapier';
import { useQueryFirst } from 'koota/react';
import { Player, PlayerBody, PlayerCollider, PlayerPosition } from '../game/traits';
import { PlayerAvatar } from './PlayerAvatar';

export function PlayerView() {
  const entity = useQueryFirst(Player);
  if (!entity) return null;

  const position = entity.get(PlayerPosition)!;

  return (
    <RigidBody
      ref={(body) => {
        const holder = entity.get(PlayerBody);
        if (holder) holder.value = body;
      }}
      type="kinematicPosition"
      colliders={false}
      canSleep={false}
      position={[position.x, position.y, position.z]}
    >
      <CapsuleCollider
        ref={(collider) => {
          const holder = entity.get(PlayerCollider);
          if (holder) holder.value = collider;
        }}
        args={[0.55, 0.35]}
        position={[0, 0.9, 0]}
        friction={0}
      />
      <PlayerAvatar />
    </RigidBody>
  );
}
