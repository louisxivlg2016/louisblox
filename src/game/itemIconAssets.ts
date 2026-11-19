import type { ItemKind } from './items';

import stickUrl from '../../assets/icons/items/stick.png';
import shearsUrl from '../../assets/icons/items/shears.png';
import bucketUrl from '../../assets/icons/items/bucket.png';
import water_bucketUrl from '../../assets/icons/items/water_bucket.png';
import empty_bucketUrl from '../../assets/icons/items/empty_bucket.png';
import paint_cleaning_bucketUrl from '../../assets/icons/items/paint_cleaning_bucket.png';
import sword_woodUrl from '../../assets/icons/items/sword_wood.png';
import sword_stoneUrl from '../../assets/icons/items/sword_stone.png';
import sword_ironUrl from '../../assets/icons/items/sword_iron.png';
import sword_goldUrl from '../../assets/icons/items/sword_gold.png';
import sword_diamondUrl from '../../assets/icons/items/sword_diamond.png';
import sword_silverUrl from '../../assets/icons/items/sword_silver.png';
import pickaxe_woodUrl from '../../assets/icons/items/pickaxe_wood.png';
import pickaxe_stoneUrl from '../../assets/icons/items/pickaxe_stone.png';
import pickaxe_ironUrl from '../../assets/icons/items/pickaxe_iron.png';
import pickaxe_goldUrl from '../../assets/icons/items/pickaxe_gold.png';
import pickaxe_diamondUrl from '../../assets/icons/items/pickaxe_diamond.png';
import pickaxe_silverUrl from '../../assets/icons/items/pickaxe_silver.png';
import shovel_woodUrl from '../../assets/icons/items/shovel_wood.png';
import shovel_stoneUrl from '../../assets/icons/items/shovel_stone.png';
import shovel_ironUrl from '../../assets/icons/items/shovel_iron.png';
import shovel_goldUrl from '../../assets/icons/items/shovel_gold.png';
import shovel_diamondUrl from '../../assets/icons/items/shovel_diamond.png';
import shovel_silverUrl from '../../assets/icons/items/shovel_silver.png';
import armor_goldUrl from '../../assets/icons/items/armor_gold.png';
import armor_diamondUrl from '../../assets/icons/items/armor_diamond.png';
import armor_silverUrl from '../../assets/icons/items/armor_silver.png';
import appleUrl from '../../assets/icons/items/apple.png';
import breadUrl from '../../assets/icons/items/bread.png';
import cakeUrl from '../../assets/icons/items/cake.png';
import raw_meatUrl from '../../assets/icons/items/raw_meat.png';
import cooked_meatUrl from '../../assets/icons/items/cooked_meat.png';
import raw_chickenUrl from '../../assets/icons/items/raw_chicken.png';
import cooked_chickenUrl from '../../assets/icons/items/cooked_chicken.png';
import raw_salmonUrl from '../../assets/icons/items/raw_salmon.png';
import cooked_salmonUrl from '../../assets/icons/items/cooked_salmon.png';
import cheese_sliceUrl from '../../assets/icons/items/cheese_slice.png';
import cheese_wheelUrl from '../../assets/icons/items/cheese_wheel.png';
import milkUrl from '../../assets/icons/items/milk.png';
import woolUrl from '../../assets/icons/items/wool.png';
import berriesUrl from '../../assets/icons/items/berries.png';
import cornUrl from '../../assets/icons/items/corn.png';
import cooked_cornUrl from '../../assets/icons/items/cooked_corn.png';
import wheatUrl from '../../assets/icons/items/wheat.png';
import tomatoUrl from '../../assets/icons/items/tomato.png';
import carrotUrl from '../../assets/icons/items/carrot.png';
import watermelonUrl from '../../assets/icons/items/watermelon.png';
import bowUrl from '../../assets/icons/items/bow.png';
import crossbowUrl from '../../assets/icons/items/crossbow.png';
import pistol_ironUrl from '../../assets/icons/items/pistol_iron.png';
import pistol_goldUrl from '../../assets/icons/items/pistol_gold.png';
import pistol_bombUrl from '../../assets/icons/items/pistol_bomb.png';
import rifle_autoUrl from '../../assets/icons/items/rifle_auto.png';
import rifle_flintlockUrl from '../../assets/icons/items/rifle_flintlock.png';
import car_redUrl from '../../assets/icons/items/car_red.png';
import car_blueUrl from '../../assets/icons/items/car_blue.png';
import planeUrl from '../../assets/icons/items/plane.png';
import trainUrl from '../../assets/icons/items/train.png';
import metroUrl from '../../assets/icons/items/metro.png';
import boatUrl from '../../assets/icons/items/boat.png';
import jeepUrl from '../../assets/icons/items/jeep.png';
import police_carUrl from '../../assets/icons/items/police_car.png';
import firetruckUrl from '../../assets/icons/items/firetruck.png';
import carriageUrl from '../../assets/icons/items/carriage.png';
import cannonUrl from '../../assets/icons/items/cannon.png';
import saddleUrl from '../../assets/icons/items/saddle.png';
import extinguisherUrl from '../../assets/icons/items/extinguisher.png';
import parachuteUrl from '../../assets/icons/items/parachute.png';
import radioUrl from '../../assets/icons/items/radio.png';

