import { BlockKind } from './voxel';
import type { Voxel } from './voxel';
import { translate } from './language';

export type HistoricCapital = {
  id: 'paris' | 'london' | 'berlin' | 'rome' | 'madrid' | 'vienna' | 'amsterdam' | 'prague' | 'athens';
  name: string;
  landmark: string;
  bx: number;
  bz: number;
  wall: BlockKind;
  secondWall: BlockKind;
  window: BlockKind;
  roof: BlockKind;
  floorBonus: number;
  streets: string[];
};

export const HISTORIC_CAPITALS: HistoricCapital[] = [
  { id: 'paris', name: 'Paris', landmark: translate('Notre-Dame', 'Notre-Dame'), bx: 0, bz: -1, wall: BlockKind.BeigeBrick, secondWall: BlockKind.WhiteBrick, window: BlockKind.Glass, roof: BlockKind.ConcreteBlack, floorBonus: 0, streets: ['Rue de la Paix', 'Avenue Louis XIV', 'Boulevard Saint-Germain', 'Rue de Rivoli', 'Avenue de l’Opéra', 'Rue des Champs-Élysées'] },
  { id: 'london', name: translate('Londres', 'London'), landmark: 'Big Ben', bx: 12, bz: 0, wall: BlockKind.GrayBrick, secondWall: BlockKind.BeigeBrick, window: BlockKind.GlassBlue, roof: BlockKind.ConcreteBlack, floorBonus: 1, streets: ['Westminster Avenue', 'Victoria Street', 'Whitehall', 'Birdcage Walk', 'Parliament Square', 'Millbank'] },
  { id: 'berlin', name: 'Berlin', landmark: translate('Porte de Brandebourg', 'Brandenburg Gate'), bx: -11, bz: 0, wall: BlockKind.WhiteBrick, secondWall: BlockKind.ConcreteLightGray, window: BlockKind.GlassBlue, roof: BlockKind.ConcreteGray, floorBonus: 1, streets: ['Unter den Linden', 'Pariser Platz', 'Wilhelmstraße', 'Friedrichstraße', 'Ebertstraße', 'Behrenstraße'] },
  { id: 'rome', name: 'Rome', landmark: translate('Colisée', 'Colosseum'), bx: 0, bz: 12, wall: BlockKind.BeigeBrick, secondWall: BlockKind.ConcreteRed, window: BlockKind.GlassYellow, roof: BlockKind.ConcreteRed, floorBonus: 0, streets: ['Via dei Fori Imperiali', 'Piazza del Colosseo', 'Via Labicana', 'Via Celio Vibenna', 'Via di San Gregorio', 'Via Claudia'] },
  { id: 'madrid', name: 'Madrid', landmark: translate('Palais royal', 'Royal Palace'), bx: 0, bz: -11, wall: BlockKind.WhiteBrick, secondWall: BlockKind.BeigeBrick, window: BlockKind.GlassBlue, roof: BlockKind.ConcreteGray, floorBonus: 1, streets: ['Calle de Bailén', 'Plaza de Oriente', 'Calle Mayor', 'Carrera de San Francisco', 'Plaza de la Armería', 'Calle de Madrid'] },
  { id: 'vienna', name: translate('Vienne', 'Vienna'), landmark: translate('Château de Schönbrunn', 'Schönbrunn Palace'), bx: 12, bz: 12, wall: BlockKind.ConcreteYellow, secondWall: BlockKind.BeigeBrick, window: BlockKind.GlassBlue, roof: BlockKind.ConcreteBlack, floorBonus: 0, streets: ['Schönbrunner Allee', 'Maria-Theresien-Platz', 'Ringstraße', 'Kärntner Straße', 'Heldenplatz', 'Opernring'] },
  { id: 'amsterdam', name: 'Amsterdam', landmark: translate('Maisons des canaux', 'Canal houses'), bx: -11, bz: -11, wall: BlockKind.ConcreteRed, secondWall: BlockKind.BeigeBrick, window: BlockKind.GlassLightBlue, roof: BlockKind.ConcreteBlack, floorBonus: 1, streets: ['Herengracht', 'Keizersgracht', 'Prinsengracht', 'Singel', 'Damrak', 'Jordaan'] },
  { id: 'prague', name: 'Prague', landmark: translate('Tour du pont Charles', 'Charles Bridge Tower'), bx: -11, bz: 12, wall: BlockKind.GrayBrick, secondWall: BlockKind.BeigeBrick, window: BlockKind.GlassYellow, roof: BlockKind.ConcreteBlack, floorBonus: 0, streets: ['Karlova', 'Mostecká', 'Křižovnická', 'Celetná', 'Staroměstské náměstí', 'Nerudova'] },
  { id: 'athens', name: translate('Athènes', 'Athens'), landmark: translate('Parthénon', 'Parthenon'), bx: 12, bz: -11, wall: BlockKind.WhiteBrick, secondWall: BlockKind.BeigeBrick, window: BlockKind.GlassLightBlue, roof: BlockKind.BeigeBrick, floorBonus: -1, streets: ['Dionysiou Areopagitou', 'Acropolis Way', 'Plaka Street', 'Monastiraki Square', 'Ermou Street', 'Adrianou Street'] },
];

