import { create } from 'zustand';
import type { AnimalKind } from './animals';
import type { ArmorKind, ItemKind, SelectedKind } from './items';
import type { GalleryItemId } from './galleryCatalog';
import { DEFAULT_ITEM_COUNTS } from './items';
import type { Biome } from './levels';
import { createMeatInventory } from './meats';
import { BlockKind, HOTBAR_BLOCKS } from './voxel';
import type { GameplayMode } from './worldMode';

export type GameMode = 'menu' | 'play' | 'pause';
export type WeatherKind = 'clear' | 'rain' | 'snow';
type Coordinates = { x: number; y: number; z: number };
type EnvironmentSnapshot = { dayProgress: number; biome: Biome; weather: WeatherKind };

type GameStore = {
  mode: GameMode;
  gameplayMode: GameplayMode;
  selected: SelectedKind;
  hotbarSlots: SelectedKind[];
  backpackItem: SelectedKind | null;
  itemCounts: Record<string, number>;
  equippedArmor: ArmorKind | null;
  riding: 'car' | 'horse' | 'plane' | 'train' | 'boat' | null;
  ridingRole: 'driver' | 'passenger' | null;
  seatChoice: { vehicle: import('koota').Entity; kind: 'car' | 'plane' | 'train' | 'boat' } | null;
  setSeatChoice: (choice: { vehicle: import('koota').Entity; kind: 'car' | 'plane' | 'train' | 'boat' } | null) => void;
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
  sleepProgress: number | null;
  setSleepProgress: (progress: number | null) => void;
  lives: number;
  cameraMode: 'first' | 'third' | 'front';
  backpackOpen: boolean;
  shopOpen: boolean;
  bookOpen: boolean;
  setShopOpen: (open: boolean) => void;
  setBookOpen: (open: boolean) => void;
  coordinates: Coordinates;
  environment: EnvironmentSnapshot;
  setMode: (mode: GameMode) => void;
  selectBlock: (kind: SelectedKind) => void;
  setHotbarSlot: (index: number, kind: SelectedKind) => void;
  setBackpackItem: (kind: SelectedKind | null) => void;
  setItemCount: (kind: ItemKind | GalleryItemId, count: number) => void;
  equipArmor: (kind: ArmorKind | null) => void;
  setRiding: (riding: 'car' | 'horse' | 'plane' | 'train' | 'boat' | null, role?: 'driver' | 'passenger') => void;
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
  regenerate: (gameplayMode?: GameplayMode) => void;
};

export const useGameStore = create<GameStore>((set) => ({
  mode: 'menu',
  gameplayMode: 'creative',
  selected: BlockKind.Grass,
  hotbarSlots: [...HOTBAR_BLOCKS.slice(0, 10)],
  backpackItem: null,
  itemCounts: { ...DEFAULT_ITEM_COUNTS },
  equippedArmor: null,
  riding: null,
  ridingRole: null,
  seatChoice: null,
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
  sleepProgress: null,
  setSleepProgress: (sleepProgress) => set({ sleepProgress }),
  lives: 10,
  cameraMode: 'first',
  backpackOpen: false,
  shopOpen: false,
  bookOpen: false,
  coordinates: { x: 0, y: 8, z: 0 },
  environment: { dayProgress: 0.38, biome: 'prairie', weather: 'clear' },
  setMode: (mode) => set({ mode }),
  setShopOpen: (shopOpen) => set({ shopOpen }),
  setBookOpen: (bookOpen) => set({ bookOpen, backpackItem: null }),
  selectBlock: (selected) => set((state) => {
    const key = typeof selected === 'number' ? `block_${selected}` : selected;
    if (state.gameplayMode === 'survival' && selected !== 'hand' && (state.itemCounts[key] ?? 0) <= 0) return { notice: 'Récolte et fabrique cet objet avant de l’utiliser.' };
    return { selected };
  }),
  setHotbarSlot: (index, kind) => set((state) => {
    const key = typeof kind === 'number' ? `block_${kind}` : kind;
    if (state.gameplayMode === 'survival' && kind !== 'hand' && (state.itemCounts[key] ?? 0) <= 0) return { notice: 'Cet objet n’a pas encore été fabriqué.' };
    const hotbarSlots = [...state.hotbarSlots];
    hotbarSlots[index] = kind;
    return { hotbarSlots, selected: kind, backpackItem: null };
  }),
  setBackpackItem: (backpackItem) => set({ backpackItem }),
  setItemCount: (kind, count) => set((state) => ({ itemCounts: { ...state.itemCounts, [kind]: Math.max(0, count) } })),
  equipArmor: (equippedArmor) => set({ equippedArmor }),
  setRiding: (riding, role = 'driver') => set({ riding, ridingRole: riding ? role : null }),
  setSeatChoice: (seatChoice) => set({ seatChoice }),
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
  toggleCamera: () => set((state) => ({ cameraMode: state.cameraMode === 'first' ? 'third' : state.cameraMode === 'third' ? 'front' : 'first' })),
  setBackpack: (backpackOpen) => set({ backpackOpen, backpackItem: null }),
  collectApple: () => set((state) => ({ apples: state.apples + 1 })),
  collectMeat: (kind) => set((state) => ({ meat: { ...state.meat, [kind]: state.meat[kind] + 1 } })),
  discardApple: () => set((state) => ({ apples: Math.max(0, state.apples - 1) })),
  discardMeat: (kind) => set((state) => ({ meat: { ...state.meat, [kind]: Math.max(0, state.meat[kind] - 1) } })),
  regenerate: (gameplayMode = 'creative') => set((state) => ({
    generation: state.generation + 1,
    gameplayMode,
    selected: gameplayMode === 'battle' ? 'pistol_iron' : gameplayMode === 'survival' ? 'hand' : BlockKind.Grass,
    hotbarSlots: gameplayMode === 'battle'
      ? ['pistol_iron', 'pistol_bomb', 'bow', 'sword_iron', ...HOTBAR_BLOCKS.slice(0, 6)]
      : gameplayMode === 'survival' ? Array(10).fill('hand') : [...HOTBAR_BLOCKS.slice(0, 10)],
    backpackItem: null,
    itemCounts: gameplayMode === 'survival' ? { hand: 1 } : { ...DEFAULT_ITEM_COUNTS },
    equippedArmor: null,
    riding: null,
    ridingRole: null,
    seatChoice: null,
    bookOpen: false,
    teleportOpen: false,
    container: null,
    chestItems: [],
    apples: 0,
    meat: createMeatInventory(),
    miningProgress: 0,
    flying: false,
    sleepProgress: null,
    lives: 10,
    backpackOpen: false,
    shopOpen: false,
    mode: 'menu',
  })),
}));
