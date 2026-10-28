import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import tntUrl from '../../assets/models/tnt.glb';
import candleUrl from '../../assets/models/candle.glb';
import { BlockKind } from '../game/voxel';
import type { Voxel } from '../game/voxel';

export function SpecialBlocks({ kind, blocks }: { kind: BlockKind; blocks: Voxel[] }) {
  const { scene: tntScene } = useGLTF(tntUrl);
  const { scene: candleScene } = useGLTF(candleUrl);
  const source = kind === BlockKind.Tnt ? tntScene : candleScene;
  return (
    <>
      {blocks.map((block) => (
        <SpecialBlock key={`${block.x},${block.y},${block.z}`} source={source} kind={kind} block={block} />
      ))}
    </>
  );
}

function SpecialBlock({ source, kind, block }: { source: import('three').Group; kind: BlockKind; block: Voxel }) {
  const model = useMemo(() => source.clone(true), [source]);
  return (
    <group position={[block.x, block.y - 0.2, block.z]} scale={0.85}>
      <primitive object={model} />
      {kind === BlockKind.Candle && (
        <pointLight position={[0, 0.65, 0]} color="#ffbd62" intensity={1.2} distance={7} decay={2} />
      )}
    </group>
  );
}
