import { create } from 'zustand';
import type { AnimalKind } from './animals';
import type { ArmorKind, ItemKind, SelectedKind } from './items';
import { DEFAULT_ITEM_COUNTS } from './items';
import type { Biome } from './levels';
import { createMeatInventory } from './meats';
import { BlockKind, HOTBAR_BLOCKS } from './voxel';

export type GameMode = 'menu' | 'play' | 'pause';
export type WeatherKind = 'clear' | 'rain' | 'snow';
type Coordinates = { x: number; y: number; z: number };
type EnvironmentSnapshot = { dayProgress: number; biome: Biome; weather: WeatherKind };

type GameStore = {
  mode: GameMode;
  selected: SelectedKind;
  hotbarSlots: SelectedKind[];
  backpackItem: SelectedKind | null;
  itemCounts: Record<ItemKind, number>;
  equippedArmor: ArmorKind | null;
  riding: 'car' | 'horse' | null;
  notice: string;
  teleportOpen: boolean;
  container: { type: 'chest' | 'furnace'; x: number; y: number; z: number } | null;
  chestItems: SelectedKind[];
  openContainer: (type: 'chest' | 'furnace', position: { x: number; y: number; z: number }, items?: SelectedKind[]) => void;
  closeContainer: () => void;
  generation: number;
  blockCount: number;
  apples: number;
  meat: Record<AnimalKind, number>;
  miningProgress: number;
  flying: boolean;
  lives: number;
  cameraMode: 'first' | 'third';
  backpackOpen: boolean;
  coordinates: Coordinates;
  environment: EnvironmentSnapshot;
  setMode: (mode: GameMode) => void;
  selectBlock: (kind: SelectedKind) => void;
  setHotbarSlot: (index: number, kind: SelectedKind) => void;
  setBackpackItem: (kind: SelectedKind | null) => void;
  setItemCount: (kind: ItemKind, count: number) => void;
  equipArmor: (kind: ArmorKind | null) => void;
  setRiding: (riding: 'car' | 'horse' | null) => void;
  setNotice: (notice: string) => void;
  setTeleportOpen: (open: boolean) => void;
  setBlockCount: (count: number) => void;
  setCoordinates: (coordinates: Coordinates) => void;
  setEnvironment: (environment: EnvironmentSnapshot) => void;
  setMiningProgress: (progress: number) => void;
  setFlying: (flying: boolean) => void;
  setLives: (lives: number) => void;
  toggleCamera: () => void;
  setBackpack: (open: boolean) => void;
  collectApple: () => void;
  collectMeat: (kind: AnimalKind) => void;
  discardApple: () => void;
  discardMeat: (kind: AnimalKind) => void;
  regenerate: () => void;
};

export const useGameStore = create<GameStore>((set) => ({
  mode: 'menu',
  selected: BlockKind.Grass,
  hotbarSlots: [...HOTBAR_BLOCKS.slice(0, 10)],
  backpackItem: null,
  itemCounts: { ...DEFAULT_ITEM_COUNTS },
  equippedArmor: null,
  riding: null,
  notice: '',
  teleportOpen: false,
  container: null,
  chestItems: [],
  generation: 0,
  blockCount: 0,
  apples: 0,
  meat: createMeatInventory(),
  miningProgress: 0,
  flying: false,
  lives: 10,
  cameraMode: 'first',
  backpackOpen: false,
  coordinates: { x: 0, y: 8, z: 0 },
  environment: { dayProgress: 0.38, biome: 'prairie', weather: 'clear' },
  setMode: (mode) => set({ mode }),
  selectBlock: (selected) => set({ selected }),
  setHotbarSlot: (index, kind) => set((state) => {
    const hotbarSlots = [...state.hotbarSlots];
    hotbarSlots[index] = kind;
    return { hotbarSlots, selected: kind, backpackItem: null };
  }),
  setBackpackItem: (backpackItem) => set({ backpackItem }),
  setItemCount: (kind, count) => set((state) => ({ itemCounts: { ...state.itemCounts, [kind]: Math.max(0, count) } })),
  equipArmor: (equippedArmor) => set({ equippedArmor }),
  setRiding: (riding) => set({ riding }),
  setNotice: (notice) => set({ notice }),
  setTeleportOpen: (teleportOpen) => set({ teleportOpen }),
  openContainer: (type, position, items = []) => set({ container: { type, ...position }, chestItems: items, mode: 'pause', backpackOpen: false, teleportOpen: false, backpackItem: null }),
  closeContainer: () => set({ container: null, chestItems: [] }),
  setBlockCount: (blockCount) => set({ blockCount }),
  setCoordinates: (coordinates) => set({ coordinates }),
  setEnvironment: (environment) => set({ environment }),
  setMiningProgress: (miningProgress) => set({ miningProgress }),
  setFlying: (flying) => set({ flying }),
  setLives: (lives) => set({ lives }),
  toggleCamera: () => set((state) => ({ cameraMode: state.cameraMode === 'first' ? 'third' : 'first' })),
  setBackpack: (backpackOpen) => set({ backpackOpen, backpackItem: null }),
  collectApple: () => set((state) => ({ apples: state.apples + 1 })),
  collectMeat: (kind) => set((state) => ({ meat: { ...state.meat, [kind]: state.meat[kind] + 1 } })),
  discardApple: () => set((state) => ({ apples: Math.max(0, state.apples - 1) })),
  discardMeat: (kind) => set((state) => ({ meat: { ...state.meat, [kind]: Math.max(0, state.meat[kind] - 1) } })),
  regenerate: () => set((state) => ({
    generation: state.generation + 1,
    selected: BlockKind.Grass,
    hotbarSlots: [...HOTBAR_BLOCKS.slice(0, 10)],
    backpackItem: null,
    itemCounts: { ...DEFAULT_ITEM_COUNTS },
    equippedArmor: null,
    riding: null,
    teleportOpen: false,
    container: null,
    chestItems: [],
    apples: 0,
    meat: createMeatInventory(),
    miningProgress: 0,
    flying: false,
    lives: 10,
    backpackOpen: false,
    mode: 'menu',
  })),
}));
