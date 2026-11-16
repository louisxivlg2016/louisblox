import { CHUNK_SIZE } from './levels';
import type { GeneratedChunk } from './levels';
import { BlockKind } from './voxel';
import type { Voxel } from './voxel';
import type { SelectedKind } from './items';
import type { BattleTeam } from './battleArena';
import { addPirateShip, PIRATE_CHEST_OFFSETS } from './pirateShipGeometry';
import { translate } from './language';

export { PIRATE_CHEST_OFFSETS } from './pirateShipGeometry';

export type PirateKit = 'defender' | 'gunner' | 'raider';
export const PIRATE_WATER_Y = 4.5;
export const PIRATE_OBJECTIVES = { red: { x: -16, y: 7, z: 0 }, blue: { x: 16, y: 7, z: 0 } } as const;

export const PIRATE_KITS = (): Record<PirateKit, { name: string; description: string; hotbar: SelectedKind[] }> => ({
  defender: { name: translate('Défenseur', 'Defender'), description: translate('Épée, murs et nourriture pour protéger le trésor.', 'Sword, walls, and food to protect the treasure.'), hotbar: ['pistol_bomb', BlockKind.Tnt, BlockKind.OakPlanks, 'pickaxe_diamond'] },
  gunner: { name: translate('Artilleur', 'Gunner'), description: translate('Canons, fusil et arc pour bombarder les autres navires.', 'Cannons, rifle, and bow to bombard other ships.'), hotbar: ['pistol_bomb', 'rifle_auto', 'bow', BlockKind.Tnt, 'cannon', BlockKind.OakPlanks, 'cooked_meat', 'sword_iron', BlockKind.Stone, 'apple'] },
  raider: { name: translate('Abordeur', 'Raider'), description: translate('Pioche, épée et TNT pour construire et attaquer la cale.', 'Pickaxe, sword, and TNT to build and attack the hold.'), hotbar: ['sword_diamond', 'pickaxe_diamond', BlockKind.Tnt, BlockKind.OakPlanks, 'pistol_bomb', 'bow', 'cooked_meat', BlockKind.Stone, BlockKind.OakPlanks, 'apple'] },
});

export const PIRATE_LOADOUT: SelectedKind[] = ['pistol_bomb', BlockKind.Tnt, BlockKind.OakPlanks, 'pickaxe_diamond'];

export const PIRATE_SHOP = () => [
  { item: 'sword_diamond', name: translate('Épée en diamant', 'Diamond Sword'), cost: 12 },
  { item: 'bow', name: 'Arc', cost: 6 },
  { item: 'pistol_bomb', name: translate('Pistolet lance-bombes', 'Bomb Launcher'), cost: 10 },
  { item: 'Tnt', name: 'TNT', cost: 5 },
  { item: 'OakPlanks', name: translate('Planches de chêne', 'Oak Planks'), cost: 3 },
  { item: 'apple', name: translate('Pomme', 'Apple'), cost: 2 },
  { item: 'parachute', name: 'Parachute', cost: 20 },
  { item: 'mystery', name: translate('Kit mystère', 'Mystery Kit'), cost: 500 },
];

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
    return PIRATE_CHEST_OFFSETS.some(([dx, dy, dz]) => objective.x + dx === x && objective.y + dy === y && objective.z + dz === z);
  });
}

export function teamObjective(team: BattleTeam | null) {
  return team === 'red' ? 'blue' : 'red';
}
