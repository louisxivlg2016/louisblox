import { animalMaterial } from '../game/animalTextures';
import { getItemMeta } from '../game/items';
import { isGalleryItem } from '../game/galleryCatalog';
import type { GalleryItemId, ItemKind } from '../game/items';

type ModelProps = { kind: ItemKind | GalleryItemId; held?: boolean };
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

export function ToolModel({ kind }: { kind: ItemKind | GalleryItemId }) {
  const color = getItemMeta(kind).color;
  if (kind.startsWith('pickaxe_') || getItemMeta(kind).shape === 'pickaxe') return (
    <group rotation={[0, 0, -0.35]}>
      <PixelPart position={[0, -0.18, 0]} size={[0.12, 0.9, 0.12]} color="#765034" />
      <PixelPart position={[0, 0.33, 0]} size={[0.7, 0.14, 0.17]} color={color} />
      <PixelPart position={[-0.36, 0.22, 0]} size={[0.13, 0.25, 0.16]} color={color} />
      <PixelPart position={[0.36, 0.22, 0]} size={[0.13, 0.25, 0.16]} color={color} />
      <PixelPart position={[-0.41, 0.1, 0]} size={[0.1, 0.13, 0.13]} color={color} />
      <PixelPart position={[0.41, 0.1, 0]} size={[0.1, 0.13, 0.13]} color={color} />
      <PixelPart position={[0, 0.23, 0]} size={[0.18, 0.2, 0.18]} color={color} />
    </group>
  );
  return (
    <group rotation={[0, 0, -0.25]}>
      <PixelPart position={[0, -0.16, 0]} size={[0.11, 0.86, 0.11]} color="#765034" />
      <PixelPart position={[0, -0.64, 0]} size={[0.25, 0.13, 0.15]} color="#604029" />
      <PixelPart position={[0, 0.38, 0]} size={[0.3, 0.34, 0.14]} color={color} />
      <PixelPart position={[0, 0.55, 0]} size={[0.35, 0.1, 0.15]} color={color} />
      <PixelPart position={[0, 0.16, 0]} size={[0.18, 0.15, 0.12]} color={color} />
      <PixelPart position={[0, 0.07, 0]} size={[0.09, 0.08, 0.1]} color={color} />
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

export function FoodModel({ kind }: { kind: ItemKind | GalleryItemId }) {
  const color = getItemMeta(kind).color;
  if (getItemMeta(kind).shape === 'fish') return <GalleryFishModel color={color} />;
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
  if (kind === 'corn') return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.25, 0.68, 0.25]} color="#e7c546" />
      <PixelPart position={[-0.17, -0.1, 0]} size={[0.1, 0.5, 0.16]} color="#4f893e" />
      <PixelPart position={[0.17, -0.1, 0]} size={[0.1, 0.5, 0.16]} color="#659d47" />
      <PixelPart position={[0, 0.4, 0]} size={[0.07, 0.18, 0.07]} color="#b49748" />
    </group>
  );
  if (kind === 'wheat') return (
    <group>{[-0.2, 0, 0.2].map((x) => <group key={x}><PixelPart position={[x, -0.1, 0]} size={[0.045, 0.7, 0.045]} color="#8c9b4a" /><PixelPart position={[x, 0.28, 0]} size={[0.14, 0.3, 0.14]} color={color} /></group>)}</group>
  );
  if (kind === 'carrot') return (
    <group>
      <PixelPart position={[0, 0.05, 0]} size={[0.27, 0.42, 0.27]} color={color} />
      <PixelPart position={[0, -0.25, 0]} size={[0.15, 0.2, 0.15]} color={color} />
      <PixelPart position={[-0.1, 0.39, 0]} size={[0.09, 0.35, 0.1]} color="#4e8a3f" />
      <PixelPart position={[0.1, 0.42, 0]} size={[0.09, 0.4, 0.1]} color="#66a54a" />
    </group>
  );
  if (kind === 'watermelon') return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.62, 0.48, 0.58]} color={color} />
      <PixelPart position={[-0.18, 0, -0.3]} size={[0.07, 0.48, 0.035]} color="#2f683a" />
      <PixelPart position={[0.18, 0, -0.3]} size={[0.07, 0.48, 0.035]} color="#2f683a" />
      <PixelPart position={[0, 0.31, 0]} size={[0.08, 0.16, 0.08]} color="#755335" />
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

