import { useSkyfallStore } from '../game/skyfallClient';
import { BombModel } from './SpecialBlocks';
import { PixelPart } from './ItemModel';

export function SkyfallBlocks() {
  const blocks = useSkyfallStore((state) => state.blocks);
  return blocks.map((block) => (
    <group key={block.id} name={`skyfall-${block.kind}`} position={[block.x, block.y, block.z]}>
      {block.kind === 'tnt' ? <BombModel /> : block.kind === 'anvil' ? <PixelPart position={[0, 0, 0]} size={[1.2, 0.65, 0.8]} color="#30343a" /> : <PixelPart position={[0, 0, 0]} size={[1, 1, 1]} color="#67b83c" />}
    </group>
  ));
}