export function historicCapitalAt(x: number, z: number) {
  let nearest = HISTORIC_CAPITALS[0];
  let distance = Infinity;
  for (const capital of HISTORIC_CAPITALS) {
    const centerX = capital.bx * 48 + 28;
    const centerZ = capital.bz * 48 + 28;
    const next = Math.hypot(x - centerX, z - centerZ);
    if (next < distance) {
      nearest = capital;
      distance = next;
    }
  }
  return nearest;
}

export function historicCityDestinations() {
  return HISTORIC_CAPITALS.map((capital) => ({
    name: `${capital.name} · ${capital.landmark}`,
    cityId: capital.id,
    x: capital.bx * 48 + 4,
    y: 5.51,
    z: capital.bz * 48 + 4,
  }));
}

type Put = (x: number, y: number, z: number, kind: BlockKind, facing?: Voxel['facing']) => void;

function fill(put: Put, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, kind: BlockKind) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x += 1) for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y += 1) for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z += 1) put(x, y, z, kind);
}

function palace(put: Put, x: number, ground: number, z: number, wall: BlockKind, accent: BlockKind) {
  for (let dx = -11; dx <= 11; dx += 1) for (let dz = -6; dz <= 6; dz += 1) {
    if (Math.abs(dx) !== 11 && Math.abs(dz) !== 6) continue;
    for (let dy = 1; dy <= 9; dy += 1) {
      const window = dy >= 3 && dy <= 7 && dy % 3 !== 0 && (dx + dz + 30) % 3 !== 0;
      put(x + dx, ground + dy, z + dz, window ? BlockKind.GlassBlue : wall);
    }
  }
  fill(put, x - 11, ground + 10, z - 6, x + 11, ground + 10, z + 6, BlockKind.ConcreteBlack);
  for (const dx of [-8, -4, 0, 4, 8]) for (let dy = 1; dy <= 10; dy += 1) put(x + dx, ground + dy, z - 7, accent);
  fill(put, x - 3, ground + 11, z - 3, x + 3, ground + 13, z + 3, wall);
  fill(put, x - 2, ground + 14, z - 2, x + 2, ground + 14, z + 2, BlockKind.ConcreteBlack);
  put(x, ground + 15, z, BlockKind.Candle);
  put(x, ground + 1, z - 6, BlockKind.DoorWhite, 'south');
}

