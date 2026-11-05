import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import type { Group } from 'three';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { CamelLeash, AnimalPosition, Trader, TraderMesh, TraderPosition } from '../game/traits';
import { PixelPart } from './ItemModel';

function TraderPerson({ entity }: { entity: Entity }) {
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const phase = useRef(0);
  useFrame((_, delta) => {
    const walking = entity.get(Trader)?.walking;
    if (walking) phase.current += delta * 5;
    const swing = walking ? Math.sin(phase.current) * 0.45 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
  });
  return (
    <group
      name="wandering-trader"
      ref={(group) => {
        const holder = entity.get(TraderMesh);
        if (holder) holder.value = group;
      }}
    >
      <PixelPart position={[0, 1.05, 0]} size={[0.58, 0.72, 0.34]} color="#6e4f89" />
      <PixelPart position={[0, 0.86, 0]} size={[0.62, 0.1, 0.36]} color="#bf974b" />
      <PixelPart position={[0, 1.65, 0]} size={[0.45, 0.45, 0.45]} color="#cf9b77" />
      <PixelPart position={[0, 1.93, 0]} size={[0.7, 0.14, 0.65]} color="#c7a56b" />
      <PixelPart position={[0, 2.03, 0]} size={[0.44, 0.18, 0.4]} color="#b8965d" />
      <PixelPart position={[-0.38, 1.08, 0.08]} size={[0.22, 0.4, 0.34]} color="#785132" />
      <PixelPart position={[-0.39, 1.28, 0]} size={[0.18, 0.58, 0.2]} color="#6e4f89" />
      <PixelPart position={[0.39, 1.28, 0]} size={[0.18, 0.58, 0.2]} color="#cf9b77" />
      <PixelPart position={[0.55, 0.65, -0.1]} size={[0.08, 1.3, 0.08]} color="#715233" />
      <group ref={leftLeg} position={[-0.16, 0.68, 0]}><PixelPart position={[0, -0.32, 0]} size={[0.22, 0.65, 0.25]} color="#3e3c50" /></group>
      <group ref={rightLeg} position={[0.16, 0.68, 0]}><PixelPart position={[0, -0.32, 0]} size={[0.22, 0.65, 0.25]} color="#3e3c50" /></group>
    </group>
  );
}

function Leash({ entity }: { entity: Entity }) {
  const geometry = useMemo(() => new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const trader = entity.get(CamelLeash)?.trader?.get(TraderPosition);
    const camel = entity.get(AnimalPosition);
    if (!trader || !camel) return;
    const positions = geometry.getAttribute('position');
    positions.setXYZ(0, trader.x + 0.45, trader.y + 1.15, trader.z);
    positions.setXYZ(1, camel.x, camel.y + 1.6, camel.z);
    positions.needsUpdate = true;
  });
  return <lineSegments name="camel-leash" geometry={geometry} frustumCulled={false}><lineBasicMaterial color="#715233" /></lineSegments>;
}

export function Traders() {
  const traders = useQuery(Trader, TraderPosition);
  const camels = useQuery(CamelLeash, AnimalPosition);
  return <>{traders.map((entity) => <TraderPerson key={entity} entity={entity} />)}{camels.map((entity) => <Leash key={entity} entity={entity} />)}</>;
}
