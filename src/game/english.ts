import { useLanguageStore } from './language';

const names: Record<string, string> = {
  Main: 'Hand', Bâton: 'Stick', Cisailles: 'Shears', 'Seau vide': 'Empty Bucket', 'Seau plein d’eau': 'Water Bucket', 'Seau toujours vide': 'Always Empty Bucket',
  'Épée en bois': 'Wooden Sword', 'Épée en pierre': 'Stone Sword', 'Épée en fer': 'Iron Sword', 'Épée en or': 'Gold Sword', 'Épée en diamant': 'Diamond Sword', 'Épée en argent': 'Silver Sword',
  'Pioche en bois': 'Wooden Pickaxe', 'Pioche en pierre': 'Stone Pickaxe', 'Pioche en fer': 'Iron Pickaxe', 'Pioche en or': 'Gold Pickaxe', 'Pioche en diamant': 'Diamond Pickaxe', 'Pioche en argent': 'Silver Pickaxe',
  'Pelle en bois': 'Wooden Shovel', 'Pelle en pierre': 'Stone Shovel', 'Pelle en fer': 'Iron Shovel', 'Pelle en or': 'Gold Shovel', 'Pelle en diamant': 'Diamond Shovel', 'Pelle en argent': 'Silver Shovel',
  'Armure de chevalier en or': 'Gold Knight Armor', 'Armure de chevalier en diamant': 'Diamond Knight Armor', 'Armure de chevalier en argent': 'Silver Knight Armor',
  Pomme: 'Apple', Pain: 'Bread', Gâteau: 'Cake', 'Viande crue': 'Raw Meat', 'Viande cuite': 'Cooked Meat', 'Poulet cru': 'Raw Chicken', 'Poulet cuit': 'Cooked Chicken',
  'Saumon cru': 'Raw Salmon', 'Saumon cuit': 'Cooked Salmon', 'Tranche de fromage': 'Cheese Slice', 'Fromage entier': 'Cheese Wheel', Lait: 'Milk', Laine: 'Wool', Baies: 'Berries',
  Maïs: 'Corn', 'Maïs cuit': 'Cooked Corn', Blé: 'Wheat', Tomate: 'Tomato', Carotte: 'Carrot', Pastèque: 'Watermelon', 'Arc à flèches': 'Bow', Arbalète: 'Crossbow',
  'Pistolet en fer': 'Iron Pistol', 'Pistolet en or': 'Gold Pistol', 'Pistolet lance-bombes': 'Bomb Launcher', 'Fusil automatique': 'Automatic Rifle', 'Fusil à baïonnette': 'Bayonet Rifle',
  'Voiture de course rouge': 'Red Race Car', 'Voiture bleue avec cabine': 'Blue Car with Cabin', 'Avion de passagers': 'Passenger Airplane', 'Train de passagers': 'Passenger Train',
  'Train de métro': 'Metro Train', 'Bateau à deux places': 'Two-Seat Boat', 'Jeep militaire': 'Military Jeep', 'Voiture de police': 'Police Car',
  'Camion de pompier avec sirène': 'Fire Truck with Siren', 'Calèche avec chevaux': 'Horse Carriage', 'Canon à roues': 'Wheeled Cannon', 'Selle pour cheval': 'Horse Saddle',
  Extincteur: 'Fire Extinguisher', Parachute: 'Parachute', 'Poison à lancer pour animaux': 'Throwable Animal Poison', 'Poison pour animaux': 'Animal Poison',
  Herbe: 'Grass', Terre: 'Dirt', Pierre: 'Stone', Sable: 'Sand', Bois: 'Wood', Feuilles: 'Leaves', 'Aiguilles de sapin': 'Pine Needles', Neige: 'Snow', Cactus: 'Cactus',
  'Feuilles d’automne': 'Autumn Leaves', 'Herbe dorée': 'Golden Grass', 'Herbe forestière': 'Forest Grass', 'Herbe de jungle': 'Jungle Grass', 'Feuilles tropicales': 'Tropical Leaves', 'Liane de jungle': 'Jungle Vine',
  Charbon: 'Coal', Fer: 'Iron', Or: 'Gold', Diamant: 'Diamond', Glace: 'Ice', 'Bombe TNT': 'TNT Bomb', Bougie: 'Candle', 'Eau innondation': 'Flooding Water',
  'Eau calme (sans inondation)': 'Calm Water (No Flooding)', Nourriture: 'Food', 'Brique beige': 'Beige Brick', 'Brique blanche': 'White Brick', 'Brique grise': 'Gray Brick', Verre: 'Glass',
  'Béton blanc': 'White Concrete', 'Béton orange': 'Orange Concrete', 'Béton magenta': 'Magenta Concrete', 'Béton bleu clair': 'Light Blue Concrete', 'Béton jaune': 'Yellow Concrete',
  'Béton lime': 'Lime Concrete', 'Béton rose': 'Pink Concrete', 'Béton gris': 'Gray Concrete', 'Béton gris clair': 'Light Gray Concrete', 'Béton cyan': 'Cyan Concrete',
  'Béton violet': 'Purple Concrete', 'Béton bleu': 'Blue Concrete', 'Béton marron': 'Brown Concrete', 'Béton vert': 'Green Concrete', 'Béton rouge': 'Red Concrete', 'Béton noir': 'Black Concrete',
  'Pousse de chêne': 'Oak Sapling', 'Pousse de sapin': 'Pine Sapling', 'Pousse d’arbre d’automne': 'Autumn Tree Sapling', 'Planches de chêne': 'Oak Planks',
  'Planches de sapin': 'Pine Planks', 'Planches d’arbre d’automne': 'Autumn Wood Planks', 'Graines de maïs': 'Corn Seeds', 'Graines de blé': 'Wheat Seeds',
  'Graines de tomate': 'Tomato Seeds', 'Graines de carotte': 'Carrot Seeds', 'Graines de pastèque': 'Watermelon Seeds', Four: 'Furnace', Coffre: 'Chest', Échelle: 'Ladder',
  'Feu de camp': 'Campfire', 'Feu rouge destructeur': 'Destructive Red Fire', 'Rail de train': 'Train Rail', 'Panneau à écrire': 'Writable Sign', 'Feu rouge de circulation': 'Traffic Light',
  'Lampadaire moderne': 'Modern Street Lamp', 'Lampadaire parisien': 'Parisian Street Lamp', 'Panneau STOP': 'Stop Sign', 'Cédez le passage': 'Yield', 'Sens interdit': 'No Entry',
  'Sens unique': 'One Way', 'Limitation 50': 'Speed Limit 50', 'Passage piéton': 'Pedestrian Crossing', École: 'School', Parking: 'Parking', 'Direction tout droit': 'Straight Ahead',
  Danger: 'Danger', Giratoire: 'Roundabout', 'Route prioritaire': 'Priority Road', 'Plaque de rue parisienne': 'Parisian Street Sign',
};

