import type { World } from 'koota';
import { Vector3 } from 'three';
import type { Voxel } from './voxel';
import { BlockKind } from './voxel';
import { streamChunks } from './chunks';
import { teleportToHome } from './teleport';
import { AnimalPosition, Environment, Player, PlayerHealth, PlayerState } from './traits';
import { changeInventory, sellableInventoryCount } from './inventory';
import { getItemMeta, selectionInfo } from './items';
import type { SelectedKind } from './items';
import { useGameStore } from './store';
import { translate } from './language';
import { useEffectStore, EFFECT_NAMES } from './effects';
import { spawnBomb } from './bombLifecycle';
import { fireProjectile } from './systems/projectileSystem';
import { spawnAnimal } from './animals';
import { reportAnimalSpawn } from './animalSync';
import { DAY_DURATION } from './dayNight';

export function selectedItemPrice(kind: SelectedKind) {
  if (kind === 'hand') return 0;
  if (typeof kind === 'number') {
    if (kind === BlockKind.DiamondOre) return 25;
    if (kind === BlockKind.GoldOre) return 12;
    if (kind === BlockKind.IronOre) return 8;
    if (kind === BlockKind.CoalOre) return 4;
    return kind === BlockKind.Bedrock || kind === BlockKind.Water || kind === BlockKind.CalmWater ? 0 : 1;
  }
  const category = getItemMeta(kind).category;
  return category === 'vehicle' ? 50 : category === 'armor' ? 25 : category === 'gun' || category === 'bow' ? 15 : category === 'sword' || category === 'pickaxe' || category === 'shovel' ? 8 : category === 'food' ? 3 : 2;
}

let lastCreativeSale = 0;

export function sellSelectedItem() {
  const store = useGameStore.getState();
  if (!['creative', 'survival', 'city-ancient', 'city-modern'].includes(store.gameplayMode)) return false;
  const kind = store.selected;
  const price = selectedItemPrice(kind);
  if (price <= 0) {
    store.setNotice(translate('Sélectionne un objet dans la barre rapide pour le vendre.', 'Select an item in the hotbar to sell it.'));
    return false;
  }
  if (store.gameplayMode !== 'survival') {
    const now = Date.now();
    if (now - lastCreativeSale < 500) {
      store.setNotice(translate('Attends un instant avant de vendre un autre objet.', 'Wait a moment before selling another item.'));
      return false;
    }
    lastCreativeSale = now;
  }
  if (sellableInventoryCount(kind, store) <= 0) {
    store.setNotice(translate('Tu n’as plus cet objet à vendre.', 'You have no more of this item to sell.'));
    return false;
  }
  const name = selectionInfo(kind).name;
  changeInventory(kind, -1);
  store.addCoins(price);
  store.setNotice(translate(`${name} vendu pour ${price} pièce${price > 1 ? 's' : ''}.`, `${name} sold for ${price} coin${price > 1 ? 's' : ''}.`));
  return true;
}

