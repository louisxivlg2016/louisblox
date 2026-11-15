import { create } from 'zustand';
import type { Camera } from 'three';
import { changeInventory, inventoryCount } from './inventory';
import type { SelectedKind } from './items';
import { selectionInfo } from './items';
import { useGameStore } from './store';
import { AnimalMesh, AnimalMotion, AnimalPosition, CamelLeash, Player, PlayerBody, PlayerHealth, PlayerMount, PlayerPosition, PlayerState, PlayerVelocity, Trader, TraderMesh, TraderPosition } from './traits';
import type { World } from 'koota';
import { BlockKind } from './voxel';
import { findInteractionTarget } from './interactionTargets';
import { getWorldSeed, streamChunks } from './chunks';
import { tradeCityAt, restaurantAt } from './villages';
import { requestPlay } from './input';

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
    title: 'The Old Bridge Bell',
    steps: [
      'Welcome, traveler. My camels and I have followed the river from the pine forest. We still have a long way to go.',
      'At the old bridge, I heard a bell beneath the ruins. As I approached, I found a small golden bell lost in the grass.',
      'I am bringing it back to the prairie village. Its residents use it to warn each other of night and rain.',
      'The road is long and the camels sometimes get tired. Will you walk with us to the next village? You can also see my goods.',
    ],
    companion: 'Thank you! Stay close. I will show you the old bridge and prairie village.',
  },
  {
    title: 'Mountain Seeds',
    steps: [
      'This morning, I left the snowy mountains with my two camels. The wind was cold, but the sun guided us toward the forest.',
      'A hermit entrusted me with a bag of pine seeds. He asked me to carry them to the village gardens across the river.',
      'We passed the ruins and crossed the orange autumn land. Every region gives us a new story to tell.',
      'The seeds must arrive before nightfall. Will you travel with us for a while, or look at the items I brought?',
    ],
    companion: 'Your company will help us. Together, we will carry these seeds to the village.',
  },
] as const;

export const VILLAGER_LINES = [
  'Hello! Our houses have doors and two beds. At night, we go inside to sleep.',
  'The dirt paths lead to wheat, corn, and carrot fields.',
  'Our little church is north of the village. It is intact and open to everyone.',
  'The restaurant is east of the village. The trader offers meals to travelers.',
] as const;

type TradeState = {
  open: boolean;
  message: string;
  view: 'story' | 'offers' | 'village' | 'restaurant';
  story: string;
  traderId: import('koota').Entity | null;
  storyId: number;
  step: number;
  following: boolean;
  restaurantAvailable: boolean;
  mealEaten: boolean;
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
  restaurantAvailable: false,
  mealEaten: false,
  setOpen: (open) => set({ open }),
  setView: (view) => set({ view }),
  setMessage: (message) => set({ message }),
  setFollowing: (following) => set(following ? { following, open: false } : { following }),
}));

export function beginTraderStory(traderId: import('koota').Entity) {
  useTradeStore.setState((state) => {
    if (state.traderId === traderId) return {};
    const storyId = Math.abs(Number(traderId)) % MERCHANT_STORIES.length;
    return { traderId, storyId, step: 0, story: MERCHANT_STORIES[storyId].steps[0], view: 'story', following: false, restaurantAvailable: false, mealEaten: false };
  });
}

export function openTrader(traderId: import('koota').Entity) {
  const trader = traderId.get(Trader);
  const villager = trader?.villager === true;
  const storyId = Math.abs(Number(traderId)) % MERCHANT_STORIES.length;
  const restaurantAvailable = villager || trader?.arrived === true;
  useTradeStore.setState({
    open: true,
    traderId,
    storyId,
    step: 0,
    story: villager ? VILLAGER_LINES[0] : trader?.restaurantMessage || (restaurantAvailable ? 'We are finally in the village! I invite you to eat at the restaurant, east along the dirt path.' : MERCHANT_STORIES[storyId].steps[0]),
    view: villager ? 'village' : restaurantAvailable ? 'restaurant' : 'story',
    following: false,
    message: '',
    restaurantAvailable,
    mealEaten: false,
  });
}

