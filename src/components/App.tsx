import { Canvas } from '@react-three/fiber';
import { WorldProvider } from 'koota/react';
import { useGameStore } from '../game/store';
import { world } from '../game/world';
import { Game } from './Game';
import { Hud } from './Hud';

export function App() {
  const mode = useGameStore((state) => state.mode);
  return (
    <main className={`game-shell ${mode === 'play' ? 'playing' : ''}`}>
      <Canvas
        id="game-canvas"
        dpr={1}
        camera={{ fov: 72, near: 0.05, far: 130, position: [0, 10, 0] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        onCreated={({ gl, camera }) => {
          if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') Object.assign(window, {
            louisbloxRenderer: gl,
            louisbloxDebug: async () => {
              const [traits, chunks] = await Promise.all([import('../game/traits'), import('../game/chunks')]);
              return { world, gl, camera, store: useGameStore, ...traits, ...chunks };
            },
          });
        }}
      >
        <WorldProvider world={world}>
          <Game />
        </WorldProvider>
      </Canvas>
      <Hud />
    </main>
  );
}
