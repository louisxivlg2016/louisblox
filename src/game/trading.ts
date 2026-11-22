import { create } from 'zustand';
import type { Camera } from 'three';
import { changeInventory, inventoryCount } from './inventory';
import type { SelectedKind } from './items';
import { selectionInfo } from './items';
import { useGameStore } from './store';
import { AnimalMesh, AnimalMotion, AnimalPosition, CamelLeash, Player, PlayerHealth, PlayerMount, PlayerPosition, PlayerState, Trader, TraderMesh, TraderPosition } from './traits';
import type { World } from 'koota';
import { BlockKind } from './voxel';
import { findInteractionTarget } from './interactionTargets';
import { getWorldSeed, streamChunks } from './chunks';
import { tradeCityAt, restaurantAt } from './villages';
import { requestPlay } from './input';
import { translate } from './language';
import { teleportToHome } from './teleport';
import { heightAt } from './levels';
import { groundAt } from './vehicles';
import { reportAnimalSpawn } from './animalSync';
import { saveWorld } from './save';
import { useNavigationStore } from './navigation';

export type TradeOffer = { id: string; cost: SelectedKind; costCount: number; reward: SelectedKind; rewardCount: number };

export const TRADE_OFFERS: TradeOffer[] = [
  { id: 'apple-bread', cost: 'apple', costCount: 2, reward: 'bread', rewardCount: 1 },
  { id: 'wood-iron', cost: BlockKind.Wood, costCount: 3, reward: BlockKind.IronOre, rewardCount: 1 },
  { id: 'sand-glass', cost: BlockKind.Sand, costCount: 4, reward: BlockKind.Glass, rewardCount: 1 },
  { id: 'iron-gold', cost: BlockKind.IronOre, costCount: 2, reward: BlockKind.GoldOre, rewardCount: 1 },
  { id: 'stone-coal', cost: BlockKind.Stone, costCount: 3, reward: BlockKind.CoalOre, rewardCount: 2 },
];

export const merchantStories = () => [
  {
    title: translate('La cloche du vieux pont', 'The Old Bridge Bell'),
    steps: [
      translate('Bienvenue, voyageur. Mes chameaux et moi suivons la rivière depuis la forêt des sapins. Nous avons encore beaucoup de chemin devant nous.', 'Welcome, traveler. My camels and I have followed the river from the pine forest. We still have a long way to go.'),
      translate('Au vieux pont, j’ai entendu une cloche sous les ruines. En m’approchant, j’ai trouvé une petite cloche en or, perdue dans l’herbe.', 'At the old bridge, I heard a bell beneath the ruins. As I approached, I found a small golden bell lost in the grass.'),
      translate('Je la ramène maintenant au village de la prairie. Ses habitants s’en servent pour se prévenir de la nuit et de la pluie.', 'I am bringing it back to the prairie village. Its residents use it to warn each other of night and rain.'),
      translate('Le chemin est long et les chameaux sont parfois fatigués. Veux-tu marcher avec nous jusqu’au prochain village ? Tu pourras aussi voir mes marchandises.', 'The road is long and the camels sometimes get tired. Will you walk with us to the next village? You can also see my goods.'),
    ],
    companion: translate('Merci ! Reste près de nous. Je te montrerai le vieux pont et le village de la prairie.', 'Thank you! Stay close. I will show you the old bridge and prairie village.'),
  },
  {
    title: translate('Les graines de la montagne', 'Mountain Seeds'),
    steps: [
      translate('Ce matin, j’ai quitté les montagnes enneigées avec mes deux chameaux. Le vent était froid, mais le soleil nous guidait vers la forêt.', 'This morning, I left the snowy mountains with my two camels. The wind was cold, but the sun guided us toward the forest.'),
      translate('Un ermite m’a confié un sac de graines de sapin. Il m’a demandé de les porter aux jardins du village, de l’autre côté de la rivière.', 'A hermit entrusted me with a bag of pine seeds. He asked me to carry them to the village gardens across the river.'),
      translate('Nous avons contourné les ruines et traversé l’automne orange. Chaque pays traversé nous donne une nouvelle histoire à raconter.', 'We passed the ruins and crossed the orange autumn land. Every region gives us a new story to tell.'),
      translate('Les graines doivent arriver avant la nuit. Veux-tu nous accompagner un moment, ou regarder les objets que j’ai rapportés ?', 'The seeds must arrive before nightfall. Will you travel with us for a while, or look at the items I brought?'),
    ],
    companion: translate('Ta compagnie nous fera du bien. Ensemble, nous porterons ces graines jusqu’au village.', 'Your company will help us. Together, we will carry these seeds to the village.'),
  },
];