export function SteeringWheel({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return (
    <group position={position} rotation={[-0.3, 0, 0]}>
      {[[0, 0.18], [0.13, 0.13], [0.18, 0], [0.13, -0.13], [0, -0.18], [-0.13, -0.13], [-0.18, 0], [-0.13, 0.13]].map(([x, y]) => (
        <PixelPart key={`${x},${y}`} position={[x, y, 0]} size={[0.075, 0.075, 0.06]} color="#252c32" />
      ))}
      <PixelPart position={[0, 0, 0]} size={[0.13, 0.055, 0.06]} color="#65747c" />
      <PixelPart position={[0, -0.13, 0.12]} size={[0.065, 0.3, 0.065]} color="#46545d" rotation={[0.65, 0, 0]} />
    </group>
  );
}

export function CarModel({ color = '#d63935' }: { color?: string }) {
  const blue = color.toLowerCase() === '#347cd0';
  return (
    <group>
      <PixelPart position={[0, 0.38, 0]} size={[1.65, 0.38, 3.1]} color={color} />
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
      <SteeringWheel position={[-0.35, 0.8, -0.48]} />
      {blue && (
        <>
          <PixelPart position={[0, 1.25, 0.12]} size={[1.36, 0.12, 1.4]} color={color} />
          <mesh position={[0, 0.96, -0.59]}><boxGeometry args={[1.17, 0.47, 0.035]} /><meshLambertMaterial color="#a7d8e8" transparent opacity={0.36} depthWrite={false} /></mesh>
          {[-0.66, 0.66].map((x) => <mesh key={x} position={[x, 0.96, 0.08]}><boxGeometry args={[0.025, 0.44, 1.05]} /><meshLambertMaterial color="#a7d8e8" transparent opacity={0.3} depthWrite={false} /></mesh>)}
        </>
      )}
    </group>
  );
}

function GalleryFishModel({ color }: { color: string }) {
  return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.52, 0.27, 0.24]} color={color} />
      <PixelPart position={[-0.32, 0, 0]} size={[0.2, 0.22, 0.22]} color={color} />
      <PixelPart position={[0.37, 0, 0]} size={[0.18, 0.32, 0.1]} color={color} />
      <PixelPart position={[0, 0.18, 0]} size={[0.17, 0.08, 0.23]} color={color} />
      <PixelPart position={[-0.38, 0.06, -0.12]} size={[0.045, 0.045, 0.025]} color="#eef5ed" />
    </group>
  );
}

function TransportItemModel({ kind, color }: { kind: 'plane' | 'train'; color: string }) {
  if (kind === 'plane') return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.4, 0.35, 1.7]} color={color} />
      <PixelPart position={[0, 0, 0.1]} size={[1.65, 0.1, 0.42]} color={color} />
      <PixelPart position={[0, 0.24, -0.42]} size={[0.32, 0.18, 0.45]} color="#80bdd7" />
      <PixelPart position={[0, 0.32, 0.67]} size={[0.12, 0.48, 0.32]} color={color} />
      <PixelPart position={[0, 0.18, 0.65]} size={[0.78, 0.08, 0.28]} color={color} />
    </group>
  );
  return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.7, 0.65, 1.8]} color={color} />
      <PixelPart position={[0, 0.44, -0.5]} size={[0.62, 0.38, 0.65]} color={color} />
      <PixelPart position={[0, 0.46, -0.84]} size={[0.45, 0.2, 0.035]} color="#9acddd" />
      {[-0.27, 0.27].flatMap((x) => [-0.58, 0.58].map((z) => <PixelPart key={`${x},${z}`} position={[x, -0.4, z]} size={[0.16, 0.25, 0.36]} color="#252b31" />))}
      <PixelPart position={[0, -0.05, 0.25]} size={[0.72, 0.22, 0.035]} color="#9acddd" />
    </group>
  );
}

