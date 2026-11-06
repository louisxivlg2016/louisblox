import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { PixelPart } from './ItemModel';

export function SoldierDetails() {
  const root = useRef<Group>(null);
  const leftSleeve = useRef<Group>(null);
  const rightSleeve = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  useFrame(() => {
    const rig = root.current?.parent?.getObjectByName('full-character')?.children[0]?.userData.rig;
    if (!rig) return;
    for (const [part, group] of [['leftArm', leftSleeve], ['rightArm', rightSleeve], ['leftLeg', leftLeg], ['rightLeg', rightLeg]] as const) {
      if (group.current && rig[part] && group.current.parent !== rig[part]) rig[part].add(group.current);
    }
  });
  return (
    <group ref={root} name="soldier-outfit">
      <PixelPart position={[0, 1.17, 0]} size={[0.59, 0.68, 0.37]} color="#293e74" />
      <PixelPart position={[0, 1.13, -0.202]} size={[0.105, 0.78, 0.045]} color="#e9ece6" rotation={[0, 0, 0.52]} />
      <PixelPart position={[0, 1.13, -0.206]} size={[0.105, 0.78, 0.045]} color="#e9ece6" rotation={[0, 0, -0.52]} />
      <PixelPart position={[0, 0.82, 0]} size={[0.53, 0.2, 0.35]} color="#eef0e8" />
      <PixelPart position={[0, 2.02, 0]} size={[0.82, 0.17, 0.57]} color="#1d2530" />
      <PixelPart position={[0, 2.13, 0.04]} size={[0.57, 0.19, 0.42]} color="#202733" />
      <PixelPart position={[0, 2.24, 0.09]} size={[0.35, 0.12, 0.29]} color="#252c38" />
      <PixelPart position={[0.26, 2.11, -0.3]} size={[0.13, 0.16, 0.06]} color="#b6383e" />
      <PixelPart position={[0.26, 2.11, -0.338]} size={[0.065, 0.11, 0.025]} color="#e9ece7" />
      <PixelPart position={[0.26, 2.11, -0.355]} size={[0.03, 0.065, 0.016]} color="#304e98" />
      <group ref={leftSleeve} name="soldier-left-sleeve"><PixelPart position={[0, -0.28, 0]} size={[0.27, 0.5, 0.29]} color="#293e74" /><PixelPart position={[0, -0.53, 0]} size={[0.28, 0.14, 0.3]} color="#ad343c" /></group>
      <group ref={rightSleeve} name="soldier-right-sleeve"><PixelPart position={[0, -0.28, 0]} size={[0.27, 0.5, 0.29]} color="#293e74" /><PixelPart position={[0, -0.53, 0]} size={[0.28, 0.14, 0.3]} color="#ad343c" /></group>
      <group ref={leftLeg} name="soldier-left-leg"><PixelPart position={[0, -0.23, 0]} size={[0.26, 0.46, 0.3]} color="#e4e7e1" /><PixelPart position={[0, -0.56, 0]} size={[0.25, 0.25, 0.28]} color="#42474b" /><PixelPart position={[0, -0.74, -0.025]} size={[0.27, 0.16, 0.35]} color="#222a32" /></group>
      <group ref={rightLeg} name="soldier-right-leg"><PixelPart position={[0, -0.23, 0]} size={[0.26, 0.46, 0.3]} color="#e4e7e1" /><PixelPart position={[0, -0.56, 0]} size={[0.25, 0.25, 0.28]} color="#42474b" /><PixelPart position={[0, -0.74, -0.025]} size={[0.27, 0.16, 0.35]} color="#222a32" /></group>
    </group>
  );
}
