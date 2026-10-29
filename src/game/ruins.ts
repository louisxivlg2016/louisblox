import { BlockKind } from './voxel';
import { heightAt, SEA_LEVEL } from './levels';

export type RuinType = 'church' | 'palace' | 'fort';
export type RuinSite = { type: RuinType; x: number; z: number; baseY: number; seed: number };
type Put = (x: number, y: number, z: number, kind: BlockKind, overwrite?: boolean) => void;
type Remove = (x: number, y: number, z: number) => void;

const layouts = {
  church: { width: 15, depth: 25, height: 16, ox: 256, oz: 256 },
  palace: { width: 25, depth: 23, height: 10, ox: 640, oz: 384 },
  fort: { width: 29, depth: 29, height: 11, ox: 384, oz: 768 },
} as const;

function hash(x: number, y: number, z: number, seed: number) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1442695041) + seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function siteFor(type: RuinType, cx: number, cz: number, seed: number): RuinSite {
  const layout = layouts[type];
  const x = cx * 1024 + layout.ox + Math.floor(hash(cx, cz, type.length, seed) * 49) - 24;
  const z = cz * 1024 + layout.oz + Math.floor(hash(cx, cz, type.length + 31, seed) * 49) - 24;
  const hx = Math.floor(layout.width / 2);
  const hz = Math.floor(layout.depth / 2);
  const baseY = Math.max(SEA_LEVEL + 1, ...[
    [x - hx, z - hz], [x + hx, z - hz], [x - hx, z + hz], [x + hx, z + hz], [x, z],
  ].map(([px, pz]) => heightAt(px, pz, seed)));
  return { type, x, z, baseY, seed };
}

export function nearestRuin(x: number, z: number, seed: number) {
  const cx = Math.floor(x / 1024);
  const cz = Math.floor(z / 1024);
  let nearest: (RuinSite & { distance: number }) | null = null;
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      for (const type of Object.keys(layouts) as RuinType[]) {
        const site = siteFor(type, cx + dx, cz + dz, seed);
        const distance = Math.hypot(site.x - x, site.z - z);
        if (!nearest || distance < nearest.distance) nearest = { ...site, distance };
      }
    }
  }
  return nearest!;
}

function foundation(site: RuinSite, put: Put, remove: Remove, kind: BlockKind) {
  const { width, depth } = layouts[site.type];
  const hx = Math.floor(width / 2);
  const hz = Math.floor(depth / 2);
  for (let x = site.x - hx; x <= site.x + hx; x += 1) {
    for (let z = site.z - hz; z <= site.z + hz; z += 1) {
      const ground = heightAt(x, z, site.seed);
      for (let y = ground + 1; y <= site.baseY + layouts[site.type].height + 2; y += 1) remove(x, y, z);
      for (let y = ground + 1; y < site.baseY; y += 1) put(x, y, z, BlockKind.Stone);
      put(x, site.baseY, z, kind);
    }
  }
}

function wallBlock(x: number, y: number, z: number, height: number, kind: BlockKind, site: RuinSite, put: Put) {
  const damage = hash(x, y, z, site.seed);
  if (y > 2 && damage > 0.965) return;
  if (y > height - 2 && damage < 0.22) return;
  put(x, y, z, kind);
}

function tower(cx: number, cz: number, size: number, height: number, kind: BlockKind, site: RuinSite, put: Put) {
  const half = Math.floor(size / 2);
  for (let x = cx - half; x <= cx + half; x += 1) {
    for (let z = cz - half; z <= cz + half; z += 1) {
      if (x !== cx - half && x !== cx + half && z !== cz - half && z !== cz + half) continue;
      for (let y = 1; y <= height; y += 1) {
        if (x === cx && z === cz - half && y <= 3) continue;
        wallBlock(x, site.baseY + y, z, height, kind, site, put);
      }
      if ((x + z) % 2 === 0 && hash(x, height, z, site.seed) > 0.18) put(x, site.baseY + height + 1, z, kind);
    }
  }
}