function GalleryBoatModel({ color, hovercraft }: { color: string; hovercraft: boolean }) {
  return (
    <group>
      <PixelPart position={[0, 0.18, 0]} size={[1.3, 0.22, 2.4]} color={color} />
      <PixelPart position={[-0.6, 0.38, 0]} size={[0.13, 0.32, 2.1]} color={color} />
      <PixelPart position={[0.6, 0.38, 0]} size={[0.13, 0.32, 2.1]} color={color} />
      <PixelPart position={[0, 0.33, -1.1]} size={[1.05, 0.28, 0.42]} color={color} />
      <PixelPart position={[0, 0.36, 0.15]} size={[0.7, 0.14, 0.55]} color="#6a4932" />
      {hovercraft && <PixelPart position={[-0.63, 0.1, 0.55]} size={[0.28, 0.16, 0.5]} color="#39434d" />}
      {hovercraft && <PixelPart position={[0.63, 0.1, 0.55]} size={[0.28, 0.16, 0.5]} color="#39434d" />}
    </group>
  );
}

function GalleryGenericModel({ shape, color }: { shape: string; color: string }) {
  const wood = '#755035';
  if (shape === 'axe' || shape === 'hoe') return (
    <group rotation={[0, 0, -0.3]}>
      <PixelPart position={[0, -0.15, 0]} size={[0.11, 0.85, 0.11]} color={wood} />
      <PixelPart position={[0.18, 0.3, 0]} size={[0.36, 0.3, 0.14]} color={color} />
      <PixelPart position={[0.36, 0.18, 0]} size={[0.13, 0.18, 0.13]} color={color} />
    </group>
  );
  if (shape === 'spear') return (
    <group rotation={[0, 0, -0.25]}>
      <PixelPart position={[0, -0.08, 0]} size={[0.065, 1.05, 0.065]} color={wood} />
      <PixelPart position={[0, 0.55, 0]} size={[0.16, 0.28, 0.11]} color={color} />
      <PixelPart position={[0, 0.73, 0]} size={[0.08, 0.12, 0.08]} color={color} />
    </group>
  );
  if (shape === 'dagger') return <group scale={0.7}><SwordModel color={color} /></group>;
  if (shape === 'club' || shape === 'mace') return (
    <group rotation={[0, 0, -0.3]}>
      <PixelPart position={[0, -0.25, 0]} size={[0.15, 0.58, 0.15]} color={wood} />
      <PixelPart position={[0, 0.23, 0]} size={[0.34, 0.36, 0.32]} color={color} />
      {shape === 'mace' && <PixelPart position={[0.24, 0.23, 0]} size={[0.14, 0.12, 0.12]} color={color} />}
      {shape === 'mace' && <PixelPart position={[-0.24, 0.23, 0]} size={[0.14, 0.12, 0.12]} color={color} />}
    </group>
  );
  if (shape === 'whip') return (
    <group>
      <PixelPart position={[0, -0.38, 0]} size={[0.14, 0.3, 0.14]} color={wood} />
      <PixelPart position={[0.05, 0.03, 0]} size={[0.055, 0.6, 0.055]} color={color} />
      <PixelPart position={[0.14, 0.36, 0]} size={[0.055, 0.22, 0.055]} color={color} />
      <PixelPart position={[0.22, 0.49, 0]} size={[0.055, 0.12, 0.055]} color={color} />
    </group>
  );
  if (shape === 'boomerang') return (
    <group>
      <PixelPart position={[-0.2, 0.15, 0]} size={[0.14, 0.6, 0.12]} color={color} rotation={[0, 0, -0.55]} />
      <PixelPart position={[0.2, 0.15, 0]} size={[0.14, 0.6, 0.12]} color={color} rotation={[0, 0, 0.55]} />
      <PixelPart position={[0, -0.06, 0]} size={[0.42, 0.14, 0.12]} color={color} />
    </group>
  );
  if (shape === 'hang_glider') return (
    <group>
      <PixelPart position={[0, 0.3, 0]} size={[1.05, 0.12, 0.46]} color={color} />
      <PixelPart position={[0, 0.04, 0]} size={[0.06, 0.5, 0.06]} color={wood} />
      <PixelPart position={[0, -0.22, 0]} size={[0.35, 0.06, 0.06]} color={wood} />
    </group>
  );
  if (shape === 'fishing_rod') return (
    <group rotation={[0, 0, -0.3]}>
      <PixelPart position={[0, 0, 0]} size={[0.065, 1.1, 0.065]} color={wood} />
      <PixelPart position={[0.2, -0.15, 0]} size={[0.025, 0.72, 0.025]} color="#d5d6c7" />
      <PixelPart position={[0.2, -0.54, 0]} size={[0.09, 0.1, 0.035]} color={color} />
    </group>
  );
  if (shape === 'shears') return (
    <group>
      <PixelPart position={[-0.1, 0, 0]} size={[0.06, 0.7, 0.06]} color={color} rotation={[0, 0, 0.5]} />
      <PixelPart position={[0.1, 0, 0]} size={[0.06, 0.7, 0.06]} color={color} rotation={[0, 0, -0.5]} />
      <PixelPart position={[0, -0.3, 0]} size={[0.16, 0.12, 0.09]} color={wood} />
    </group>
  );
  if (shape === 'compass' || shape === 'clock') return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.52, 0.48, 0.14]} color={color} />
      <PixelPart position={[0, 0, -0.09]} size={[0.38, 0.34, 0.04]} color="#e5e5d8" />
      <PixelPart position={[0, 0.06, -0.12]} size={[0.05, 0.22, 0.025]} color={shape === 'compass' ? '#c64038' : '#38434b'} />
      <PixelPart position={[0.08, -0.04, -0.12]} size={[0.18, 0.05, 0.025]} color={shape === 'compass' ? '#476a9c' : '#38434b'} />
    </group>
  );
  if (shape === 'map') return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.64, 0.48, 0.05]} color="#ded2a4" />
      <PixelPart position={[-0.15, 0, -0.035]} size={[0.06, 0.37, 0.025]} color="#699354" />
      <PixelPart position={[0.1, 0.08, -0.035]} size={[0.35, 0.06, 0.025]} color="#6d9fb4" />
    </group>
  );
  if (shape === 'book') return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.5, 0.62, 0.16]} color={color} />
      <PixelPart position={[0.04, 0, -0.1]} size={[0.39, 0.5, 0.05]} color="#e6dfc7" />
      <PixelPart position={[-0.24, 0, 0]} size={[0.06, 0.62, 0.17]} color={wood} />
    </group>
  );
  if (shape === 'bone_meal' || shape === 'updraft' || shape === 'snowdash') return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.13, 0.64, 0.12]} color={shape === 'bone_meal' ? '#e6e5d7' : color} />
      <PixelPart position={[0, 0, 0]} size={[0.52, 0.12, 0.12]} color={shape === 'bone_meal' ? '#e6e5d7' : color} />
      <PixelPart position={[0, 0, 0]} size={[0.12, 0.12, 0.52]} color={shape === 'bone_meal' ? '#e6e5d7' : color} />
    </group>
  );
  if (shape === 'plant' || shape === 'flower') return (
    <group>
      <PixelPart position={[0, -0.15, 0]} size={[0.08, 0.65, 0.08]} color="#4f863f" />
      <PixelPart position={[-0.14, -0.22, 0]} size={[0.3, 0.08, 0.15]} color="#649c48" />
      {shape === 'flower' && <PixelPart position={[0, 0.26, 0]} size={[0.42, 0.16, 0.4]} color={color} />}
      {shape === 'flower' && <PixelPart position={[0, 0.35, 0]} size={[0.15, 0.1, 0.15]} color="#d9b74a" />}
    </group>
  );
  if (shape === 'mushroom') return (
    <group>
      <PixelPart position={[0, -0.17, 0]} size={[0.16, 0.48, 0.16]} color="#e0d5b7" />
      <PixelPart position={[0, 0.17, 0]} size={[0.52, 0.22, 0.48]} color={color} />
      <PixelPart position={[-0.13, 0.19, -0.25]} size={[0.09, 0.08, 0.03]} color="#eee5d5" />
    </group>
  );
  if (shape === 'seed') return <PixelPart position={[0, -0.15, 0]} size={[0.22, 0.18, 0.22]} color={color} />;
  if (shape === 'bar' || shape === 'fragment' || shape === 'gem') return <PixelPart position={[0, 0, 0]} size={shape === 'bar' ? [0.58, 0.22, 0.3] : shape === 'fragment' ? [0.2, 0.18, 0.2] : [0.36, 0.36, 0.36]} color={color} />;
  if (shape === 'potion' || shape === 'splash_potion' || shape === 'arrow_potion') return (
    <group>
      <PixelPart position={[0, -0.08, 0]} size={[0.32, 0.45, 0.26]} color={color} />
      <PixelPart position={[0, 0.22, 0]} size={[0.16, 0.15, 0.16]} color="#d6d2b9" />
      <PixelPart position={[0, 0.33, 0]} size={[0.2, 0.08, 0.2]} color="#5f4b3d" />
      {shape === 'arrow_potion' && <PixelPart position={[0.35, 0, 0]} size={[0.55, 0.06, 0.06]} color="#d4d5c7" />}
    </group>
  );
  if (shape === 'firecracker' || shape === 'pebble') return (
    <group>
      <PixelPart position={[0, -0.1, 0]} size={[0.28, 0.58, 0.28]} color={color} />
      <PixelPart position={[0, 0.24, 0]} size={[0.1, 0.13, 0.1]} color="#b89854" />
      <PixelPart position={[0, 0.34, 0]} size={[0.06, 0.1, 0.06]} color="#f4c852" />
    </group>
  );
  if (shape === 'bed') return (
    <group>
      <PixelPart position={[0, 0.14, 0]} size={[0.9, 0.2, 1.5]} color={wood} />
      <PixelPart position={[0, 0.32, 0]} size={[0.85, 0.2, 1.42]} color="#e5e2d2" />
      <PixelPart position={[0, 0.46, -0.2]} size={[0.86, 0.1, 0.86]} color={color} />
      <PixelPart position={[0, 0.47, 0.48]} size={[0.66, 0.12, 0.35]} color="#f4f0df" />
    </group>
  );
  if (shape === 'pod') return <PixelPart position={[0, 0.1, 0]} size={[0.9, 0.18, 1.2]} color={color} />;
  if (shape === 'banner') return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.07, 1.1, 0.07]} color={wood} />
      <PixelPart position={[0.3, 0.22, 0]} size={[0.55, 0.65, 0.07]} color={color} />
    </group>
  );
  if (shape === 'arrow_sign' || shape === 'arrow') return (
    <group>
      <PixelPart position={[0, -0.1, 0]} size={[0.07, 0.75, 0.07]} color={color} />
      <PixelPart position={[0, 0.34, 0]} size={[0.3, 0.16, 0.14]} color={color} />
      <PixelPart position={[0, 0.47, 0]} size={[0.15, 0.13, 0.14]} color={color} />
    </group>
  );
  if (shape === 'spawn_orb' || shape === 'spawner' || shape === 'catcher') return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.48, 0.48, 0.48]} color={color} />
      <PixelPart position={[0, 0.31, 0]} size={[0.3, 0.14, 0.3]} color={color} />
      <PixelPart position={[0, -0.31, 0]} size={[0.3, 0.14, 0.3]} color={color} />
      {shape !== 'spawn_orb' && <PixelPart position={[0, 0, -0.33]} size={[0.64, 0.64, 0.06]} color="#4b555d" />}
    </group>
  );
  if (shape === 'ammo') return <PixelPart position={[0, 0, 0]} size={[0.15, 0.45, 0.15]} color={color} />;
  if (shape === 'ball') return <PixelPart position={[0, 0, 0]} size={[0.34, 0.34, 0.34]} color={color} />;
  if (shape === 'bomb') return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.48, 0.48, 0.48]} color="#303943" />
      <PixelPart position={[0, 0.32, 0]} size={[0.1, 0.18, 0.1]} color="#a27a45" />
      <PixelPart position={[0, 0.45, 0]} size={[0.09, 0.09, 0.09]} color={color} />
    </group>
  );
  if (shape === 'tower') return (
    <group>
      <PixelPart position={[0, 0.1, 0]} size={[0.75, 0.2, 0.75]} color={color} />
      <PixelPart position={[0, 0.32, 0]} size={[0.58, 0.22, 0.58]} color={color} />
      <PixelPart position={[0, 0.54, 0]} size={[0.4, 0.2, 0.4]} color={color} />
    </group>
  );
  if (shape === 'balloon') return (
    <group>
      <PixelPart position={[0, 0.25, 0]} size={[0.5, 0.55, 0.45]} color={color} />
      <PixelPart position={[0, -0.18, 0]} size={[0.025, 0.5, 0.025]} color="#c8c5b0" />
    </group>
  );
  if (shape === 'ice_bridge') return <PixelPart position={[0, 0, 0]} size={[0.95, 0.14, 0.65]} color={color} />;
  if (shape === 'stick') return <PixelPart position={[0, 0, 0]} size={[0.1, 0.8, 0.1]} color={color} />;
  return (
    <group>
      <PixelPart position={[0, 0, 0]} size={[0.45, 0.45, 0.45]} color={color} />
      <PixelPart position={[0, 0.15, -0.24]} size={[0.32, 0.06, 0.035]} color="#e1e6d9" />
    </group>
  );
}