const colors: Record<string, string> = {
  blanche: 'White', blanc: 'White', orange: 'Orange', magenta: 'Magenta', 'bleu clair': 'Light Blue', jaune: 'Yellow', lime: 'Lime', rose: 'Pink', grise: 'Gray', gris: 'Gray',
  'gris clair': 'Light Gray', cyan: 'Cyan', violette: 'Purple', violet: 'Purple', bleue: 'Blue', bleu: 'Blue', marron: 'Brown', verte: 'Green', vert: 'Green', rouge: 'Red', noire: 'Black', noir: 'Black', 'bleu roi': 'Royal Blue',
};
const stairMaterials: Record<string, string> = {
  chêne: 'Oak', sapin: 'Pine', 'bois d’automne': 'Autumn Wood', pierre: 'Stone', sable: 'Sand', 'brique beige': 'Beige Brick', 'brique blanche': 'White Brick', 'brique grise': 'Gray Brick',
  bûche: 'Log', terre: 'Dirt', herbe: 'Grass', neige: 'Snow', glace: 'Ice', charbon: 'Coal', fer: 'Iron', or: 'Gold', diamant: 'Diamond', bedrock: 'Bedrock',
};

export function englishItemName(name: string) {
  const direct = names[name];
  if (direct) return direct;
  if (name.startsWith('Porte ')) return `${colors[name.slice(6)] ?? name.slice(6)} Door`;
  if (name.startsWith('Trappe ')) return `${colors[name.slice(7)] ?? name.slice(7)} Trapdoor`;
  if (name.startsWith('Lit ')) return `${colors[name.slice(4)] ?? name.slice(4)} Bed`;
  if (name.startsWith('Verre ') && name.endsWith(' à motif')) return `${colors[name.slice(6, -8)] ?? name.slice(6, -8)} Patterned Glass`;
  if (name.startsWith('Escalier en béton ')) return `${colors[name.slice(18)] ?? name.slice(18)} Concrete Stairs`;
  if (name.startsWith('Escalier en ')) return `${stairMaterials[name.slice(12)] ?? name.slice(12)} Stairs`;
  return name;
}

export function localizedItemName(name: string) {
  return useLanguageStore.getState().language === 'fr' ? name : englishItemName(name);
}