function column(x: number, z: number, height: number, site: RuinSite, put: Put) {
  put(x, site.baseY + 1, z, BlockKind.GrayBrick);
  for (let y = 2; y <= height; y += 1) put(x, site.baseY + y, z, BlockKind.WhiteBrick);
  put(x, site.baseY + height + 1, z, BlockKind.BeigeBrick);
}

function vines(site: RuinSite, put: Put) {
  const { width, depth } = layouts[site.type];
  const hx = Math.floor(width / 2);
  const hz = Math.floor(depth / 2);
  for (let y = 1; y <= 4; y += 1) {
    for (let x = site.x - hx; x <= site.x + hx; x += 1) {
      if (hash(x, y, site.z, site.seed + 91) > 0.88) {
        put(x, site.baseY + y, site.z - hz - 1, BlockKind.Leaves, false);
        put(x, site.baseY + y, site.z + hz + 1, BlockKind.Leaves, false);
      }
    }
    for (let z = site.z - hz; z <= site.z + hz; z += 1) {
      if (hash(site.x, y, z, site.seed + 93) > 0.9) {
        put(site.x - hx - 1, site.baseY + y, z, BlockKind.Leaves, false);
        put(site.x + hx + 1, site.baseY + y, z, BlockKind.Leaves, false);
      }
    }
  }
}

function rubble(site: RuinSite, put: Put) {
  const { width, depth } = layouts[site.type];
  for (let x = site.x - Math.floor(width / 2) + 1; x < site.x + Math.floor(width / 2); x += 1) {
    for (let z = site.z - Math.floor(depth / 2) + 1; z < site.z + Math.floor(depth / 2); z += 1) {
      if (hash(x, site.baseY, z, site.seed + 19) > 0.965) put(x, site.baseY + 1, z, BlockKind.Stone, false);
    }
  }
}

function buildChurch(site: RuinSite, put: Put, remove: Remove) {
  foundation(site, put, remove, BlockKind.GrayBrick);
  for (let dx = -7; dx <= 7; dx += 1) {
    for (let dz = -12; dz <= 12; dz += 1) {
      if (Math.abs(dx) !== 7 && Math.abs(dz) !== 12) continue;
      for (let y = 1; y <= 6; y += 1) {
        if (dz === -12 && ((Math.abs(dx) <= 1 && y <= 3) || (dx === 0 && y === 4))) continue;
        if (Math.abs(dx) === 7 && ((dz + 12) % 6 === 3 && y >= 3 && y <= 4 || (dz + 12) % 6 === 4 && y === 5)) continue;
        wallBlock(site.x + dx, site.baseY + y, site.z + dz, 6, BlockKind.GrayBrick, site, put);
      }
    }
  }
  tower(site.x - 5, site.z - 10, 5, 14, BlockKind.GrayBrick, site, put);
  for (const z of [-5, -1, 3, 7]) {
    for (const x of [-3, 3]) {
      if (hash(x, site.baseY, z, site.seed) > 0.18) put(site.x + x, site.baseY + 1, site.z + z, BlockKind.OakPlanks);
    }
  }
  for (let y = 2; y <= 6; y += 1) put(site.x, site.baseY + y, site.z + 9, BlockKind.WhiteBrick);
  for (let x = -1; x <= 1; x += 1) put(site.x + x, site.baseY + 5, site.z + 9, BlockKind.WhiteBrick);
  for (let dx = -7; dx <= 7; dx += 1) {
    const roofY = site.baseY + 7 + Math.floor((7 - Math.abs(dx)) / 2);
    for (let dz = 5; dz <= 12; dz += 1) {
      if (hash(dx, roofY, dz, site.seed) > 0.12) put(site.x + dx, roofY, site.z + dz, BlockKind.GrayBrick);
    }
  }
  vines(site, put);
  rubble(site, put);
}

