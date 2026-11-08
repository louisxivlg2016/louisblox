import { Suspense, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { CamelLeash, AnimalPosition, Trader, TraderMesh, TraderPosition } from '../game/traits';
import { ReferenceTrader } from './ReferenceAnimals';
import { TraderBubble } from './TraderBubble';

function TraderPerson({ entity }: { entity: Entity }) {
  return (
    <group
      name="wandering-trader"
      ref={(group) => {
        const holder = entity.get(TraderMesh);
        if (holder) holder.value = group;
      }}
    >
      <Suspense fallback={null}><ReferenceTrader entity={entity} /></Suspense>
      <TraderBubble entity={entity} />
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
