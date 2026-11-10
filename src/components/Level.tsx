import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useQuery, useTrait, useWorld } from 'koota/react';
import type { Entity } from 'koota';
import { InstancedMesh, Matrix4 } from 'three';
import { getBlockIndex } from '../game/chunks';
import { buildChunkGeometry, createChunkLookup } from '../game/chunkGeometry';
import { placedBlockGeometry, blockMaterials } from '../game/textures';
import { Chunk, ChunkData } from '../game/traits';
import { SpecialBlocks } from './SpecialBlocks';
import { FoodBlocks } from './FoodBlocks';
import { DoorInstances } from './DoorInstances';
import { CropInstances } from './CropInstances';
import { HunyuanCropInstances } from './HunyuanCropInstances';
import { UtilityBlocks } from './UtilityBlocks';
import { SignBlocks } from './SignBlocks';
import { isCrop, isDoor, isGlass, isSapling, isSign, isTrapdoor, isUtilityBlock } from '../game/extraBlocks';
import { isPirateObjective } from '../game/pirates';
import { BlockKind, isWaterBlock } from '../game/voxel';
import type { Voxel } from '../game/voxel';

const matrix = new Matrix4();
const neighborOffsets = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

function SaplingInstances({ kind, blocks }: { kind: BlockKind; blocks: Voxel[] }) {
  const trunk = useRef<InstancedMesh>(null);
  const bottom = useRef<InstancedMesh>(null);
  const middle = useRef<InstancedMesh>(null);
  const top = useRef<InstancedMesh>(null);
  const pine = kind === BlockKind.PineSapling;
  const leafKind = pine ? BlockKind.PineLeaves : kind === BlockKind.AutumnSapling ? BlockKind.AutumnLeaves : BlockKind.Leaves;

  useLayoutEffect(() => {
    const update = (ref: typeof trunk, transform: (block: Voxel) => void) => {
      if (!ref.current) return;
      blocks.forEach((block, index) => {
        transform(block);
        ref.current!.setMatrixAt(index, matrix);
      });
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
    };
    update(trunk, (block) => {
      matrix.makeScale(0.14, 0.45, 0.14);
      matrix.setPosition(block.x, block.y - 0.275, block.z);
    });
    update(bottom, (block) => {
      if (pine) matrix.makeScale(0.5, 0.25, 0.5);
      else matrix.makeScale(0.38, 0.38, 0.38);
      matrix.setPosition(block.x, block.y - (pine ? 0.1 : 0.05), block.z);
    });
    update(middle, (block) => {
      matrix.makeScale(0.35, 0.3, 0.35);
      matrix.setPosition(block.x, block.y + 0.12, block.z);
    });
    update(top, (block) => {
      matrix.makeScale(0.18, 0.28, 0.18);
      matrix.setPosition(block.x, block.y + 0.32, block.z);
    });
  }, [blocks, pine]);

  return (
    <>
      <instancedMesh ref={trunk} args={[placedBlockGeometry, blockMaterials[BlockKind.Wood], blocks.length]} />
      <instancedMesh ref={bottom} args={[placedBlockGeometry, blockMaterials[leafKind], blocks.length]} />
      {pine && <instancedMesh ref={middle} args={[placedBlockGeometry, blockMaterials[leafKind], blocks.length]} />}
      {pine && <instancedMesh ref={top} args={[placedBlockGeometry, blockMaterials[leafKind], blocks.length]} />}
    </>
  );
}

function VineInstances({ blocks }: { blocks: Voxel[] }) {
  const vertical = useRef<InstancedMesh>(null);
  const crossed = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    for (const [ref, width, depth] of [[vertical, 0.74, 0.08], [crossed, 0.08, 0.74]] as const) {
      if (!ref.current) continue;
      blocks.forEach((block, index) => {
        matrix.makeScale(width, 1, depth);
        matrix.setPosition(block.x, block.y, block.z);
        ref.current!.setMatrixAt(index, matrix);
      });
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
    }
  }, [blocks]);
  return (
    <>
      <instancedMesh ref={vertical} args={[placedBlockGeometry, blockMaterials[BlockKind.JungleVine], blocks.length]} />
      <instancedMesh ref={crossed} args={[placedBlockGeometry, blockMaterials[BlockKind.JungleVine], blocks.length]} />
    </>
  );
}