function buildPalace(site: RuinSite, put: Put, remove: Remove) {
  foundation(site, put, remove, BlockKind.WhiteBrick);
  for (let dx = -12; dx <= 12; dx += 1) {
    for (let dz = -11; dz <= 11; dz += 1) {
      if (Math.abs(dx) !== 12 && Math.abs(dz) !== 11) continue;
      for (let y = 1; y <= 6; y += 1) {
        if (dz === -11 && ((Math.abs(dx) <= 1 && y <= 3) || (dx === 0 && y === 4))) continue;
        wallBlock(site.x + dx, site.baseY + y, site.z + dz, 6, BlockKind.BeigeBrick, site, put);
      }
    }
  }
  for (const x of [-10, 10]) for (const z of [-9, 9]) tower(site.x + x, site.z + z, 5, 9, BlockKind.GrayBrick, site, put);
  for (const x of [-5, 5]) for (const z of [-6, -1, 4]) column(site.x + x, site.z + z, 3 + Math.floor(hash(x, 0, z, site.seed) * 4), site, put);
  for (let z = -9; z <= 7; z += 1) {
    for (let x = -1; x <= 1; x += 1) {
      if (hash(x, site.baseY, z, site.seed) > 0.08) put(site.x + x, site.baseY, site.z + z, BlockKind.ConcreteRed);
    }
  }
  for (let x = -2; x <= 2; x += 1) for (let z = 7; z <= 9; z += 1) put(site.x + x, site.baseY + 1, site.z + z, BlockKind.WhiteBrick);
  put(site.x, site.baseY + 2, site.z + 8, BlockKind.ConcreteRed);
  put(site.x, site.baseY + 3, site.z + 9, BlockKind.WhiteBrick);
  for (const x of [-1, 1]) put(site.x + x, site.baseY + 2, site.z + 8, BlockKind.ConcreteYellow);
  for (let x = 7; x <= 11; x += 1) for (let z = 5; z <= 9; z += 1) {
    if (hash(x, site.baseY, z, site.seed) > 0.25) put(site.x + x, site.baseY + 8, site.z + z, BlockKind.BeigeBrick);
  }
  vines(site, put);
  rubble(site, put);
}

function buildFort(site: RuinSite, put: Put, remove: Remove) {
  foundation(site, put, remove, BlockKind.Stone);
  for (let dx = -14; dx <= 14; dx += 1) {
    for (let dz = -14; dz <= 14; dz += 1) {
      if (Math.abs(dx) !== 14 && Math.abs(dz) !== 14) continue;
      for (let y = 1; y <= 6; y += 1) {
        if (dz === -14 && ((Math.abs(dx) <= 1 && y <= 3) || (dx === 0 && y === 4))) continue;
        wallBlock(site.x + dx, site.baseY + y, site.z + dz, 6, BlockKind.GrayBrick, site, put);
      }
      if ((dx + dz) % 2 === 0 && hash(dx, 7, dz, site.seed) > 0.18) put(site.x + dx, site.baseY + 7, site.z + dz, BlockKind.GrayBrick);
    }
  }
  for (const x of [-12, 12]) for (const z of [-12, 12]) tower(site.x + x, site.z + z, 5, 10, BlockKind.GrayBrick, site, put);
  for (let dx = -4; dx <= 4; dx += 1) {
    for (let dz = -4; dz <= 4; dz += 1) {
      if (Math.abs(dx) !== 4 && Math.abs(dz) !== 4) continue;
      for (let y = 1; y <= 7; y += 1) wallBlock(site.x + dx, site.baseY + y, site.z + dz, 7, BlockKind.Stone, site, put);
    }
  }
  vines(site, put);
  rubble(site, put);
}

export function generateRuinsForChunk(cx: number, cz: number, seed: number, put: Put, remove: Remove) {
  const cellX = Math.floor(cx * 16 / 1024);
  const cellZ = Math.floor(cz * 16 / 1024);
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      for (const type of Object.keys(layouts) as RuinType[]) {
        const site = siteFor(type, cellX + dx, cellZ + dz, seed);
        const { width, depth } = layouts[type];
        if (site.x + width / 2 < cx * 16 || site.x - width / 2 >= (cx + 1) * 16 || site.z + depth / 2 < cz * 16 || site.z - depth / 2 >= (cz + 1) * 16) continue;
        if (type === 'church') buildChurch(site, put, remove);
        else if (type === 'palace') buildPalace(site, put, remove);
        else buildFort(site, put, remove);
      }
    }
  }
}
