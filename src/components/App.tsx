import { Canvas } from '@react-three/fiber';
import { WorldProvider } from 'koota/react';
import { world } from '../game/world';
import { Game } from './Game';
import { Hud } from './Hud';

export function App() {
  return (
    <main className="game-shell">
      <Canvas
        id="game-canvas"
        dpr={[1, 1.5]}
        camera={{ fov: 72, near: 0.05, far: 180, position: [0, 10, 0] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <WorldProvider world={world}>
          <Game />
        </WorldProvider>
      </Canvas>
      <Hud />
    </main>
  );
}
