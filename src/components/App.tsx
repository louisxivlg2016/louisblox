import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { WorldProvider } from 'koota/react';
import { useGameStore } from '../game/store';
import { world } from '../game/world';
import { Game } from './Game';
import { Hud } from './Hud';
import { MultiplayerConnection } from './Multiplayer';
import { useMultiplayerStore, useRemotePlayerStore } from '../game/multiplayerStore';
import { isDown, isMouseDown } from '../game/input';
import { useBattleStore } from '../game/battle';
import { usePirateStore } from '../game/piratesClient';
import { useProtectionStore } from '../game/protection';
import { useCharacterStore } from '../game/characterStore';
import * as audio from '../game/audio';
import { biomeAt } from '../game/levels';
import { BlockKind, voxelKey } from '../game/voxel';
import { buildChunkGeometry } from '../game/chunkGeometry';
import { droppedItemSystem } from '../game/droppedItems';
import { useLanguageStore } from '../game/language';
import { updateProtection } from '../game/protection';
import { teleportToHome } from '../game/teleport';
import { useMazeStore } from '../game/mazeClient';
import { useFootballStore } from '../game/footballClient';
import { useMazeCourseStore } from '../game/mazeCourses';

function RendererRecovery() {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const contextLoss = gl.getContext().getExtension('WEBGL_lose_context');
    let timer: number | undefined;
    const restore = () => {
      if (!gl.getContext().isContextLost()) {
        timer = undefined;
        return;
      }
      contextLoss?.restoreContext();
      timer = window.setTimeout(restore, 1500);
    };
    const lost = (event: Event) => {
      event.preventDefault();
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(restore, 250);
    };
    const restored = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl]);
  return null;
}

export function App() {
  useLanguageStore((state) => state.language);
  const mode = useGameStore((state) => state.mode);
  const pirateWinner = usePirateStore((state) => state.winner);
  const mazeFinished = useMazeStore((state) => state.phase === 'finished');
  const footballWinner = useFootballStore((state) => state.winner);
  const mazeResultOpen = mazeFinished && mode !== 'play';
  const matchFinished = Boolean(pirateWinner || mazeResultOpen || footballWinner);
  return (
    <main className={`game-shell ${mode === 'play' && !matchFinished ? 'playing' : ''}`}>
      <WorldProvider world={world}>
        <MultiplayerConnection />
        <Canvas
          id="game-canvas"
          frameloop={mode === 'play' ? 'always' : 'demand'}
          dpr={1}
          camera={{ fov: 72, near: 0.05, far: 280, position: [0, 10, 0] }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          onCreated={(r3f) => {
            const { gl, camera } = r3f;
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') Object.assign(window, {
              louisbloxRenderer: gl,
              louisbloxDebug: async () => {
                const [traits, chunks, vehicles, ruins, collision, effects, football, vehicleTypes, vehicleWeapon, vehicleControls, animalSync, fish, animalMovement] = await Promise.all([import('../game/traits'), import('../game/chunks'), import('../game/vehicles'), import('../game/ruins'), import('../game/systems/collisionSystem'), import('../game/effects'), import('../game/footballClient'), import('../game/vehicleTypes'), import('../game/systems/vehicleWeaponSystem'), import('../game/vehicleControls'), import('../game/animalSync'), import('../game/fish'), import('../game/systems/animalSystem')]);
                const maze = await import('../game/mazeClient');
                const taming = await import('../game/taming');
                const combat = await import('../game/combat');
                const gallery = await import('../game/galleryActions');
                const projectiles = await import('../game/systems/projectileSystem');
                const water = await import('../game/systems/waterSystem');
                const persistence = await import('../game/save');
                const seasons = await import('../game/seasons');
                const environment = await import('../game/systems/environmentSystem');
                const blockControls = await import('../game/systems/blockSystem');
                const itemControls = await import('../game/systems/itemSystem');
                const textures = await import('../game/textures');
                const tribes = await import('../game/tribes');
                const animals = await import('../game/animals');
                const pirates = await import('../game/piratesClient');
                const targeting = await import('../game/interactionTargets');
                const Three = await import('three');
                const voxels = await import('../game/voxel');
                return { pirates: pirates.usePirateStore, tribe: tribes.useTribeStore, teleportToPendingTribeHome: tribes.teleportToPendingTribeHome, spawnAnimal: animals.spawnAnimal, choosePirateKit: pirates.choosePirateKit, maze: maze.useMazeStore, mazeCourse: useMazeCourseStore, audio, biomeAt, BlockKind, voxelKey, world, gl, camera, r3f, Three, character: useCharacterStore, store: useGameStore, multiplayer: useMultiplayerStore, remote: useRemotePlayerStore, battle: useBattleStore, protection: useProtectionStore, updateProtection, football: football.useFootballStore, effects: effects.useEffectStore, effectSystem: effects.effectSystem, hasActiveEffects: effects.hasActiveEffects, sirens: vehicleControls.useVehicleControls, isDown, mining: () => isMouseDown(0), ...animalSync, ...fish, ...animalMovement, ...taming, ...combat, ...gallery, ...projectiles, ...water, ...persistence, ...seasons, environmentSystem: environment.environmentSystem, blockSystem: blockControls.blockSystem, itemSystem: itemControls.itemSystem, blockMaterials: textures.blockMaterials, ...traits, ...chunks, ...vehicles, ...ruins, ...collision, ...vehicleTypes, ...vehicleWeapon, ...targeting, HOTBAR_BLOCKS: voxels.HOTBAR_BLOCKS, raycastVoxel: voxels.raycastVoxel, buildChunkGeometry, droppedItemSystem, teleportToHome };
              },
            });
          }}
        >
          <RendererRecovery />
          <Game />
        </Canvas>
        <Hud />
      </WorldProvider>
    </main>
  );
}