export function useShopBlock(world: World, block: Voxel) {
  const shop = block.shop;
  if (!shop) return false;
  const store = useGameStore.getState();
  const price = Math.max(0, Math.floor(shop.price ?? 0));
  if (shop.action === 'checkpoint') {
    store.setCheckpoint({ x: block.x, y: block.y + 0.51, z: block.z });
    store.setNotice(translate('Checkpoint enregistré !', 'Checkpoint saved!'));
    return true;
  }
  if (shop.action === 'message') {
    store.setNotice(block.text ?? translate('Message du monde.', 'World message.'));
    return true;
  }
  if (shop.action === 'effect' && shop.effect) {
    const duration = Math.max(1, price || 30);
    useEffectStore.getState().activate(shop.effect, duration);
    store.setNotice(translate(`${EFFECT_NAMES()[shop.effect]} pendant ${duration} secondes.`, `${EFFECT_NAMES()[shop.effect]} for ${duration} seconds.`));
    return true;
  }
  if (shop.action === 'bomb') {
    const count = Math.max(1, Math.min(10, Math.floor(shop.count ?? 1)));
    for (let index = 0; index < count; index += 1) spawnBomb(world, block.x + (index % 3 - 1) * 0.6, block.y + 1 + Math.floor(index / 3) * 0.5, block.z);
    store.setNotice(translate(`${count} bombe${count > 1 ? 's' : ''} activée${count > 1 ? 's' : ''} !`, `${count} bomb${count > 1 ? 's' : ''} activated!`));
    return true;
  }
  if (shop.action === 'firework') {
    const count = Math.max(1, Math.min(10, Math.floor(shop.count ?? 1)));
    const colors = ['#ff4f64', '#ffd84d', '#63d8ff', '#9f7aff', '#6dff8b'];
    for (let index = 0; index < count; index += 1) {
      const origin = new Vector3(block.x + (index % 3 - 1) * 0.45, block.y + 0.6, block.z + (Math.floor(index / 3) % 2 - 0.5) * 0.35);
      fireProjectile(world, origin, new Vector3(0, 1, 0), 'bomb', 0, colors[Math.abs(block.x * 7 + block.z * 11 + index) % colors.length], 'firework');
    }
    store.setNotice(translate('Feu d’artifice lancé !', 'Fireworks launched!'));
    return true;
  }
  if ((shop.action === 'day' || shop.action === 'night') && world.queryFirst(Environment)) {
    const night = shop.action === 'night';
    world.queryFirst(Environment)!.get(Environment)!.elapsed = night ? (0.88 - 0.38) * DAY_DURATION : 0;
    store.setEnvironment({ ...store.environment, dayProgress: night ? 0.88 : 0.38 });
    store.setNotice(translate(night ? 'La nuit arrive !' : 'Le jour se lève !', night ? 'Night falls!' : 'Day breaks!'));
    return true;
  }
  if (shop.action === 'weather' && shop.weather) {
    const environment = world.queryFirst(Environment)?.get(Environment);
    if (environment) environment.weather = shop.weather;
    if (store.customWorld) useGameStore.setState({ customWorld: { ...store.customWorld, environment: { ...store.customWorld.environment, weather: shop.weather } } });
    store.setEnvironment({ ...store.environment, weather: shop.weather });
    store.setNotice(translate('La météo change !', 'The weather changes!'));
    return true;
  }
  if (shop.action === 'spawn' && shop.animal) {
    const entity = spawnAnimal(world, shop.animal, block.x, block.y + 1, block.z, Date.now(), `${shop.animal}:button:${crypto.randomUUID()}`);
    if (entity) {
      entity.get(AnimalPosition)!.set(block.x, block.y + 1, block.z);
      reportAnimalSpawn(entity);
    }
    store.setNotice(translate('Un animal apparaît !', 'An animal appears!'));
    return true;
  }
  if (shop.action === 'trap') {
    const player = world.queryFirst(Player);
    const health = player?.get(PlayerHealth);
    if (player && health) {
      const value = Math.max(0, health.value - Math.max(1, price));
      player.set(PlayerHealth, { value });
      store.setLives(value);
      store.setNotice(translate(`Piège ! Tu perds ${Math.max(1, price)} vies.`, `Trap! You lose ${Math.max(1, price)} lives.`));
    }
    return true;
  }
  if (shop.action === 'gift' && shop.item) {
    const count = Math.max(1, Math.floor(shop.count ?? 1));
    changeInventory(shop.item, count);
    store.setNotice(translate(`${selectionInfo(shop.item).name} ×${count} reçu.`, `${selectionInfo(shop.item).name} ×${count} received.`));
    return true;
  }
  if (shop.action === 'heal') {
    const player = world.queryFirst(Player);
    const health = player?.get(PlayerHealth);
    if (player && health) {
      const value = Math.min(health.max, health.value + Math.max(1, price));
      player.set(PlayerHealth, { value });
      store.setLives(value);
      store.setNotice(translate(`Tu as récupéré ${Math.max(1, price)} vies.`, `You recovered ${Math.max(1, price)} lives.`));
    }
    return true;
  }
  if (shop.action === 'teleport' && shop.destination) {
    for (let index = 0; index < 12; index += 1) streamChunks(world, shop.destination.x, shop.destination.z);
    teleportToHome(world, { ...shop.destination, yaw: 0, pitch: 0 });
    world.queryFirst(Player)?.set(PlayerState, { yaw: 0, pitch: 0 });
    store.setNotice(translate('Téléportation réussie !', 'Teleportation successful!'));
    return true;
  }
  if (shop.action === 'earn') {
    store.addCoins(price);
    store.setNotice(translate(`Tu as reçu ${price} pièces.`, `You received ${price} coins.`));
    return true;
  }
  if (!shop.item) return false;
  const count = Math.max(1, Math.floor(shop.count ?? 1));
  const itemName = selectionInfo(shop.item).name;
  if (shop.action === 'buy') {
    if (!store.spendCoins(price)) {
      store.setNotice(translate(`Il te faut ${price} pièces pour acheter ${itemName}.`, `You need ${price} coins to buy ${itemName}.`));
      return true;
    }
    changeInventory(shop.item, count);
    store.setNotice(translate(`${itemName} ×${count} acheté pour ${price} pièces.`, `${itemName} ×${count} bought for ${price} coins.`));
    return true;
  }
  if (shop.action === 'sell') {
    if (sellableInventoryCount(shop.item, store) < count) {
      store.setNotice(translate(`Il te faut ${itemName} ×${count} à vendre.`, `You need ${itemName} ×${count} to sell.`));
      return true;
    }
    changeInventory(shop.item, -count);
    store.addCoins(price);
    store.setNotice(translate(`${itemName} ×${count} vendu pour ${price} pièces.`, `${itemName} ×${count} sold for ${price} coins.`));
    return true;
  }
  return false;
}
