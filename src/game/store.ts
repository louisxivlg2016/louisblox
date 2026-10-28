import { create } from 'zustand';
import type { AnimalKind } from './animals';
import type { Biome } from './levels';
import { createMeatInventory } from './meats';
import { BlockKind } from './voxel';

export type GameMode = 'menu' | 'play' | 'pause';
export type WeatherKind = 'clear' | 'rain' | 'snow';

type Coordinates = { x: number; y: number; z: number };
type EnvironmentSnapshot = { dayProgress: number; biome: Biome; weather: WeatherKind };

type GameStore = {
  mode: GameMode;
  selected: BlockKind;
  generation: number;
  blockCount: number;
  apples: number;
  meat: Record<AnimalKind, number>;
  miningProgress: number;
  flying: boolean;
  coordinates: Coordinates;
  environment: EnvironmentSnapshot;
  setMode: (mode: GameMode) => void;
  selectBlock: (kind: BlockKind) => void;
  setBlockCount: (count: number) => void;
  setCoordinates: (coordinates: Coordinates) => void;
  setEnvironment: (environment: EnvironmentSnapshot) => void;
  setMiningProgress: (progress: number) => void;
  setFlying: (flying: boolean) => void;
  collectApple: () => void;
  collectMeat: (kind: AnimalKind) => void;
  regenerate: () => void;
};

export const useGameStore = create<GameStore>((set) => ({
  mode: 'menu',
  selected: BlockKind.Grass,
  generation: 0,
  blockCount: 0,
  apples: 0,
  meat: createMeatInventory(),
  miningProgress: 0,
  flying: false,
  coordinates: { x: 0, y: 8, z: 0 },
  environment: { dayProgress: 0.38, biome: 'prairie', weather: 'clear' },
  setMode: (mode) => set({ mode }),
  selectBlock: (selected) => set({ selected }),
  setBlockCount: (blockCount) => set({ blockCount }),
  setCoordinates: (coordinates) => set({ coordinates }),
  setEnvironment: (environment) => set({ environment }),
  setMiningProgress: (miningProgress) => set({ miningProgress }),
  setFlying: (flying) => set({ flying }),
  collectApple: () => set((state) => ({ apples: state.apples + 1 })),
  collectMeat: (kind) => set((state) => ({ meat: { ...state.meat, [kind]: state.meat[kind] + 1 } })),
  regenerate: () => set((state) => ({ generation: state.generation + 1, apples: 0, meat: createMeatInventory(), miningProgress: 0, flying: false, mode: 'menu' })),
}));
