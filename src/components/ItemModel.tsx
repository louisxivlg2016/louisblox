import { animalMaterial } from '../game/animalTextures';
import { ITEM_META } from '../game/items';
import type { ItemKind } from '../game/items';

type ModelProps = { kind: ItemKind; held?: boolean };
type PartProps = { position: [number, number, number]; size: [number, number, number]; color: string; rotation?: [number, number, number] };

export function PixelPart({ position, size, color, rotation }: PartProps) {
  return (
    <mesh position={position} rotation={rotation} material={animalMaterial(color)} dispose={null}>
      <boxGeometry args={size} />
    </mesh>
  );
}

export function SwordModel({ color }: { color: string }) {
  return (
    <group rotation={[0, 0, -0.35]}>
      <PixelPart position={[0, -0.35, 0]} size={[0.12, 0.42, 0.12]} color="#61412b" />
      <PixelPart position={[0, -0.11, 0]} size={[0.5, 0.11, 0.14]} color={color} />
      <PixelPart position={[0, 0.35, 0]} size={[0.18, 0.82, 0.09]} color={color} />
      <PixelPart position={[-0.05, 0.35, -0.052]} size={[0.045, 0.72, 0.02]} color="#eefaff" />
      <PixelPart position={[0, 0.83, 0]} size={[0.11, 0.16, 0.09]} color={color} />
    </group>
  );
}

export function BowModel({ crossbow = false }: { crossbow?: boolean }) {
  if (crossbow) return (
    <group>
      <PixelPart position={[0, -0.12, 0]} size={[0.13, 0.8, 0.13]} color="#735034" />
      <PixelPart position={[0, 0.26, 0]} size={[0.94, 0.12, 0.12]} color="#a3a8a5" />
      <PixelPart position={[0, 0.26, -0.07]} size={[0.7, 0.035, 0.03]} color="#e5e1cb" />
      <PixelPart position={[0, 0.43, 0]} size={[0.035, 0.42, 0.035]} color="#e5e1cb" />
    </group>
  );
  return (
    <group>
      <PixelPart position={[0.21, 0, 0]} size={[0.12, 0.5, 0.13]} color="#986337" />
      <PixelPart position={[0.12, 0.42, 0]} size={[0.12, 0.38, 0.13]} color="#a87944" rotation={[0, 0, 0.48]} />
      <PixelPart position={[0.12, -0.42, 0]} size={[0.12, 0.38, 0.13]} color="#a87944" rotation={[0, 0, -0.48]} />
      <PixelPart position={[-0.06, 0, 0]} size={[0.026, 1.16, 0.03]} color="#e8e2ca" />
      <PixelPart position={[-0.05, 0.02, -0.07]} size={[0.74, 0.035, 0.035]} color="#c7c6b4" />
      <PixelPart position={[0.3, 0.02, -0.07]} size={[0.12, 0.09, 0.05]} color="#d7e1df" />
    </group>
  );
}

export function GunModel({ color, bomb }: { color: string; bomb?: boolean }) {
  return (
    <group>
      <PixelPart position={[0, -0.22, 0.07]} size={[0.18, 0.43, 0.22]} color="#4f3527" />
      <PixelPart position={[0, 0.04, 0]} size={[0.27, 0.24, 0.55]} color={color} />
      <PixelPart position={[0, 0.08, -0.38]} size={[bomb ? 0.29 : 0.16, bomb ? 0.29 : 0.16, 0.38]} color="#454d56" />
      <PixelPart position={[0, 0.08, -0.59]} size={[bomb ? 0.22 : 0.1, bomb ? 0.22 : 0.1, 0.035]} color="#181e26" />
      <PixelPart position={[0, 0.21, 0.08]} size={[0.07, 0.1, 0.07]} color={color} />
      {bomb && <PixelPart position={[0, 0.22, -0.2]} size={[0.09, 0.08, 0.1]} color="#e7c04b" />}
    </group>
  );
}

export function FoodModel({ kind }: { kind: ItemKind }) {
  const color = ITEM_META[kind].color;
  if (kind === 'bread') return (
    <group rotation={[0.2, 0, -0.3]}>
      <PixelPart position={[0, 0, 0]} size={[0.64, 0.32, 0.34]} color={color} />
      {[-0.18, 0, 0.18].map((x) => <PixelPart key={x} position={[x, 0.17, -0.03]} size={[0.06, 0.03, 0.23]} color="#f3d18b" />)}
    </group>
  );
  if (kind === 'cooked_meat') return (
    <group rotation={[0.2, 0, -0.35]}>
      <PixelPart position={[0, 0.04, 0]} size={[0.43, 0.52, 0.26]} color={color} />
      <PixelPart position={[0, -0.34, 0]} size={[0.1, 0.32, 0.1]} color="#ead7af" />
      <PixelPart position={[0, -0.5, 0]} size={[0.23, 0.12, 0.12]} color="#f3e7c9" />
    </group>
  );
  return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.45, 0.44, 0.43]} color={color} />
      <PixelPart position={[0, 0.28, 0]} size={[0.07, 0.18, 0.07]} color="#68422a" />
      <PixelPart position={[0.13, 0.27, 0]} size={[0.22, 0.07, 0.16]} color="#659243" />
      <PixelPart position={[-0.1, 0.1, -0.23]} size={[0.09, 0.1, 0.025]} color="#ef9b83" />
    </group>
  );
}

