import { mkdir } from 'node:fs/promises';

const source = 'https://bloxd-io.fandom.com/api.php?action=parse&page=Items/Gallery&prop=wikitext&format=json';
const response = await fetch(source);
if (!response.ok) throw new Error(`Gallery HTTP ${response.status}`);
const data = await response.json();
const text = data.parse.wikitext['*'];
await mkdir('.tmp', { recursive: true });
await Bun.write('.tmp/items-gallery.wikitext', text);

const categorySlugs = {
  'Tools & Weapons': 'tools_weapons',
  'Fishing Rods': 'fishing_rods',
  'Plants': 'plants',
  'Minerals': 'minerals',
  'Foods & Consumables': 'foods',
  'Mob Drops': 'mob_drops',
  'Anomaly Drops (Containment Breach)': 'anomaly_drops',
  'Bottles and Potions': 'potions',
  'Fishes': 'fishes',
  'Armour': 'armour',
  'Firecrackers & Firecracker Pebbles': 'firecrackers',
  'Beds, Pods & Banners': 'beds_pods_banners',
  'Directional Arrows': 'directional_arrows',
  'Mob Spawn Orbs': 'mob_spawn_orbs',
  'Mob Spawners': 'mob_spawners',
  'Pet Catchers containing mobs': 'pet_catchers',
  'RPGs and Explosives': 'guns_explosives',
  'Projectiles': 'projectiles',
  'Bedwars Lucky Items': 'bedwars_lucky',
  'Paintball Items': 'paintball',
  'Vehicles': 'vehicles',
};

const explicitColors = {
  red: '#c93d35', orange: '#df8730', yellow: '#dfc33c', lime: '#71ad3f', green: '#478c42',
  cyan: '#43a9b3', 'light blue': '#65a8d8', blue: '#4567b5', pink: '#db87a7', magenta: '#b454af',
  purple: '#7850a7', brown: '#795238', white: '#e4e7df', 'light gray': '#a7b0b4', gray: '#666d75', black: '#2b3038',
  rainbow: '#b578d5',
};

function slug(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function categoryHeading(line) {
  const match = line.match(/^=+\s*(.*?)\s*=+$/);
  if (!match) return null;
  const label = match[1].replaceAll(/\[\[|\]\]/g, '').split('|').at(-1).trim();
  return categorySlugs[label] ? label : null;
}

function caption(line) {
  const value = line.slice(line.indexOf('|') + 1).trim();
  return value.replaceAll(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => label ?? target);
}

function colorFor(name, category) {
  const lower = name.toLowerCase();
  for (const [word, color] of Object.entries(explicitColors)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) return color;
  }
  if (lower.includes('moonstone')) return '#9c83dc';
  if (lower.includes('diamond')) return '#54cdd4';
  if (lower.includes('gold')) return '#e5bd3c';
  if (lower.includes('iron')) return '#d4dce0';
  if (lower.includes('stone')) return '#90989d';
  if (lower.includes('wood')) return '#a97d49';
  if (lower.includes('golem')) return '#849198';
  if (lower.includes('artisan')) return '#d38f48';
  if (lower.includes('netherite')) return '#3f4650';
  if (category === 'Fishes') return `hsl(${Math.floor((slug(name).length * 47) % 360)}, 55%, 58%)`;
  if (category === 'Plants') return '#5e9949';
  if (category === 'Minerals') return '#b6c1c7';
  if (category === 'Bottles and Potions') return '#ae6ac0';
  if (category === 'Armour') return '#b6c3cf';
  return '#96a6ac';
}

