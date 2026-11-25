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

export function HeistGuardBot() {
  const bot = useHeistStore((state) => state.bot);
  if (!bot.enabled) return null;
  return <group name="heist-guard-bot" position={[bot.x, bot.y, bot.z]} rotation={[0, bot.yaw, 0]}>
    <PixelPart position={[0, 1.05, 0]} size={[0.62, 0.72, 0.36]} color="#315d9b" />
    <PixelPart position={[0, 1.68, 0]} size={[0.48, 0.48, 0.48]} color="#d9aa80" />
    <PixelPart position={[0, 1.94, 0]} size={[0.6, 0.16, 0.58]} color="#1e385f" />
    <PixelPart position={[0, 1.73, 0.255]} size={[0.13, 0.08, 0.03]} color="#f4f7ff" />
    <PixelPart position={[-0.43, 1.04, 0]} size={[0.2, 0.68, 0.24]} color="#315d9b" />
    <PixelPart position={[0.43, 1.04, 0]} size={[0.2, 0.68, 0.24]} color="#315d9b" />
    <PixelPart position={[-0.18, 0.37, 0]} size={[0.25, 0.72, 0.28]} color="#203b63" />
    <PixelPart position={[0.18, 0.37, 0]} size={[0.25, 0.72, 0.28]} color="#203b63" />
    <group position={[0.55, 1.05, 0.2]}><HandcuffsModel /></group>
  </group>;
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
      <HeistGuardBot />
      {[-35, -33, -31, -29].map((z) => <mesh key={z} name="museum-laser" position={[0, 9, z]}><boxGeometry args={[21, 0.045, 0.045]} /><meshBasicMaterial color="#ff2638" toneMapped={false} /></mesh>)}
      {[31, 39].map((x) => <group key={x} name="bank-motion-detector" position={[x, 10.5, -13]}><PixelPart position={[0, 0, 0]} size={[0.35, 0.35, 0.35]} color="#252b32" /><PixelPart position={[0, 0, 0.2]} size={[0.18, 0.18, 0.08]} color="#ff2638" /></group>)}
    </>
  );
}