export function ArmorModel({ color }: { color: string }) {
  return (
    <group>
      <PixelPart position={[0, 0.48, 0]} size={[0.5, 0.36, 0.4]} color={color} />
      <PixelPart position={[0, 0.38, -0.22]} size={[0.36, 0.07, 0.035]} color="#293944" />
      <PixelPart position={[0, -0.06, 0]} size={[0.5, 0.6, 0.3]} color={color} />
      <PixelPart position={[-0.36, 0.12, 0]} size={[0.24, 0.25, 0.35]} color={color} />
      <PixelPart position={[0.36, 0.12, 0]} size={[0.24, 0.25, 0.35]} color={color} />
      <PixelPart position={[-0.15, -0.52, 0]} size={[0.19, 0.35, 0.27]} color={color} />
      <PixelPart position={[0.15, -0.52, 0]} size={[0.19, 0.35, 0.27]} color={color} />
    </group>
  );
}

export function SaddleModel() {
  return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.75, 0.12, 0.65]} color="#694027" />
      <PixelPart position={[0, 0.14, 0]} size={[0.58, 0.2, 0.46]} color="#a06a3c" />
      <PixelPart position={[0, 0.3, 0.19]} size={[0.58, 0.2, 0.11]} color="#714126" />
      <PixelPart position={[0, -0.2, 0]} size={[0.12, 0.38, 0.56]} color="#d2af61" />
    </group>
  );
}

export function CarModel({ color = '#d63935' }: { color?: string }) {
  return (
    <group>
      <PixelPart position={[0, 0.38, 0]} size={[1.65, 0.38, 3.1]} color={color} />
      <PixelPart position={[0, 0.73, 0.23]} size={[1.32, 0.46, 1.45]} color={color} />
      <PixelPart position={[0, 0.81, -0.53]} size={[1.15, 0.3, 0.07]} color="#8ac4d8" />
      <PixelPart position={[-0.67, 0.79, 0.19]} size={[0.055, 0.26, 0.92]} color="#75b2ca" />
      <PixelPart position={[0.67, 0.79, 0.19]} size={[0.055, 0.26, 0.92]} color="#75b2ca" />
      <PixelPart position={[0, 0.59, -1.25]} size={[1.5, 0.1, 0.56]} color={color} />
      <PixelPart position={[0, 0.88, 1.42]} size={[1.58, 0.12, 0.3]} color="#333d48" />
      <PixelPart position={[-0.59, 0.7, 1.42]} size={[0.1, 0.35, 0.1]} color="#333d48" />
      <PixelPart position={[0.59, 0.7, 1.42]} size={[0.1, 0.35, 0.1]} color="#333d48" />
      {[-0.83, 0.83].flatMap((x) => [-0.96, 0.99].map((z) => (
        <group key={`${x},${z}`} position={[x, 0.22, z]}>
          <PixelPart position={[0, 0, 0]} size={[0.27, 0.49, 0.58]} color="#22272e" />
          <PixelPart position={[Math.sign(x) * 0.15, 0, 0]} size={[0.035, 0.25, 0.27]} color="#bdc8cb" />
        </group>
      )))}
      <PixelPart position={[-0.5, 0.42, -1.57]} size={[0.34, 0.16, 0.04]} color="#fff0b3" />
      <PixelPart position={[0.5, 0.42, -1.57]} size={[0.34, 0.16, 0.04]} color="#fff0b3" />
      <PixelPart position={[0, 0.62, 0.3]} size={[0.46, 0.15, 0.5]} color="#4c3b35" />
    </group>
  );
}

export function ItemModel({ kind, held = false }: ModelProps) {
  const meta = ITEM_META[kind];
  let model;
  if (meta.category === 'sword') model = <SwordModel color={meta.color} />;
  else if (meta.category === 'bow') model = <BowModel crossbow={kind === 'crossbow'} />;
  else if (meta.category === 'gun') model = <GunModel color={meta.color} bomb={kind === 'pistol_bomb'} />;
  else if (meta.category === 'food') model = <FoodModel kind={kind} />;
  else if (meta.category === 'armor') model = <ArmorModel color={meta.color} />;
  else if (meta.category === 'saddle') model = <SaddleModel />;
  else model = <CarModel color={meta.color} />;
  return <group scale={held ? 0.58 : 1}>{model}</group>;
}
