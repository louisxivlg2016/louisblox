import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import type { ReactNode } from 'react';

const position = new Vector3();

export function DecorationCulling({ children, distance = 80 }: { children: ReactNode; distance?: number }) {
  const group = useRef<Group>(null);
  const nextUpdate = useRef(0);
  useFrame(({ camera, clock }) => {
    if (!group.current || clock.elapsedTime < nextUpdate.current) return;
    nextUpdate.current = clock.elapsedTime + 0.25;
    const limit = distance * distance;
    for (const child of group.current.children) {
      child.getWorldPosition(position);
      child.visible = position.distanceToSquared(camera.position) <= limit;
    }
  });
  return <group ref={group}>{children}</group>;
}