function london(put: Put, x: number, ground: number, z: number) {
  palace(put, x - 1, ground, z, BlockKind.BeigeBrick, BlockKind.WhiteBrick);
  const tx = x + 7;
  const tz = z - 2;
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) for (let dy = 1; dy <= 25; dy += 1) {
    const edge = Math.abs(dx) === 1 || Math.abs(dz) === 1;
    if (edge) put(tx + dx, ground + dy, tz + dz, dy % 5 === 0 ? BlockKind.WhiteBrick : BlockKind.BeigeBrick);
  }
  for (const side of [-1, 1]) {
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = 20; dy <= 22; dy += 1) put(tx + dx, ground + dy, tz + side * 2, BlockKind.ConcreteWhite);
    put(tx, ground + 21, tz + side * 2, BlockKind.ConcreteBlack);
    put(tx, ground + 22, tz + side * 2, BlockKind.ConcreteBlack);
    for (let dz = -1; dz <= 1; dz += 1) for (let dy = 20; dy <= 22; dy += 1) put(tx + side * 2, ground + dy, tz + dz, BlockKind.ConcreteWhite);
    put(tx + side * 2, ground + 21, tz, BlockKind.ConcreteBlack);
    put(tx + side * 2, ground + 22, tz, BlockKind.ConcreteBlack);
  }
  for (let tier = 0; tier < 6; tier += 1) fill(put, tx - Math.max(0, 2 - Math.floor(tier / 2)), ground + 26 + tier, tz - Math.max(0, 2 - Math.floor(tier / 2)), tx + Math.max(0, 2 - Math.floor(tier / 2)), ground + 26 + tier, tz + Math.max(0, 2 - Math.floor(tier / 2)), BlockKind.ConcreteBlack);
  put(tx, ground + 32, tz, BlockKind.Candle);
}

function berlin(put: Put, x: number, ground: number, z: number) {
  fill(put, x - 11, ground + 1, z - 5, x + 11, ground + 1, z + 5, BlockKind.GrayBrick);
  for (const dx of [-10, -6, -2, 2, 6, 10]) for (const dz of [-3, 3]) {
    fill(put, x + dx, ground + 2, z + dz, x + dx, ground + 9, z + dz, BlockKind.WhiteBrick);
    fill(put, x + dx - 1, ground + 2, z + dz, x + dx + 1, ground + 2, z + dz, BlockKind.BeigeBrick);
    fill(put, x + dx - 1, ground + 9, z + dz, x + dx + 1, ground + 9, z + dz, BlockKind.BeigeBrick);
  }
  fill(put, x - 11, ground + 10, z - 4, x + 11, ground + 12, z + 4, BlockKind.BeigeBrick);
  for (let dx = -10; dx <= 10; dx += 2) put(x + dx, ground + 13, z - 4, BlockKind.WhiteBrick);
  fill(put, x - 3, ground + 13, z - 1, x + 3, ground + 13, z + 1, BlockKind.ConcreteGreen);
  for (const dx of [-2, -1, 1, 2]) {
    put(x + dx, ground + 14, z - 1, BlockKind.ConcreteGreen);
    put(x + dx, ground + 15, z - 2, BlockKind.ConcreteGreen);
    put(x + dx, ground + 14, z + 1, BlockKind.ConcreteGreen);
  }
  fill(put, x, ground + 14, z, x, ground + 16, z, BlockKind.ConcreteGreen);
  put(x + 1, ground + 16, z, BlockKind.ConcreteGreen);
}

function rome(put: Put, x: number, ground: number, z: number) {
  for (let dx = -11; dx <= 11; dx += 1) for (let dz = -9; dz <= 9; dz += 1) {
    const outer = (dx * dx) / 121 + (dz * dz) / 81;
    const inner = (dx * dx) / 72 + (dz * dz) / 42;
    if (outer > 1 || inner < 1) continue;
    for (let dy = 1; dy <= 11; dy += 1) {
      if (dx > 5 && dz < 0 && dy > 6) continue;
      const arcade = dy % 4 !== 0 && dy < 10 && Math.abs(dx * 2 + dz * 3) % 5 !== 0;
      if (arcade) continue;
      put(x + dx, ground + dy, z + dz, dy % 4 === 0 ? BlockKind.WhiteBrick : BlockKind.BeigeBrick);
    }
  }
  for (let dx = -7; dx <= 7; dx += 1) for (let dz = -5; dz <= 5; dz += 1) if ((dx * dx) / 49 + (dz * dz) / 25 <= 1) put(x + dx, ground + 1, z + dz, BlockKind.Sand);
}