export const ITEM_ICON_ASSETS: Partial<Record<ItemKind, string>> = {
  "stick": stickUrl,
  "shears": shearsUrl,
  "bucket": bucketUrl,
  "water_bucket": water_bucketUrl,
  "empty_bucket": empty_bucketUrl,
  "paint_cleaning_bucket": paint_cleaning_bucketUrl,
  "sword_wood": sword_woodUrl,
  "sword_stone": sword_stoneUrl,
  "sword_iron": sword_ironUrl,
  "sword_gold": sword_goldUrl,
  "sword_diamond": sword_diamondUrl,
  "sword_silver": sword_silverUrl,
  "pickaxe_wood": pickaxe_woodUrl,
  "pickaxe_stone": pickaxe_stoneUrl,
  "pickaxe_iron": pickaxe_ironUrl,
  "pickaxe_gold": pickaxe_goldUrl,
  "pickaxe_diamond": pickaxe_diamondUrl,
  "pickaxe_silver": pickaxe_silverUrl,
  "shovel_wood": shovel_woodUrl,
  "shovel_stone": shovel_stoneUrl,
  "shovel_iron": shovel_ironUrl,
  "shovel_gold": shovel_goldUrl,
  "shovel_diamond": shovel_diamondUrl,
  "shovel_silver": shovel_silverUrl,
  "armor_gold": armor_goldUrl,
  "armor_diamond": armor_diamondUrl,
  "armor_silver": armor_silverUrl,
  "apple": appleUrl,
  "bread": breadUrl,
  "cake": cakeUrl,
  "raw_meat": raw_meatUrl,
  "cooked_meat": cooked_meatUrl,
  "raw_chicken": raw_chickenUrl,
  "cooked_chicken": cooked_chickenUrl,
  "raw_salmon": raw_salmonUrl,
  "cooked_salmon": cooked_salmonUrl,
  "cheese_slice": cheese_sliceUrl,
  "cheese_wheel": cheese_wheelUrl,
  "milk": milkUrl,
  "wool": woolUrl,
  "berries": berriesUrl,
  "corn": cornUrl,
  "cooked_corn": cooked_cornUrl,
  "wheat": wheatUrl,
  "tomato": tomatoUrl,
  "carrot": carrotUrl,
  "watermelon": watermelonUrl,
  "bow": bowUrl,
  "crossbow": crossbowUrl,
  "pistol_iron": pistol_ironUrl,
  "pistol_gold": pistol_goldUrl,
  "pistol_bomb": pistol_bombUrl,
  "rifle_auto": rifle_autoUrl,
  "rifle_flintlock": rifle_flintlockUrl,
  "car_red": car_redUrl,
  "car_blue": car_blueUrl,
  "plane": planeUrl,
  "train": trainUrl,
  "metro": metroUrl,
  "boat": boatUrl,
  "jeep": jeepUrl,
  "police_car": police_carUrl,
  "firetruck": firetruckUrl,
  "carriage": carriageUrl,
  "cannon": cannonUrl,
  "saddle": saddleUrl,
  "extinguisher": extinguisherUrl,
  "parachute": parachuteUrl,
};

export const RADIO_ICON_URL = radioUrl;
