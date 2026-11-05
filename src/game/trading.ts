import { create } from 'zustand';
import type { Camera } from 'three';
import { Vector3 } from 'three';
import { changeInventory, inventoryCount } from './inventory';
import type { SelectedKind } from './items';
import { selectionInfo } from './items';
import { useGameStore } from './store';
import { PlayerMount, PlayerPosition, Trader, TraderPosition } from './traits';
import type { World } from 'koota';
import { BlockKind } from './voxel';

export type TradeOffer = { id: string; cost: SelectedKind; costCount: number; reward: SelectedKind; rewardCount: number };

export const TRADE_OFFERS: TradeOffer[] = [
  { id: 'apple-bread', cost: 'apple', costCount: 2, reward: 'bread', rewardCount: 1 },
  { id: 'wood-iron', cost: BlockKind.Wood, costCount: 3, reward: BlockKind.IronOre, rewardCount: 1 },
  { id: 'sand-glass', cost: BlockKind.Sand, costCount: 4, reward: BlockKind.Glass, rewardCount: 1 },
  { id: 'iron-gold', cost: BlockKind.IronOre, costCount: 2, reward: BlockKind.GoldOre, rewardCount: 1 },
  { id: 'stone-coal', cost: BlockKind.Stone, costCount: 3, reward: BlockKind.CoalOre, rewardCount: 2 },
];

export const useTradeStore = create<{ open: boolean; message: string; setOpen: (open: boolean) => void; setMessage: (message: string) => void }>((set) => ({
  open: false,
  message: '',
  setOpen: (open) => set({ open }),
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
  const player = playerEntity?.get(PlayerPosition);
  if (!player || playerEntity?.get(PlayerMount)?.vehicle) return false;
  const origin = player.clone();
  origin.y += 1.62;
  const direction = camera.getWorldDirection(new Vector3());
  let nearest = 6;
  let found = false;
  world.query(Trader, TraderPosition).forEach((entity) => {
    const target = entity.get(TraderPosition)!.clone();
    target.y += 1.1;
    target.sub(origin);
    const distance = target.length();
    if (distance > 0.001 && distance < nearest && target.normalize().dot(direction) > 0.65) {
      nearest = distance;
      found = true;
    }
  });
  if (!found) return false;
  useTradeStore.setState({ open: true, message: '' });
  useGameStore.getState().setMode('pause');
  if (document.pointerLockElement) document.exitPointerLock();
  return true;
}
