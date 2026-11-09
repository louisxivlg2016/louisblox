import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Mesh, NearestFilter } from 'three';
import type { Group } from 'three';
import { BlockKind } from '../game/voxel';
import type { Voxel } from '../game/voxel';
import wheatUrl from '../../assets/models/crop-wheat.glb';
import carrotUrl from '../../assets/models/crop-carrot.glb';
import cornUrl from '../../assets/models/crop-corn.glb';
import tomatoUrl from '../../assets/models/crop-tomato.glb';

const cropModels: Partial<Record<BlockKind, string>> = {
  [BlockKind.Wheat]: wheatUrl,
  [BlockKind.Carrot]: carrotUrl,
  [BlockKind.Corn]: cornUrl,
  [BlockKind.Tomato]: tomatoUrl,
};
for (const model of Object.values(cropModels)) useGLTF.preload(model);

function CropModel({ block, scene }: { block: Voxel; scene: Group }) {
  const model = useMemo(() => {
    const clone = scene.clone(true);
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
    return clone;
  }, [scene]);
  const stage = block.growth ?? 3;
  const scale = [0.18, 0.4, 0.7, 1][stage];
  const cropName = block.kind === BlockKind.Wheat ? 'wheat' : block.kind === BlockKind.Carrot ? 'carrot' : block.kind === BlockKind.Corn ? 'corn' : 'tomato';
  return <group name={`crop-${cropName}`} userData={{ source: 'Hunyuan', growth: stage }} position={[block.x, block.y - 0.5, block.z]} scale={scale * 0.6}><primitive object={model} /></group>;
}

export function HunyuanCropInstances({ blocks }: { blocks: Voxel[] }) {
  const wheat = useGLTF(wheatUrl).scene;
  const carrot = useGLTF(carrotUrl).scene;
  const corn = useGLTF(cornUrl).scene;
  const tomato = useGLTF(tomatoUrl).scene;
  const scenes: Partial<Record<BlockKind, Group>> = { [BlockKind.Wheat]: wheat, [BlockKind.Carrot]: carrot, [BlockKind.Corn]: corn, [BlockKind.Tomato]: tomato };
  return blocks.map((block) => {
    const scene = scenes[block.kind];
    return scene ? <CropModel key={`${block.x},${block.y},${block.z}`} block={block} scene={scene} /> : null;
  });
}
