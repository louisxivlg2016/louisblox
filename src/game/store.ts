import { create } from 'zustand';
import type { MountKind, VehicleKind } from './vehicleTypes';
import type { AnimalKind } from './animals';
import type { ArmorKind, ItemKind, SelectedKind } from './items';
import type { GalleryItemId } from './galleryCatalog';
import { DEFAULT_ITEM_COUNTS } from './items';
import type { Biome } from './levels';
import { createMeatInventory } from './meats';
import { BlockKind, HOTBAR_BLOCKS } from './voxel';
import type { GameplayMode } from './worldMode';
import { PIRATE_KITS } from './pirates';
import { normalizePaintballGun } from './paintball';

export type GameMode = 'menu' | 'play' | 'pause';
export type WeatherKind = 'clear' | 'rain' | 'snow';
type Coordinates = { x: number; y: number; z: number };
type EnvironmentSnapshot = { dayProgress: number; biome: Biome; weather: WeatherKind };

type GameStore = {
  mode: GameMode;
  gameplayMode: GameplayMode;
  selected: SelectedKind;
  hotbarSlots: Array<SelectedKind | null>;
  backpackItem: SelectedKind | null;
  itemCounts: Record<string, number>;
  equippedArmor: ArmorKind | null;
  riding: MountKind | null;
  ridingRole: 'driver' | 'passenger' | null;
  seatChoice: { vehicle: import('koota').Entity; kind: VehicleKind } | null;
  setSeatChoice: (choice: { vehicle: import('koota').Entity; kind: VehicleKind } | null) => void;
  notice: string;
  teleportOpen: boolean;
  container: { type: 'chest' | 'furnace'; x: number; y: number; z: number } | null;
  chestItems: SelectedKind[];
  openContainer: (type: 'chest' | 'furnace', position: { x: number; y: number; z: number }, items?: SelectedKind[]) => void;
  closeContainer: () => void;
  generation: number;
  worldId: string;
  worldName: string;
  worldTemplate: import('./worldMode').WorldTemplate;
  customWorld: import('./worldCode').CustomWorldDefinition | null;
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
  setRiding: (riding: MountKind | null, role?: 'driver' | 'passenger') => void;
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
  regenerate: (gameplayMode?: GameplayMode, worldId?: string, template?: import('./worldMode').WorldTemplate, worldName?: string, customWorld?: import('./worldCode').CustomWorldDefinition | null) => void;
  openWorld: (worldId: string, worldName: string) => void;
};

function currentWorldId() {
  try {
    return localStorage.getItem('louisblox-current-world') || 'main-room';
  } catch {
    return 'main-room';
  }
}

export function rememberWorld(worldId: string) {
  try {
    localStorage.setItem('louisblox-current-world', worldId);
  } catch {
  }
}

function currentWorldName() {
  const worldId = currentWorldId();
  try {
    const worlds = JSON.parse(localStorage.getItem('louisblox-worlds-v1') ?? '[]');
    if (Array.isArray(worlds)) {
      const saved = worlds.find((world) => world && world.id === worldId && typeof world.name === 'string');
      if (saved) return saved.name;
    }
  } catch {
  }
  return worldId === 'main-room' ? 'Monde principal' : worldId;
}

export const useGameStore = create<GameStore>((set) => ({
  mode: 'menu',
  worldId: currentWorldId(),
  worldName: currentWorldName(),
  gameplayMode: 'creative',
  worldTemplate: 'nature',
  customWorld: null,
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
    selected = normalizePaintballGun(selected);
    const key = typeof selected === 'number' ? `block_${selected}` : selected;
    if (state.gameplayMode === 'survival' && selected !== 'hand' && (state.itemCounts[key] ?? 0) <= 0) return { notice: 'Récolte et fabrique cet objet avant de l’utiliser.' };
    return { selected };
  }),
  setHotbarSlot: (index, kind) => set((state) => {
    if (kind === null) {
      const hotbarSlots = [...state.hotbarSlots];
      hotbarSlots[index] = null;
      return { hotbarSlots, selected: state.selected, backpackItem: null };
    }
    kind = normalizePaintballGun(kind);
    const key = typeof kind === 'number' ? `block_${kind}` : kind;
    if (state.gameplayMode === 'survival' && kind !== 'hand' && (state.itemCounts[key] ?? 0) <= 0) return { notice: 'Cet objet n’a pas encore été fabriqué.' };
    const hotbarSlots = [...state.hotbarSlots];
    hotbarSlots[index] = kind;
    return { hotbarSlots, selected: kind, backpackItem: null };
  }),
  setBackpackItem: (backpackItem) => set({ backpackItem }),
  setItemCount: (kind, count) => set((state) => {
    const itemCounts = { ...state.itemCounts, [kind]: Math.max(0, count) };
    if (state.gameplayMode !== 'survival' || count > 0 || kind === 'hand') return { itemCounts };
    return {
      itemCounts,
      hotbarSlots: state.hotbarSlots.map((slot) => slot === kind || typeof slot === 'number' && `block_${slot}` === kind ? null : slot),
      selected: state.selected === kind || typeof state.selected === 'number' && `block_${state.selected}` === kind ? 'hand' as const : state.selected,
    };
  }),
  equipArmor: (equippedArmor) => set({ equippedArmor }),
  setRiding: (riding, role = 'driver') => set({ riding, ridingRole: riding ? role : null }),
  setSeatChoice: (seatChoice) => set({ seatChoice }),
  setNotice: (notice) => set({ notice }),
  setTeleportOpen: (teleportOpen) => set((state) => ({ teleportOpen: teleportOpen && !['pirates', 'battle', 'maze'].includes(state.gameplayMode) })),
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
  regenerate: (gameplayMode = 'creative', worldId = `monde-${crypto.randomUUID().slice(0, 8)}`, template: import('./worldMode').WorldTemplate = 'nature', worldName?: string, customWorld: import('./worldCode').CustomWorldDefinition | null = null) => {
    rememberWorld(worldId);
    set((state) => ({
      worldId,
      worldName: worldName ?? worldId,
      generation: state.generation + 1,
      gameplayMode,
      worldTemplate: gameplayMode === 'city-ancient' || gameplayMode === 'city-modern' ? gameplayMode : template,
      customWorld,
      selected: gameplayMode === 'battle' ? 'pistol_iron' : gameplayMode === 'pirates' ? 'pistol_bomb' : gameplayMode === 'survival' || gameplayMode === 'football' || gameplayMode === 'maze' ? 'hand' : BlockKind.Grass,
      hotbarSlots: gameplayMode === 'battle'
        ? ['pistol_iron', 'rifle_auto', 'pistol_bomb', 'bow', 'sword_iron', ...HOTBAR_BLOCKS.slice(0, 5)]
        : gameplayMode === 'pirates' ? [...PIRATE_KITS.defender.hotbar] : gameplayMode === 'survival' || gameplayMode === 'football' || gameplayMode === 'maze' ? ['hand', ...Array(9).fill(null)] : [...HOTBAR_BLOCKS.slice(0, 10)],
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
    }));
  },
  openWorld: (worldId, worldName) => {
    rememberWorld(worldId);
    set((state) => ({
      worldId,
      worldName,
      generation: state.generation + 1,
      mode: 'menu',
    }));
  },
}));
