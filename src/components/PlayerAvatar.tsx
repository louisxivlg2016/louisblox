import { useQueryFirst } from 'koota/react';
import { getItemMeta } from '../game/items';
import { useGameStore } from '../game/store';
import { Player, PlayerMesh } from '../game/traits';
import { blockGeometry, blockMaterials } from '../game/textures';
import { ItemModel, PixelPart } from './ItemModel';
import { BombModel, CandleModel, CampfireModel } from './SpecialBlocks';
import { UtilityBlockModel } from './UtilityBlocks';
import { isUtilityBlock } from '../game/extraBlocks';
import { BlockKind } from '../game/voxel';

export function PlayerAvatar() {
  const entity = useQueryFirst(Player);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const equipped = useGameStore((state) => state.equippedArmor);
  const selected = useGameStore((state) => state.selected);
  const riding = useGameStore((state) => state.riding);
  if (!entity) return null;
  const armor = equipped ? getItemMeta(`armor_${equipped}`).color : null;
  const body = armor ?? '#4d83a7';
  const limbs = armor ?? '#e7a0aa';
  return (
    <group
      ref={(group) => {
        const holder = entity.get(PlayerMesh);
        if (holder) holder.value = group;
      }}
      visible={cameraMode === 'third' && riding !== 'plane' && riding !== 'train'}
    >
      <PixelPart position={[0, 1.08, 0]} size={[0.56, 0.66, 0.32]} color={body} />
      <PixelPart position={[0, 1.7, 0]} size={[0.48, 0.48, 0.48]} color="#e7a0aa" />
      <PixelPart position={[0, 1.96, 0]} size={[0.5, 0.1, 0.5]} color="#49382f" />
      <PixelPart position={[-0.11, 1.74, -0.25]} size={[0.09, 0.07, 0.025]} color="#f4f4ed" />
      <PixelPart position={[0.11, 1.74, -0.25]} size={[0.09, 0.07, 0.025]} color="#f4f4ed" />
      <PixelPart position={[-0.11, 1.74, -0.27]} size={[0.035, 0.05, 0.02]} color="#273b4b" />
      <PixelPart position={[0.11, 1.74, -0.27]} size={[0.035, 0.05, 0.02]} color="#273b4b" />
      <PixelPart position={[0, 1.62, -0.27]} size={[0.1, 0.08, 0.08]} color="#d98e9b" />
      <PixelPart position={[-0.39, 1.07, 0]} size={[0.19, 0.66, 0.21]} color={limbs} />
      <PixelPart position={[0.39, 1.07, 0]} size={[0.19, 0.66, 0.21]} color={limbs} />
      {riding ? (
        <>
          <PixelPart position={[-0.3, 0.58, -0.22]} size={[0.23, 0.25, 0.62]} color={armor ?? '#354d6d'} />
          <PixelPart position={[0.3, 0.58, -0.22]} size={[0.23, 0.25, 0.62]} color={armor ?? '#354d6d'} />
          <PixelPart position={[-0.3, 0.27, -0.47]} size={[0.23, 0.5, 0.25]} color={armor ?? '#354d6d'} />
          <PixelPart position={[0.3, 0.27, -0.47]} size={[0.23, 0.5, 0.25]} color={armor ?? '#354d6d'} />
        </>
      ) : (
        <>
          <PixelPart position={[-0.15, 0.4, 0]} size={[0.23, 0.76, 0.27]} color={armor ?? '#354d6d'} />
          <PixelPart position={[0.15, 0.4, 0]} size={[0.23, 0.76, 0.27]} color={armor ?? '#354d6d'} />
        </>
      )}
      <PixelPart position={[-0.15, 0.07, -0.04]} size={[0.25, 0.14, 0.34]} color={armor ?? '#302b2b'} />
      <PixelPart position={[0.15, 0.07, -0.04]} size={[0.25, 0.14, 0.34]} color={armor ?? '#302b2b'} />
      {armor && (
        <>
          <PixelPart position={[0, 1.97, 0]} size={[0.58, 0.14, 0.58]} color={armor} />
          <PixelPart position={[-0.26, 1.74, 0]} size={[0.09, 0.4, 0.55]} color={armor} />
          <PixelPart position={[0.26, 1.74, 0]} size={[0.09, 0.4, 0.55]} color={armor} />
          <PixelPart position={[0, 1.76, 0.26]} size={[0.52, 0.42, 0.08]} color={armor} />
          <PixelPart position={[0, 1.9, -0.27]} size={[0.56, 0.1, 0.07]} color={armor} />
          <PixelPart position={[0, 1.73, -0.3]} size={[0.055, 0.25, 0.05]} color={armor} />
          <PixelPart position={[0, 1.13, -0.18]} size={[0.4, 0.42, 0.07]} color={armor} />
          <PixelPart position={[-0.4, 1.34, 0]} size={[0.28, 0.2, 0.32]} color={armor} />
          <PixelPart position={[0.4, 1.34, 0]} size={[0.28, 0.2, 0.32]} color={armor} />
        </>
      )}
      <group position={[0.52, 0.92, -0.24]} scale={typeof selected === 'string' && getItemMeta(selected).category === 'vehicle' ? 0.2 : 0.72}>
        {typeof selected === 'number'
          ? selected === BlockKind.Tnt ? <BombModel /> : selected === BlockKind.Candle ? <CandleModel /> : selected === BlockKind.Campfire ? <CampfireModel /> : isUtilityBlock(selected) ? <UtilityBlockModel kind={selected} /> : <mesh args={[blockGeometry, blockMaterials[selected]]} />
          : <ItemModel kind={selected} />}
      </group>
    </group>
  );
}