function shapeFor(name, category) {
  const value = name.toLowerCase();
  if (category === 'Fishing Rods') return 'fishing_rod';
  if (category === 'Fishes') return 'fish';
  if (category === 'Armour') return 'armor';
  if (category === 'Mob Spawn Orbs') return 'spawn_orb';
  if (category === 'Mob Spawners') return 'spawner';
  if (category === 'Pet Catchers containing mobs') return 'catcher';
  if (category === 'Vehicles') return value.includes('boat') ? 'boat' : value.includes('hovercraft') ? 'hovercraft' : 'car';
  if (category === 'Directional Arrows') return 'arrow_sign';
  if (category === 'Firecrackers & Firecracker Pebbles') return value.includes('pebble') ? 'pebble' : 'firecracker';
  if (category === 'Beds, Pods & Banners') return value.includes('pod') ? 'pod' : value.includes('banner') ? 'banner' : 'bed';
  if (category === 'Bottles and Potions') return value.startsWith('arrow of') ? 'arrow_potion' : value.includes('splash') ? 'splash_potion' : 'potion';
  if (category === 'Projectiles') return value.includes('arrow') ? 'arrow' : value.includes('bomb') || value.includes('grenade') || value.includes('explosive') ? 'bomb' : 'ball';
  if (category === 'Paintball Items') return value.includes('bow') ? 'bow' : value.includes('gun') ? 'gun' : 'bomb';
  if (category === 'RPGs and Explosives') return value.includes('ammo') ? 'ammo' : value.includes('rpg') ? 'rpg' : 'gun';
  if (category === 'Bedwars Lucky Items') return value.includes('balloon') ? 'balloon' : value.includes('tower') ? 'tower' : value.includes('bridge') ? 'ice_bridge' : 'food';
  if (category === 'Plants') {
    if (value.includes('mushroom')) return 'mushroom';
    if (value.includes('seed') || value.includes('pine cone')) return 'seed';
    if (value.includes('sapling') || value.includes('grass') || value.includes('coffee')) return 'plant';
    return 'flower';
  }
  if (category === 'Minerals') return value.includes('bar') ? 'bar' : value.includes('fragment') ? 'fragment' : 'gem';
  if (category === 'Tools & Weapons') {
    if (value.includes('pickaxe')) return 'pickaxe';
    if (value.includes('axe')) return 'axe';
    if (value.includes('spade')) return 'spade';
    if (value.includes('crossbow')) return 'crossbow';
    if (value.includes('bow')) return 'bow';
    if (value.includes('sword')) return 'sword';
    if (value.includes('hoe')) return 'hoe';
    if (value.includes('shears')) return 'shears';
    if (value.includes('compass')) return 'compass';
    if (value.includes('clock')) return 'clock';
    if (value.includes('map')) return 'map';
    if (value.includes('book')) return 'book';
    if (value.includes('bone meal')) return 'bone_meal';
    if (value.includes('updraft')) return 'updraft';
    if (value.includes('snowdash')) return 'snowdash';
    if (value.includes('spear')) return 'spear';
    if (value.includes('dagger')) return 'dagger';
    if (value.includes('club')) return 'club';
    if (value.includes('mace')) return 'mace';
    if (value.includes('whip')) return 'whip';
    if (value.includes('boomerang')) return 'boomerang';
    if (value.includes('hang glider')) return 'hang_glider';
    return 'stick';
  }
  if (category === 'Foods & Consumables') {
    if (value.includes('bowl') || value.includes('soup') || value.includes('stew')) return 'bowl';
    if (value.includes('milk')) return 'milk';
    if (value.includes('cheese')) return 'cheese';
    if (value.includes('fish')) return 'fish';
    if (value.includes('beef') || value.includes('pork') || value.includes('mutton') || value.includes('venison') || value.includes('steak') || value.includes('chicken')) return 'meat';
    return 'food';
  }
  return 'resource';
}

const categories = [];
const items = [];
const usedIds = new Set();
let currentCategory = '';
for (const line of text.split('\n')) {
  const heading = categoryHeading(line.trim());
  if (heading) {
    currentCategory = heading;
    categories.push(heading);
    continue;
  }
  if (!/^File:/i.test(line.trim()) || !currentCategory) continue;
  const name = caption(line);
  const categorySlug = categorySlugs[currentCategory];
  let id = `gallery_${categorySlug}_${slug(name)}`;
  let suffix = 2;
  while (usedIds.has(id)) id = `gallery_${categorySlug}_${slug(name)}_${suffix++}`;
  usedIds.add(id);
  items.push({ id, category: currentCategory, name, color: colorFor(name, currentCategory), shape: shapeFor(name, currentCategory) });
}

if (items.length !== 911) throw new Error(`Expected 911 gallery entries, got ${items.length}`);
const output = `// Generated from the public Bloxd.io Items/Gallery API by scripts/import-bloxd-gallery.mjs.\nexport type GalleryItem = { id: string; category: string; name: string; color: string; shape: string };\nexport type GalleryItemId = \`gallery_\${string}\`;\n\nexport const GALLERY_CATEGORIES = ${JSON.stringify(categories)} as const;\nexport const GALLERY_ITEMS = ${JSON.stringify(items, null, 2)} as const satisfies readonly GalleryItem[];\nexport const GALLERY_ITEM_MAP = Object.fromEntries(GALLERY_ITEMS.map((item) => [item.id, item])) as Record<string, GalleryItem>;\nexport const isGalleryItem = (value: unknown): value is GalleryItemId => typeof value === 'string' && value in GALLERY_ITEM_MAP;\n`;
await Bun.write('src/game/galleryCatalog.ts', output);
console.log(`Imported ${items.length} items across ${categories.length} categories`);
for (const category of categories) console.log(`${category}: ${items.filter((item) => item.category === category).length}`);
