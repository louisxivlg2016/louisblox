import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { world } from '../game/world';
import { Player } from '../game/traits';
import { PlayerAvatar } from './PlayerAvatar';

export function BoutiqueAvatarPreview() {
  const player = world.queryFirst(Player);
  if (!player) return null;
  return (
    <div className="boutique-avatar-3d" aria-label="Aperçu 3D du costume. Fais glisser pour le tourner.">
      <Canvas dpr={1} camera={{ position: [0, 1.1, -4.2], fov: 34 }} gl={{ antialias: false }}>
        <ambientLight intensity={1.3} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} />
        <directionalLight position={[-3, 2, -2]} intensity={0.7} />
        <Suspense fallback={null}>
          <PlayerAvatar entity={player} preview />
        </Suspense>
        <OrbitControls target={[0, 1.05, 0]} enablePan={false} minDistance={2.4} maxDistance={6} minPolarAngle={Math.PI / 5} maxPolarAngle={Math.PI * 0.75} />
      </Canvas>
      <span className="boutique-preview-hint">Glisse pour tourner</span>
    </div>
  );
}
