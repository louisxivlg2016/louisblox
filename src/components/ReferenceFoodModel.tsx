import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Mesh, NearestFilter } from 'three';
import type { GalleryItemId, ItemKind } from '../game/items';
import cookedChickenUrl from '../../assets/models/food-cooked-chicken.glb';
import rawChickenUrl from '../../assets/models/food-raw-chicken.glb';
import rawSalmonUrl from '../../assets/models/food-raw-salmon.glb';
import cookedSalmonUrl from '../../assets/models/food-cooked-salmon.glb';
import cheeseSliceUrl from '../../assets/models/food-cheese-slice.glb';
import tomatoUrl from '../../assets/models/food-tomato.glb';
import rawMeatUrl from '../../assets/models/food-raw-meat.glb';
import cookedMeatUrl from '../../assets/models/food-cooked-meat.glb';
import cookedCornUrl from '../../assets/models/food-cooked-corn.glb';
import breadUrl from '../../assets/models/food-bread.glb';
import cookedChickenIcon from '../../assets/food-icons/cooked-chicken.png';
import rawChickenIcon from '../../assets/food-icons/raw-chicken.png';
import rawSalmonIcon from '../../assets/food-icons/raw-salmon.png';
import cookedSalmonIcon from '../../assets/food-icons/cooked-salmon.png';
import cheeseSliceIcon from '../../assets/food-icons/cheese-slice.png';
import tomatoIcon from '../../assets/food-icons/tomato.png';
import rawMeatIcon from '../../assets/food-icons/raw-meat.png';
import cookedMeatIcon from '../../assets/food-icons/cooked-meat.png';
import cookedCornIcon from '../../assets/food-icons/cooked-corn.png';
import breadIcon from '../../assets/food-icons/bread.png';
import cheeseWheelUrl from '../../assets/models/food-cheese-wheel.glb';
import cakeUrl from '../../assets/models/food-cake.glb';
import milkUrl from '../../assets/models/food-milk.glb';
import wheatUrl from '../../assets/models/food-wheat.glb';
import carrotUrl from '../../assets/models/food-carrot.glb';
import cheeseWheelIcon from '../../assets/food-icons/cheese-wheel.png';
import cakeIcon from '../../assets/food-icons/cake.png';
import milkIcon from '../../assets/food-icons/milk.png';
import wheatIcon from '../../assets/food-icons/wheat.png';
import carrotIcon from '../../assets/food-icons/carrot.png';

export const referenceFoodModels = {
  cooked_chicken: cookedChickenUrl,
  raw_chicken: rawChickenUrl,
  raw_salmon: rawSalmonUrl,
  cooked_salmon: cookedSalmonUrl,
  cheese_slice: cheeseSliceUrl,
  tomato: tomatoUrl,
  raw_meat: rawMeatUrl,
  cooked_meat: cookedMeatUrl,
  corn: cookedCornUrl,
  cooked_corn: cookedCornUrl,
  bread: breadUrl,
  cheese_wheel: cheeseWheelUrl,
  cake: cakeUrl,
  milk: milkUrl,
  wheat: wheatUrl,
  carrot: carrotUrl,
};
export const referenceFoodIcons = {
  cooked_chicken: cookedChickenIcon,
  raw_chicken: rawChickenIcon,
  raw_salmon: rawSalmonIcon,
  cooked_salmon: cookedSalmonIcon,
  cheese_slice: cheeseSliceIcon,
  tomato: tomatoIcon,
  raw_meat: rawMeatIcon,
  cooked_meat: cookedMeatIcon,
  corn: cookedCornIcon,
  cooked_corn: cookedCornIcon,
  bread: breadIcon,
  cheese_wheel: cheeseWheelIcon,
  cake: cakeIcon,
  milk: milkIcon,
  wheat: wheatIcon,
  carrot: carrotIcon,
};
export type ReferenceFoodKind = keyof typeof referenceFoodModels;
export function isReferenceFood(kind: ItemKind | GalleryItemId): kind is ReferenceFoodKind {
  return kind in referenceFoodModels;
}

export function ReferenceFoodModel({ kind }: { kind: ReferenceFoodKind }) {
  const { scene } = useGLTF(referenceFoodModels[kind]);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.name = `food-${kind}`;
    clone.scale.setScalar(kind === 'cake' ? 1.25 : 1);
    clone.userData.source = 'Hunyuan';
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.material = Array.isArray(object.material) ? object.material.map((material) => material.clone()) : object.material.clone();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material.map) continue;
        material.map.magFilter = NearestFilter;
        material.map.minFilter = NearestFilter;
        material.map.generateMipmaps = false;
        material.map.needsUpdate = true;
      }
    });
    const bounds = new Box3().setFromObject(clone);
    const center = bounds.getCenter(clone.position.clone());
    clone.position.set(-center.x, -bounds.min.y, -center.z);
    return clone;
  }, [scene, kind]);
  return <primitive object={model} />;
}
