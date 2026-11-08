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

const TRAVEL_STORIES = [
  'Je traverse les prairies, les forêts et la neige avec mes deux chameaux. Nous transportons du bois, du verre et des objets rares entre les villages. Le désert était long, mais nous avons suivi les rivières jusqu’aux montagnes.',
  'Je vais de village en village depuis les montagnes enneigées. Mes chameaux portent nos provisions et les marchandises que j’échange. Hier, nous avons contourné une forêt avant de descendre vers cette prairie.',
  'Je parcours le monde avec mes chameaux. J’ai vu des ruines au bord des rivières, des sapins sous la neige et des pommiers en prairie. Chaque rencontre rend le voyage plus agréable.',
] as const;

type TradeState = {
  open: boolean;
  message: string;
  view: 'story' | 'offers';
  story: string;
  setOpen: (open: boolean) => void;
  setView: (view: TradeState['view']) => void;
  setMessage: (message: string) => void;
};

export const useTradeStore = create<TradeState>((set) => ({
  open: false,
  message: '',
  view: 'story',
  story: TRAVEL_STORIES[0],
  setOpen: (open) => set(open ? { open, view: 'story', story: TRAVEL_STORIES[Math.floor(Math.random() * TRAVEL_STORIES.length)], message: '' } : { open }),
  setView: (view) => set({ view }),
  setMessage: (message) => set({ message }),
}));

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
  if (!findInteractionTarget(world, camera, 'trade')) return false;
  useTradeStore.getState().setOpen(true);
  useGameStore.getState().setMode('pause');
  if (document.pointerLockElement) document.exitPointerLock();
  return true;
}
