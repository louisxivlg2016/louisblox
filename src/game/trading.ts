import { create } from 'zustand';
import type { Camera } from 'three';
import { changeInventory, inventoryCount } from './inventory';
import type { SelectedKind } from './items';
import { selectionInfo } from './items';
import { useGameStore } from './store';
import { PlayerMount, PlayerPosition } from './traits';
import type { World } from 'koota';
import { BlockKind } from './voxel';
import { findInteractionTarget } from './interactionTargets';

export type TradeOffer = { id: string; cost: SelectedKind; costCount: number; reward: SelectedKind; rewardCount: number };

export const TRADE_OFFERS: TradeOffer[] = [
  { id: 'apple-bread', cost: 'apple', costCount: 2, reward: 'bread', rewardCount: 1 },
  { id: 'wood-iron', cost: BlockKind.Wood, costCount: 3, reward: BlockKind.IronOre, rewardCount: 1 },
  { id: 'sand-glass', cost: BlockKind.Sand, costCount: 4, reward: BlockKind.Glass, rewardCount: 1 },
  { id: 'iron-gold', cost: BlockKind.IronOre, costCount: 2, reward: BlockKind.GoldOre, rewardCount: 1 },
  { id: 'stone-coal', cost: BlockKind.Stone, costCount: 3, reward: BlockKind.CoalOre, rewardCount: 2 },
];

export const MERCHANT_STORIES = [
  {
    title: 'La cloche du vieux pont',
    steps: [
      'Bienvenue, voyageur. Mes chameaux et moi suivons la rivière depuis la forêt des sapins. Nous avons encore beaucoup de chemin devant nous.',
      'Au vieux pont, j’ai entendu une cloche sous les ruines. En m’approchant, j’ai trouvé une petite cloche en or, perdue dans l’herbe.',
      'Je la ramène maintenant au village de la prairie. Ses habitants s’en servent pour se prévenir de la nuit et de la pluie.',
      'Le chemin est long et les chameaux sont parfois fatigués. Veux-tu marcher avec nous jusqu’au prochain village ? Tu pourras aussi voir mes marchandises.',
    ],
    companion: 'Merci ! Reste près de nous. Je te montrerai le vieux pont et le village de la prairie.',
  },
  {
    title: 'Les graines de la montagne',
    steps: [
      'Ce matin, j’ai quitté les montagnes enneigées avec mes deux chameaux. Le vent était froid, mais le soleil nous guidait vers la forêt.',
      'Un ermite m’a confié un sac de graines de sapin. Il m’a demandé de les porter aux jardins du village, de l’autre côté de la rivière.',
      'Nous avons contourné les ruines et traversé l’automne orange. Chaque pays traversé nous donne une nouvelle histoire à raconter.',
      'Les graines doivent arriver avant la nuit. Veux-tu nous accompagner un moment, ou regarder les objets que j’ai rapportés ?',
    ],
    companion: 'Ta compagnie nous fera du bien. Ensemble, nous porterons ces graines jusqu’au village.',
  },
] as const;

type TradeState = {
  open: boolean;
  message: string;
  view: 'story' | 'offers';
  story: string;
  traderId: import('koota').Entity | null;
  storyId: number;
  step: number;
  following: boolean;
  setOpen: (open: boolean) => void;
  setView: (view: TradeState['view']) => void;
  setMessage: (message: string) => void;
  setFollowing: (following: boolean) => void;
};

export const useTradeStore = create<TradeState>((set) => ({
  open: false,
  message: '',
  view: 'story',
  story: MERCHANT_STORIES[0].steps[0],
  traderId: null,
  storyId: 0,
  step: 0,
  following: false,
  setOpen: (open) => set({ open }),
  setView: (view) => set({ view }),
  setMessage: (message) => set({ message }),
  setFollowing: (following) => set(following ? { following, open: false } : { following }),
}));

export function beginTraderStory(traderId: import('koota').Entity) {
  useTradeStore.setState((state) => {
    if (state.traderId === traderId) return {};
    const storyId = Math.abs(Number(traderId)) % MERCHANT_STORIES.length;
    return { traderId, storyId, step: 0, story: MERCHANT_STORIES[storyId].steps[0], view: 'story', following: false };
  });
}

export function openTrader(traderId: import('koota').Entity) {
  beginTraderStory(traderId);
  useTradeStore.setState({ open: true, view: 'story', message: '' });
}

export function advanceTraderStory(traderId: import('koota').Entity | null) {
  if (traderId === null) return;
  useTradeStore.setState((state) => {
    if (state.traderId !== traderId || state.following) return {};
    const story = MERCHANT_STORIES[state.storyId];
    const step = Math.min(state.step + 1, story.steps.length - 1);
    if (step === state.step) return {};
    return { step, story: story.steps[step], view: 'story' };
  });
}

export function canTrade(offer: TradeOffer) {
  const state = useGameStore.getState();
  return state.gameplayMode !== 'survival' || inventoryCount(offer.cost, state) >= offer.costCount;
}

export function tradeWithMerchant(offer: TradeOffer) {
  if (!canTrade(offer)) {
    useTradeStore.getState().setMessage(`Objet insuffisant : il faut ${offer.costCount} ${selectionInfo(offer.cost).name}.`);
    return false;
  }
  if (useGameStore.getState().gameplayMode === 'survival') changeInventory(offer.cost, -offer.costCount);
  changeInventory(offer.reward, offer.rewardCount);
  useTradeStore.getState().setMessage('Échange réussi ! Les objets sont dans ton sac.');
  return true;
}

export function tradeInteractionSystem(world: World, camera: Camera, interact: number) {
  if (interact <= 0) return false;
  const playerEntity = world.queryFirst(PlayerPosition);
  if (playerEntity?.get(PlayerMount)?.vehicle) return false;
  const target = findInteractionTarget(world, camera, 'trade');
  if (!target) return false;
  openTrader(target.entity);
  useGameStore.getState().setMode('pause');
  if (document.pointerLockElement) document.exitPointerLock();
  return true;
}
