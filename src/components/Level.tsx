import { useLayoutEffect, useRef } from 'react';
import { useQuery, useTrait, useWorld } from 'koota/react';
import type { Entity } from 'koota';
import { InstancedMesh, Matrix4 } from 'three';
import { getBlockIndex } from '../game/chunks';
import { SEA_LEVEL } from '../game/levels';
import type { WaterTile } from '../game/levels';
import { Chunk, ChunkData } from '../game/traits';
import { blockGeometry, blockMaterials } from '../game/textures';
import { BlockKind, voxelKey } from '../game/voxel';
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

function BlockInstances({ kind, blocks }: { kind: BlockKind; blocks: Voxel[] }) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    blocks.forEach((block, index) => {
      if (kind === BlockKind.Apple) {
        matrix.makeScale(0.35, 0.35, 0.35);
        matrix.setPosition(block.x, block.y - 0.28, block.z);
      } else {
        matrix.makeTranslation(block.x, block.y, block.z);
      }
      ref.current!.setMatrixAt(index, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [blocks]);

  return <instancedMesh ref={ref} args={[blockGeometry, blockMaterials[kind], blocks.length]} receiveShadow />;
}

function WaterTiles({ tiles }: { tiles: WaterTile[] }) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    tiles.forEach((tile, index) => {
      matrix.makeRotationX(-Math.PI / 2);
      matrix.setPosition(tile.x, SEA_LEVEL + 0.32, tile.z);
      ref.current!.setMatrixAt(index, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (tiles.length > 0) ref.current.computeBoundingSphere();
  }, [tiles]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, tiles.length]} frustumCulled={false} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial color="#4ba6c8" transparent opacity={0.68} roughness={0.18} metalness={0.08} depthWrite={false} />
    </instancedMesh>
  );
}

function ChunkView({ entity }: { entity: Entity }) {
  const world = useWorld();
  const chunk = useTrait(entity, Chunk);
  const data = entity.get(ChunkData);
  const groups = new Map<BlockKind, Voxel[]>();
  const blockIndex = getBlockIndex(world);
  const blocks: Voxel[] = [];

  if (chunk && data) {
    for (const block of data.blocks) {
      const exposed = neighborOffsets.some(([x, y, z]) =>
        !blockIndex.has(voxelKey(block.x + x, block.y + y, block.z + z)),
      );
      if (!exposed) continue;
      blocks.push(block);
      const group = groups.get(block.kind) ?? [];
      group.push(block);
      groups.set(block.kind, group);
      if (block.kind === BlockKind.Apple) {
        const leaves = groups.get(BlockKind.Leaves) ?? [];
        leaves.push(block);
        groups.set(BlockKind.Leaves, leaves);
      }
    }
  }

  if (!chunk || !data) return null;
  return (
    <group>
      {[...groups.entries()].map(([kind, values]) => (
        <BlockInstances key={kind} kind={kind} blocks={values} />
      ))}
      <WaterTiles tiles={data.water} />
    </group>
  );
}

export function Level() {
  const chunks = useQuery(Chunk);
  return chunks.map((entity) => <ChunkView key={entity} entity={entity} />);
}