export const villagerLines = () => [
  translate('Bonjour ! Nos maisons ont des portes et deux lits. La nuit, nous rentrons dormir.', 'Hello! Our houses have doors and two beds. At night, we go inside to sleep.'),
  translate('Les chemins en terre mènent aux champs de blé, de maïs et de carottes.', 'The dirt paths lead to wheat, corn, and carrot fields.'),
  translate('Notre petite église est au nord du village. Elle est intacte et ouverte à tous.', 'Our little church is north of the village. It is intact and open to everyone.'),
  translate('Le restaurant est à l’est du village. Le marchand offre un repas aux voyageurs.', 'The restaurant is east of the village. The trader offers meals to travelers.'),
];

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
  story: merchantStories()[0].steps[0],
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
    const storyId = Math.abs(Number(traderId)) % merchantStories().length;
    return { traderId, storyId, step: 0, story: merchantStories()[storyId].steps[0], view: 'story', following: false, restaurantAvailable: false, mealEaten: false };
  });
}

export function viewTraderOffers(world: World) {
  const traderId = useTradeStore.getState().traderId;
  if (traderId) {
    traderId.set(Trader, { walking: false });
    for (const camel of world.query(CamelLeash)) {
      if (camel.get(CamelLeash)?.trader !== traderId) continue;
      camel.set(AnimalMotion, { speed: 0, running: false });
    }
  }
  useTradeStore.getState().setView('offers');
  useGameStore.getState().setMode('pause');
}

export function openTrader(traderId: import('koota').Entity) {
  const trader = traderId.get(Trader);
  const villager = trader?.villager === true;
  const storyId = Math.abs(Number(traderId)) % merchantStories().length;
  const restaurantAvailable = villager || trader?.arrived === true;
  useTradeStore.setState({
    open: true,
    traderId,
    storyId,
    step: 0,
    story: villager ? villagerLines()[0] : trader?.restaurantMessage || (restaurantAvailable ? translate('Nous voilà enfin au village ! Je t’invite à manger au restaurant, à l’est en suivant le chemin de terre.', 'We are finally in the village! I invite you to eat at the restaurant, east along the dirt path.') : merchantStories()[storyId].steps[0]),
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
      return { step, storyId: step % villagerLines().length, story: villagerLines()[step % villagerLines().length] };
    }
    const story = merchantStories()[state.storyId];
    const step = Math.min(state.step + 1, story.steps.length - 1);
    if (step === state.step) return {};
    return { step, story: story.steps[step], view: 'story' };
  });
}

export function openRestaurant() {
  useTradeStore.setState({ view: 'restaurant', story: translate('Le marchand t’invite à partager un repas chaud au restaurant du village. Les champs et les habitants sont autour de toi.', 'The trader invites you to share a warm meal at the village restaurant. Fields and residents surround you.'), message: '' });
}

