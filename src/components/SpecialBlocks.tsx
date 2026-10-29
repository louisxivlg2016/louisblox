import { MeshBasicMaterial } from 'three';
import { BlockKind } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import { PixelPart } from './ItemModel';

const flameOrange = new MeshBasicMaterial({ color: '#ff9b28' });
const flameYellow = new MeshBasicMaterial({ color: '#ffe890' });
const wildfireOrange = new MeshBasicMaterial({ color: '#ef4925' });
const wildfireYellow = new MeshBasicMaterial({ color: '#ffb12b' });

export function BombModel() {
  return (
    <group>
      <PixelPart position={[0, 0.07, 0]} size={[0.38, 0.14, 0.38]} color="#252b32" />
      <PixelPart position={[0, 0.19, 0]} size={[0.6, 0.16, 0.6]} color="#303943" />
      <PixelPart position={[0, 0.39, 0]} size={[0.78, 0.3, 0.78]} color="#35404c" />
      <PixelPart position={[0, 0.6, 0]} size={[0.64, 0.16, 0.64]} color="#303a46" />
      <PixelPart position={[0, 0.74, 0]} size={[0.4, 0.12, 0.4]} color="#28323d" />
      <PixelPart position={[0, 0.84, 0]} size={[0.2, 0.12, 0.2]} color="#737c82" />
      <PixelPart position={[0, 0.94, 0]} size={[0.07, 0.13, 0.07]} color="#9b7546" />
      <PixelPart position={[0.06, 1.02, 0]} size={[0.13, 0.07, 0.07]} color="#b68c4f" />
      <PixelPart position={[0.12, 1.09, 0]} size={[0.07, 0.1, 0.07]} color="#b68c4f" />
      <PixelPart position={[-0.2, 0.52, -0.4]} size={[0.14, 0.13, 0.025]} color="#758694" />
      <mesh position={[0.12, 1.18, 0]} material={flameOrange}>
        <boxGeometry args={[0.12, 0.12, 0.12]} />
      </mesh>
      <mesh position={[0.12, 1.18, -0.065]} material={flameYellow}>
        <boxGeometry args={[0.055, 0.055, 0.025]} />
      </mesh>
    </group>
  );
}

export function CandleModel() {
  return (
    <group>
      <PixelPart position={[0, 0.05, 0]} size={[0.58, 0.1, 0.58]} color="#a9803d" />
      <PixelPart position={[0, 0.14, 0]} size={[0.42, 0.09, 0.42]} color="#d0a755" />
      <PixelPart position={[0, 0.26, 0]} size={[0.15, 0.18, 0.15]} color="#c2994e" />
      <PixelPart position={[0.24, 0.25, 0]} size={[0.08, 0.2, 0.1]} color="#c2994e" />
      <PixelPart position={[0.18, 0.34, 0]} size={[0.18, 0.07, 0.1]} color="#d0a755" />
      <PixelPart position={[0, 0.58, 0]} size={[0.25, 0.56, 0.25]} color="#f0dfad" />
      <PixelPart position={[0, 0.875, 0]} size={[0.27, 0.05, 0.27]} color="#fff0c9" />
      <PixelPart position={[-0.132, 0.69, 0]} size={[0.035, 0.23, 0.11]} color="#e4cc96" />
      <PixelPart position={[0, 0.94, 0]} size={[0.035, 0.1, 0.035]} color="#4a3829" />
      <mesh position={[0, 1.075, 0]} material={flameOrange}>
        <boxGeometry args={[0.14, 0.2, 0.14]} />
      </mesh>
      <mesh position={[0, 1.065, -0.075]} material={flameYellow}>
        <boxGeometry args={[0.07, 0.13, 0.035]} />
      </mesh>
      <mesh position={[0, 1.205, 0]} material={flameOrange}>
        <boxGeometry args={[0.06, 0.07, 0.06]} />
      </mesh>
      <pointLight position={[0, 1.08, 0]} color="#ffbd62" intensity={1.4} distance={8} decay={2} />
    </group>
  );
}

export function CampfireModel({ destructive = false, withLight = true }: { destructive?: boolean; withLight?: boolean }) {
  const outerFlame = destructive ? wildfireOrange : flameOrange;
  const innerFlame = destructive ? wildfireYellow : flameYellow;
  return (
    <group>
      <mesh position={[0, 0.35, 0]} material={outerFlame}><boxGeometry args={[0.26, 0.38, 0.26]} /></mesh>
      <mesh position={[0, 0.42, -0.02]} material={innerFlame}><boxGeometry args={[0.13, 0.3, 0.13]} /></mesh>
      <mesh position={[0, 0.62, 0]} material={outerFlame}><boxGeometry args={[0.12, 0.16, 0.12]} /></mesh>
      {withLight && <pointLight position={[0, 0.65, 0]} color={destructive ? '#ff632e' : '#ff9b45'} intensity={destructive ? 2.6 : 1.8} distance={destructive ? 13 : 9} decay={2} />}
    </group>
  );
}

export function SpecialBlocks({ kind, blocks }: { kind: BlockKind; blocks: Voxel[] }) {
  return (
    <>
      {blocks.map((block) => (
        <group key={`${block.x},${block.y},${block.z}`} position={[block.x, block.y - 0.5, block.z]}>
          {kind === BlockKind.Tnt ? <BombModel /> : kind === BlockKind.Candle ? <CandleModel /> : <CampfireModel />}
        </group>
      ))}
    </>
  );
}
