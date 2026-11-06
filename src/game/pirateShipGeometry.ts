import { BlockKind } from './voxel';
import type { Voxel } from './voxel';
import { useGameStore } from './store';

export function isOldPirateRigging(block: Voxel) {
  if (useGameStore.getState().gameplayMode !== 'pirates') return false;
  for (const center of [-16, 16]) {
    if (block.x !== center) continue;
    if (block.kind === BlockKind.Wood && block.z === 0 && block.y >= 9 && block.y <= 15) return true;
    if (block.y >= 10 && block.y <= 14 && Math.abs(block.z) <= 4 && (block.kind === BlockKind.ConcreteBlack || block.kind === BlockKind.ConcreteWhite || block.kind === BlockKind.ConcreteRed || block.kind === BlockKind.ConcreteBlue)) return true;
  }
  return false;
}

export function isOldPirateShipBlock(block: Voxel) {
  if (useGameStore.getState().gameplayMode !== 'pirates') return false;
  if (isOldPirateRigging(block)) return true;
  for (const center of [-16, 16]) {
    const width = block.y === 5 ? 2 : block.y === 6 ? 4 : block.y === 7 || block.y === 8 ? 5 : -1;
    if (width >= 0 && Math.abs(block.x - center) <= width && Math.abs(block.z) <= 7 && (block.kind === BlockKind.Wood || block.kind === BlockKind.OakPlanks)) return true;
  }
  return false;
}
