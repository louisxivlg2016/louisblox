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

export const VILLAGER_LINES = [
  'Bonjour ! Nos maisons ont des portes et deux lits. La nuit, nous rentrons dormir.',
  'Les chemins en terre mènent aux champs de blé, de maïs et de carottes.',
  'Notre petite église est au nord du village. Elle est intacte et ouverte à tous.',
  'Le restaurant est à l’est du village. Le marchand offre un repas aux voyageurs.',
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
    story: villager ? VILLAGER_LINES[0] : trader?.restaurantMessage || (restaurantAvailable ? 'Nous voilà enfin au village ! Je t’invite à manger au restaurant, à l’est en suivant le chemin de terre.' : MERCHANT_STORIES[storyId].steps[0]),
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
  useTradeStore.setState({ view: 'restaurant', story: 'Le marchand t’invite à partager un repas chaud au restaurant du village. Les champs et les habitants sont autour de toi.', message: '' });
}

export function acceptRestaurantInvitation(world: World) {
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  if (!playerEntity || !player) return false;
  const seed = getWorldSeed(world);
  const next = restaurantAt(tradeCityAt(seed), seed);
  const merchant = useTradeStore.getState().traderId;
  if (merchant && !merchant.get(Trader)?.villager) {
    merchant.set(Trader, { arrived: true, following: false, walking: true, restaurantInvited: true, restaurantMeal: 'going', restaurantMealTime: 0, restaurantStep: 0, restaurantMessage: 'Viens au restaurant avec moi. Je mange aussi avec toi !', targetX: next.x, targetZ: next.z });
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
  useGameStore.getState().setNotice('Te voilà au restaurant ! Choisis ton repas ici ou ramasse la nourriture sur la table avec E.');
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
    useTradeStore.getState().setMessage('Tu as déjà mangé ce repas. La prochaine assiette sera offerte à ta prochaine visite.');
    return false;
  }
  const health = world.queryFirst(PlayerHealth)?.get(PlayerHealth);
  if (health) health.value = Math.min(health.max, health.value + 4);
  useTradeStore.setState({ mealEaten: true, message: 'Le repas est délicieux ! Tu as récupéré 4 points de vie. Bon appétit !' });
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
