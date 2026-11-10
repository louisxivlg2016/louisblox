import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';
import type { SelectedKind } from './items';
import type { BattleTeam } from './battleArena';
import { addPirateShip } from './pirateShipGeometry';

export type PirateKit = 'defender' | 'gunner' | 'raider';
export const PIRATE_WATER_Y = 4.5;
export const PIRATE_OBJECTIVES = { red: { x: -16, y: 7, z: 0 }, blue: { x: 16, y: 7, z: 0 } } as const;

export const PIRATE_KITS: Record<PirateKit, { name: string; description: string; hotbar: SelectedKind[] }> = {
  defender: { name: 'Défenseur', description: 'Épée, murs et nourriture pour protéger le trésor.', hotbar: ['sword_iron', 'pistol_iron', BlockKind.OakPlanks, BlockKind.Stone, BlockKind.OakPlanks, 'cooked_meat', 'bow', 'pistol_bomb', BlockKind.Tnt, 'apple'] },
  gunner: { name: 'Artilleur', description: 'Canons, fusil et arc pour bombarder les autres navires.', hotbar: ['pistol_bomb', 'rifle_auto', 'bow', BlockKind.Tnt, 'cannon', BlockKind.OakPlanks, 'cooked_meat', 'sword_iron', BlockKind.Stone, 'apple'] },
  raider: { name: 'Abordeur', description: 'Pioche, épée et TNT pour construire et attaquer la cale.', hotbar: ['sword_diamond', 'pickaxe_diamond', BlockKind.Tnt, BlockKind.OakPlanks, 'pistol_bomb', 'bow', 'cooked_meat', BlockKind.Stone, BlockKind.OakPlanks, 'apple'] },
};

export const PIRATE_LOADOUT: SelectedKind[] = ['sword_diamond', 'pistol_bomb', 'rifle_auto', 'bow', 'cannon', 'pickaxe_diamond', 'pistol_iron', BlockKind.OakPlanks, 'cooked_meat', BlockKind.Tnt];

export const PIRATE_SHOP = [
  { item: 'sword_diamond', name: 'Épée en diamant', cost: 12 },
  { item: 'bow', name: 'Arc', cost: 6 },
  { item: 'pistol_bomb', name: 'Pistolet lance-bombes', cost: 10 },
  { item: 'Tnt', name: 'TNT', cost: 5 },
  { item: 'OakPlanks', name: 'Planches de chêne', cost: 3 },
  { item: 'apple', name: 'Pomme', cost: 2 },
] as const;

export function pirateSpawn(team: 'red' | 'blue') {
  return { x: team === 'red' ? -18 : 18, y: 9.51, z: 3 };
}

export function generatePirateChunk(cx: number, cz: number): GeneratedChunk {
  const blocks: Voxel[] = [];
  for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) {
    for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
      if (Math.abs(x) > 48 || Math.abs(z) > 48) continue;
      blocks.push({ x, y: 2, z, kind: BlockKind.Sand });
      blocks.push({ x, y: 4, z, kind: BlockKind.Water });
    }
  }
  if (Math.abs(cx * CHUNK_SIZE + 8 + 16) <= 16 || Math.abs(cx * CHUNK_SIZE + 8 - 16) <= 16) {
    if (cx * CHUNK_SIZE <= -16 + 7 && cx * CHUNK_SIZE + CHUNK_SIZE - 1 >= -16 - 7) addPirateShip(blocks, -16, 'red');
    if (cx * CHUNK_SIZE <= 16 + 7 && cx * CHUNK_SIZE + CHUNK_SIZE - 1 >= 16 - 7) addPirateShip(blocks, 16, 'blue');
  }
  return { blocks, water: [] };
}

export function isPirateObjective(x: number, y: number, z: number) {
  return (Object.keys(PIRATE_OBJECTIVES) as Array<'red' | 'blue'>).find((team) => {
    const objective = PIRATE_OBJECTIVES[team];
    return objective.x === x && (objective.y === y || objective.y + 1 === y) && objective.z === z;
  });
}

export function teamObjective(team: BattleTeam | null) {
  return team === 'red' ? 'blue' : 'red';
}
