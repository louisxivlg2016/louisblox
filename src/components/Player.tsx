import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import type { RapierCollider, RapierRigidBody } from '@react-three/rapier';
import { ColliderDesc, RigidBodyDesc } from '@react-three/rapier/node_modules/@dimforge/rapier3d-compat';
import { useWorld } from 'koota/react';
import type { Group } from 'three';
import { Player, PlayerBody, PlayerCollider, PlayerPosition } from '../game/traits';
import { PlayerAvatar } from './PlayerAvatar';

export function PlayerView() {
  const world = useWorld();
  const { world: physicsWorld } = useRapier();
  const entity = world.queryFirst(Player);
  const root = useRef<Group>(null);
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const position = entity?.get(PlayerPosition);
  const rigidBody = useMemo(() => {
    if (!entity || !position) return null;
    const next = physicsWorld.createRigidBody(RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z));
    const capsule = physicsWorld.createCollider(ColliderDesc.capsule(0.55, 0.35).setTranslation(0, 0.9, 0).setFriction(0), next);
    body.current = next;
    collider.current = capsule;
    const bodyHolder = entity.get(PlayerBody);
    const colliderHolder = entity.get(PlayerCollider);
    if (bodyHolder) bodyHolder.value = next;
    if (colliderHolder) colliderHolder.value = capsule;
    return next;
  }, [physicsWorld, entity, position]);
  useEffect(() => {
    if (!rigidBody) return;
    return () => {
      const player = world.queryFirst(Player);
      const bodyHolder = player?.get(PlayerBody);
      const colliderHolder = player?.get(PlayerCollider);
      if (bodyHolder?.value === rigidBody) bodyHolder.value = null;
      if (colliderHolder) colliderHolder.value = null;
      physicsWorld.removeRigidBody(rigidBody);
    };
  }, [physicsWorld, rigidBody, world]);
  useFrame(() => {
    const current = world.queryFirst(Player);
    if (!current) return;
    const currentPosition = current.get(PlayerPosition);
    if (root.current && currentPosition) root.current.position.copy(currentPosition);
    const bodyHolder = current.get(PlayerBody);
    const colliderHolder = current.get(PlayerCollider);
    if (bodyHolder) bodyHolder.value = body.current;
    if (colliderHolder) colliderHolder.value = collider.current;
  });
  if (!entity) return null;

  return <group ref={root} name="local-player"><PlayerAvatar entity={entity} /></group>;
}