function amsterdam(put: Put, x: number, ground: number, z: number) {
  for (let house = 0; house < 5; house += 1) {
    const hx = x - 8 + house * 4;
    const height = 8 + house % 3;
    const wall = house % 2 === 0 ? BlockKind.ConcreteRed : BlockKind.BeigeBrick;
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -4; dz <= 4; dz += 1) for (let dy = 1; dy <= height; dy += 1) {
      if (Math.abs(dx) !== 1 && Math.abs(dz) !== 4) continue;
      const window = dy >= 3 && dy < height && dy % 3 !== 0 && (dz + 8) % 3 !== 0;
      put(hx + dx, ground + dy, z + dz, window ? BlockKind.GlassLightBlue : wall);
    }
    for (let tier = 0; tier < 4; tier += 1) for (let dz = -4; dz <= 4; dz += 1) put(hx, ground + height + tier, z + dz, tier === 0 ? wall : BlockKind.ConcreteBlack);
    put(hx, ground + 1, z - 4, BlockKind.DoorBrown, 'south');
  }
  fill(put, x - 11, ground + 1, z + 7, x + 11, ground + 1, z + 8, BlockKind.CalmWater);
}

function prague(put: Put, x: number, ground: number, z: number) {
  fill(put, x - 11, ground + 1, z - 3, x + 11, ground + 1, z + 3, BlockKind.GrayBrick);
  for (const side of [-1, 1]) {
    const tx = x + side * 8;
    for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) for (let dy = 2; dy <= 17; dy += 1) {
      const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      const arch = Math.abs(dx) <= 1 && dy <= 5;
      if (edge && !arch) put(tx + dx, ground + dy, z + dz, dy % 5 === 0 ? BlockKind.BeigeBrick : BlockKind.GrayBrick);
    }
    for (let tier = 0; tier < 6; tier += 1) {
      const radius = Math.max(0, 3 - Math.floor(tier / 2));
      fill(put, tx - radius, ground + 18 + tier, z - radius, tx + radius, ground + 18 + tier, z + radius, BlockKind.ConcreteBlack);
    }
    put(tx, ground + 24, z, BlockKind.Candle);
  }
  for (let dx = -6; dx <= 6; dx += 2) for (const side of [-1, 1]) fill(put, x + dx, ground + 2, z + side * 3, x + dx, ground + 3, z + side * 3, BlockKind.GrayBrick);
}

function athens(put: Put, x: number, ground: number, z: number) {
  fill(put, x - 11, ground + 1, z - 8, x + 11, ground + 2, z + 8, BlockKind.GrayBrick);
  fill(put, x - 10, ground + 3, z - 7, x + 10, ground + 3, z + 7, BlockKind.WhiteBrick);
  for (const dx of [-9, -6, -3, 0, 3, 6, 9]) for (const dz of [-5, 5]) fill(put, x + dx, ground + 4, z + dz, x + dx, ground + 11, z + dz, BlockKind.WhiteBrick);
  for (const dz of [-2, 1, 4]) for (const dx of [-9, 9]) fill(put, x + dx, ground + 4, z + dz, x + dx, ground + 11, z + dz, BlockKind.WhiteBrick);
  fill(put, x - 10, ground + 12, z - 6, x + 10, ground + 12, z + 6, BlockKind.BeigeBrick);
  for (let tier = 0; tier < 5; tier += 1) fill(put, x - 10 + tier * 2, ground + 13 + tier, z - 7, x + 10 - tier * 2, ground + 13 + tier, z + 7, tier % 2 === 0 ? BlockKind.WhiteBrick : BlockKind.BeigeBrick);
}

export function writeHistoricLandmark(put: Put, capital: HistoricCapital, centerX: number, ground: number, centerZ: number) {
  if (capital.id === 'london') london(put, centerX, ground, centerZ);
  else if (capital.id === 'berlin') berlin(put, centerX, ground, centerZ);
  else if (capital.id === 'rome') rome(put, centerX, ground, centerZ);
  else if (capital.id === 'amsterdam') amsterdam(put, centerX, ground, centerZ);
  else if (capital.id === 'prague') prague(put, centerX, ground, centerZ);
  else if (capital.id === 'athens') athens(put, centerX, ground, centerZ);
  else if (capital.id === 'madrid') palace(put, centerX, ground, centerZ, BlockKind.WhiteBrick, BlockKind.BeigeBrick);
  else if (capital.id === 'vienna') palace(put, centerX, ground, centerZ, BlockKind.ConcreteYellow, BlockKind.WhiteBrick);
}
