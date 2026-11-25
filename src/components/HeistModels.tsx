import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import { useHeistStore } from '../game/heistClient';
import { HEIST_LOOT } from '../game/heistCity';
import { PixelPart } from './ItemModel';
import handcuffsUrl from '../../assets/models/handcuffs.glb';
import goldBagUrl from '../../assets/models/gold-bag.glb';

function ScaledModel({ url, height }: { url: string; height: number }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const bounds = new Box3().setFromObject(clone);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const scale = height / Math.max(size.y, 0.001);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return clone;
  }, [scene, height]);
  return <primitive object={model} />;
}

export function HandcuffsModel() {
  return <ScaledModel url={handcuffsUrl} height={0.45} />;
}

export function GoldBagModel() {
  return <ScaledModel url={goldBagUrl} height={0.65} />;
}

export function HeistLoot() {
  const respawns = useHeistStore((state) => state.lootRespawns);
  const traps = useHeistStore((state) => state.traps);
  const now = Date.now();
  return (
    <>
      {HEIST_LOOT.filter((loot) => (respawns[loot.id] ?? 0) <= now).map((loot) => (
        <group key={loot.id} name={`heist-loot-${loot.id}`} position={[loot.x, loot.y - 0.45, loot.z]}><GoldBagModel /></group>
      ))}
      {traps.map((trap) => <group key={`${trap.x},${trap.y},${trap.z}`} position={[trap.x, trap.y - 0.45, trap.z]}><PixelPart position={[0, 0, 0]} size={[0.9, 0.08, 0.9]} color="#6b5b78" /></group>)}
    </>
  );
}
