import { Canvas } from '@react-three/fiber';
import { WorldProvider } from 'koota/react';
import { useGameStore } from '../game/store';
import { world } from '../game/world';
import { Game } from './Game';
import { Hud } from './Hud';
import { MultiplayerConnection } from './Multiplayer';
import { useRemotePlayerStore } from '../game/multiplayerStore';
import { isDown, isMouseDown } from '../game/input';
import { useBattleStore } from '../game/battle';
import { useProtectionStore } from '../game/protection';

export function App() {
  const mode = useGameStore((state) => state.mode);
  return (
    <main className={`game-shell ${mode === 'play' ? 'playing' : ''}`}>
      <WorldProvider world={world}>
        <MultiplayerConnection />
        <Canvas
          id="game-canvas"
          frameloop="demand"
          dpr={1}
          camera={{ fov: 72, near: 0.05, far: 130, position: [0, 10, 0] }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          onCreated={({ gl, camera }) => {
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') Object.assign(window, {
              louisbloxRenderer: gl,
              louisbloxDebug: async () => {
                const [traits, chunks, vehicles, ruins, collision, effects, football] = await Promise.all([import('../game/traits'), import('../game/chunks'), import('../game/vehicles'), import('../game/ruins'), import('../game/systems/collisionSystem'), import('../game/effects'), import('../game/footballClient')]);
                return { world, gl, camera, store: useGameStore, remote: useRemotePlayerStore, battle: useBattleStore, protection: useProtectionStore, football: football.useFootballStore, effects: effects.useEffectStore, effectSystem: effects.effectSystem, hasActiveEffects: effects.hasActiveEffects, isDown, mining: () => isMouseDown(0), ...traits, ...chunks, ...vehicles, ...ruins, ...collision };
              },
            });
          }}
        >
          <Game />
        </Canvas>
        <Hud />
      </WorldProvider>
    </main>
  );
}