const ChunkView = memo(function ChunkView({ entity }: { entity: Entity }) {
  const world = useWorld();
  const chunk = useTrait(entity, Chunk);
  const data = entity.get(ChunkData);
  const blockIndex = getBlockIndex(world);
  const view = useMemo(() => {
    const candleBlocks: Voxel[] = [];
    const doorBlocks: Voxel[] = [];
    const cropBlocks: Voxel[] = [];
    const utilityBlocks: Voxel[] = [];
    const signBlocks: Voxel[] = [];
    const vineBlocks: Voxel[] = [];
    const saplingGroups = new Map<BlockKind, Voxel[]>();
    if (!data) return { geometries: [], candleBlocks, doorBlocks, cropBlocks, utilityBlocks, signBlocks, vineBlocks, saplingGroups };
    const lookup = createChunkLookup(data.blocks, blockIndex);
    for (const block of data.blocks) {
      const exposed = neighborOffsets.some(([x, y, z]) => {
        const neighbor = lookup(block.x + x, block.y + y, block.z + z);
        return !neighbor || isWaterBlock(neighbor.kind) || isGlass(neighbor.kind);
      });
      if (!exposed) continue;
      if (block.kind === BlockKind.Candle) {
        candleBlocks.push(block);
        continue;
      }
      if (block.kind === BlockKind.Campfire || block.kind === BlockKind.Wildfire) continue;
      if (block.kind === BlockKind.JungleVine) {
        vineBlocks.push(block);
        continue;
      }
      if (isCrop(block.kind)) {
        cropBlocks.push(block);
        continue;
      }
      if (isSign(block.kind)) {
        signBlocks.push(block);
        continue;
      }
      if (isUtilityBlock(block.kind)) {
        if (!isPirateObjective(block.x, block.y, block.z)) utilityBlocks.push(block);
        continue;
      }
      if (isDoor(block.kind) || isTrapdoor(block.kind)) {
        doorBlocks.push(block);
        continue;
      }
      if (isSapling(block.kind)) {
        const group = saplingGroups.get(block.kind) ?? [];
        group.push(block);
        saplingGroups.set(block.kind, group);
      }
    }
    return { geometries: buildChunkGeometry(data.blocks, blockIndex, lookup), candleBlocks, doorBlocks, cropBlocks, utilityBlocks, signBlocks, vineBlocks, saplingGroups };
  }, [data, blockIndex, chunk?.revision]);
  const { geometries, candleBlocks, doorBlocks, cropBlocks, utilityBlocks, signBlocks, vineBlocks, saplingGroups } = view;
  useEffect(() => () => {
    for (const { geometry } of geometries) geometry.dispose();
  }, [geometries]);

  if (!chunk || !data) return null;
  return (
    <group>
      {geometries.map(({ geometry, material }, index) => (
        <mesh key={index} geometry={geometry} material={material} dispose={null} />
      ))}
      {[...saplingGroups.entries()].map(([kind, values]) => (
        <SaplingInstances key={kind} kind={kind} blocks={values} />
      ))}
      <VineInstances blocks={vineBlocks} />
      <FoodBlocks blocks={data.blocks} />
      <Suspense fallback={<CropInstances blocks={cropBlocks} />}>
        <HunyuanCropInstances blocks={cropBlocks} />
        <CropInstances blocks={cropBlocks.filter((block) => block.kind === BlockKind.Watermelon)} />
      </Suspense>
      <UtilityBlocks blocks={utilityBlocks} blockIndex={blockIndex} />
      <SignBlocks blocks={signBlocks} blockIndex={blockIndex} />
      <SpecialBlocks kind={BlockKind.Candle} blocks={candleBlocks} />
      <DoorInstances blocks={doorBlocks} />
    </group>
  );
});

export function Level() {
  const chunks = useQuery(Chunk);
  return chunks.map((entity) => <ChunkView key={entity} entity={entity} />);
}