export function advanceTraderStory(traderId: import('koota').Entity | null) {
  if (traderId === null) return;
  useTradeStore.setState((state) => {
    if (state.traderId !== traderId || state.following) return {};
    if (state.view === 'village') {
      const step = state.step + 1;
      return { step, storyId: step % VILLAGER_LINES.length, story: VILLAGER_LINES[step % VILLAGER_LINES.length] };
    }
    const story = MERCHANT_STORIES[state.storyId];
    const step = Math.min(state.step + 1, story.steps.length - 1);
    if (step === state.step) return {};
    return { step, story: story.steps[step], view: 'story' };
  });
}

export function openRestaurant() {
  useTradeStore.setState({ view: 'restaurant', story: 'The trader invites you to share a warm meal at the village restaurant. Fields and residents surround you.', message: '' });
}

export function acceptRestaurantInvitation(world: World) {
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  if (!playerEntity || !player) return false;
  const seed = getWorldSeed(world);
  const next = restaurantAt(tradeCityAt(seed), seed);
  const merchant = useTradeStore.getState().traderId;
  if (merchant && !merchant.get(Trader)?.villager) {
    merchant.set(Trader, { arrived: true, following: false, walking: true, restaurantInvited: true, restaurantMeal: 'going', restaurantMealTime: 0, restaurantStep: 0, restaurantMessage: 'Come to the restaurant with me. I will eat with you too!', targetX: next.x, targetZ: next.z });
  }
  for (let index = 0; index < 9; index++) streamChunks(world, next.x, next.z);
  if (merchant && !merchant.get(Trader)?.villager) {
    const position = merchant.get(TraderPosition);
    if (position) {
      position.set(next.x - 1, next.y, next.z);
      const mesh = merchant.get(TraderMesh)?.value;
      if (mesh) mesh.position.copy(position);
    }
    for (const camel of world.query(CamelLeash, AnimalPosition, AnimalMesh)) {
      const leash = camel.get(CamelLeash)!;
      if (leash.trader !== merchant) continue;
      const position = camel.get(AnimalPosition)!;
      position.set(next.x - 2.7 - leash.order * 2.6, next.y, next.z + (leash.order % 2 === 0 ? -1 : 1));
      camel.set(AnimalMotion, { yaw: Math.PI / 2, displayYaw: Math.PI / 2, speed: 0, running: false });
      const mesh = camel.get(AnimalMesh)?.value;
      if (mesh) mesh.position.copy(position);
    }
  }
  player.set(next.x, next.y, next.z);
  playerEntity.get(PlayerBody)?.value?.setTranslation(next, true);
  playerEntity.get(PlayerVelocity)?.set(0, 0, 0);
  playerEntity.set(PlayerState, { flying: false, grounded: true });
  useGameStore.setState({ flying: false });
  useGameStore.getState().setNotice('Here you are at the restaurant! Choose your meal here or pick up food from the table with E.');
  useTradeStore.getState().setOpen(false);
  void requestPlay().then(() => {
    playerEntity.get(PlayerPosition)?.set(next.x, next.y, next.z);
    playerEntity.get(PlayerBody)?.value?.setTranslation(next, true);
    playerEntity.set(PlayerState, { flying: false, grounded: true });
  });
  return true;
}

export function eatRestaurantMeal(world: World) {
  if (useTradeStore.getState().mealEaten) {
    useTradeStore.getState().setMessage('You already ate this meal. The next plate will be offered on your next visit.');
    return false;
  }
  const health = world.queryFirst(PlayerHealth)?.get(PlayerHealth);
  if (health) health.value = Math.min(health.max, health.value + 4);
  useTradeStore.setState({ mealEaten: true, message: 'The meal is delicious! You restored 4 health points. Enjoy!' });
  return true;
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
  useTradeStore.getState().setMessage('Trade successful! The items are in your backpack.');
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