export function arriveAtVillageWithTrader(world: World) {
  const traderId = useTradeStore.getState().traderId;
  const trader = traderId?.get(Trader);
  if (!traderId || !trader || trader.villager) return false;
  const seed = getWorldSeed(world);
  const site = tradeCityAt(seed);
  const destination = teleportToHome(world, { x: site.x, y: heightAt(site.x, site.z + 7, seed) + 0.51, z: site.z + 7, yaw: 0, pitch: 0 });
  if (!destination) return false;
  traderId.set(Trader, { following: false, arrived: true, walking: false, targetX: site.x, targetZ: site.z, destinationX: site.x, destinationZ: site.z });
  const traderPosition = traderId.get(TraderPosition);
  if (traderPosition) {
    traderPosition.set(destination.x + 2, groundAt(world, destination.x + 2, destination.z, destination.y + 8), destination.z);
    const mesh = traderId.get(TraderMesh)?.value;
    if (mesh) mesh.position.copy(traderPosition);
  }
  for (const camel of world.query(CamelLeash, AnimalPosition, AnimalMotion)) {
    const leash = camel.get(CamelLeash)!;
    if (leash.trader !== traderId) continue;
    const x = destination.x - 2.7 - leash.order * 2.6;
    const z = destination.z + (leash.order % 2 === 0 ? -1 : 1);
    const position = camel.get(AnimalPosition)!;
    position.set(x, groundAt(world, x, z, destination.y + 8), z);
    camel.set(AnimalMotion, { yaw: Math.PI / 2, displayYaw: Math.PI / 2, speed: 0, running: false, velocityY: 0, grounded: true });
    const mesh = camel.get(AnimalMesh)?.value;
    if (mesh) mesh.position.copy(position);
    reportAnimalSpawn(camel);
  }
  useTradeStore.setState({ following: false, open: false });
  useNavigationStore.getState().clearCaravanDestination();
  useGameStore.getState().setNotice(translate('La caravane est arrivée au village !', 'The caravan has arrived at the village!'));
  saveWorld(world);
  void requestPlay();
  return true;
}

export function acceptRestaurantInvitation(world: World) {
  const playerEntity = world.queryFirst(Player);
  const player = playerEntity?.get(PlayerPosition);
  if (!playerEntity || !player) return false;
  const seed = getWorldSeed(world);
  const merchant = useTradeStore.getState().traderId;
  const merchantData = merchant?.get(Trader);
  const site = merchantData?.destinationX !== null && merchantData?.destinationX !== undefined && merchantData.destinationZ !== null && merchantData.destinationZ !== undefined ? { x: merchantData.destinationX, z: merchantData.destinationZ } : tradeCityAt(seed);
  const next = restaurantAt(site, seed);
  if (merchant && !merchant.get(Trader)?.villager) {
    merchant.set(Trader, { arrived: true, following: false, walking: true, restaurantInvited: true, restaurantMeal: 'going', restaurantMealTime: 0, restaurantStep: 0, restaurantMessage: translate('Viens au restaurant avec moi. Je mange aussi avec toi !', 'Come to the restaurant with me. I will eat with you too!'), targetX: next.x, targetZ: next.z });
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
  const state = playerEntity.get(PlayerState);
  const destination = teleportToHome(world, { x: next.x, y: next.y, z: next.z, yaw: state?.yaw ?? 0, pitch: state?.pitch ?? 0 });
  if (!destination) return false;
  useGameStore.getState().setNotice(translate('Te voilà au restaurant ! Choisis ton repas ici ou ramasse la nourriture sur la table avec E.', 'Here you are at the restaurant! Choose your meal here or pick up food from the table with E.'));
  useTradeStore.getState().setOpen(false);
  void requestPlay();
  return true;
}

export function eatRestaurantMeal(world: World) {
  if (useTradeStore.getState().mealEaten) {
    useTradeStore.getState().setMessage(translate('Tu as déjà mangé ce repas. La prochaine assiette sera offerte à ta prochaine visite.', 'You already ate this meal. The next plate will be offered on your next visit.'));
    return false;
  }
  const health = world.queryFirst(PlayerHealth)?.get(PlayerHealth);
  if (health) health.value = Math.min(health.max, health.value + 4);
  useTradeStore.setState({ mealEaten: true, message: translate('Le repas est délicieux ! Tu as récupéré 4 points de vie. Bon appétit !', 'The meal is delicious! You restored 4 health points. Enjoy!') });
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
  useTradeStore.getState().setMessage(translate('Échange réussi ! Les objets sont dans ton sac.', 'Trade successful! The items are in your backpack.'));
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