function GalleryModel({ kind }: { kind: GalleryItemId }) {
  const meta = getItemMeta(kind);
  const shape = meta.shape ?? 'resource';
  if (shape === 'pickaxe' || shape === 'spade') return <ToolModel kind={kind} />;
  if (shape === 'sword') return <SwordModel color={meta.color} />;
  if (shape === 'bow' || shape === 'crossbow') return <BowModel crossbow={shape === 'crossbow'} />;
  if (shape === 'gun' || shape === 'rpg') return <GunModel color={meta.color} bomb={shape === 'rpg'} />;
  if (shape === 'armor') return <ArmorModel color={meta.color} />;
  if (shape === 'fish') return <GalleryFishModel color={meta.color} />;
  if (shape === 'food' || shape === 'bowl' || shape === 'meat' || shape === 'milk' || shape === 'cheese') return <FoodModel kind={kind} />;
  if (shape === 'car') return <CarModel color={meta.color} />;
  if (shape === 'boat' || shape === 'hovercraft') return <GalleryBoatModel color={meta.color} hovercraft={shape === 'hovercraft'} />;
  return <GalleryGenericModel shape={shape} color={meta.color} />;
}

export function ItemModel({ kind, held = false }: ModelProps) {
  const meta = getItemMeta(kind);
  let model;
  if (isGalleryItem(kind)) model = <GalleryModel kind={kind} />;
  else if (meta.category === 'sword') model = <SwordModel color={meta.color} />;
  else if (meta.category === 'bow') model = <BowModel crossbow={kind === 'crossbow'} />;
  else if (meta.category === 'gun') model = <GunModel color={meta.color} bomb={kind === 'pistol_bomb'} />;
  else if (meta.category === 'pickaxe' || meta.category === 'shovel') model = <ToolModel kind={kind} />;
  else if (meta.category === 'food') model = <FoodModel kind={kind} />;
  else if (meta.category === 'armor') model = <ArmorModel color={meta.color} />;
  else if (meta.category === 'saddle') model = <SaddleModel />;
  else if (kind === 'plane' || kind === 'train') model = <TransportItemModel kind={kind} color={meta.color} />;
  else model = <CarModel color={meta.color} />;
  return <group scale={held ? 0.58 : 1}>{model}</group>;
}
