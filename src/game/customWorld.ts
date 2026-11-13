import { CHUNK_SIZE, generateChunk, safeSpawnAt } from './levels';
import type { GeneratedChunk } from './levels';
import { isChest, isCrop, isDoor, isLadder, isRail, isSign, isTrafficSign, isTrapdoor, isBed, PARIS_STREET_SIGN_TEXT } from './extraBlocks';
import { BlockKind, isWaterBlock, voxelKey } from './voxel';
import type { Voxel } from './voxel';
import type { CustomWorldDefinition } from './worldCode';

const coordinate = (value: number) => Math.floor((value + 0.5) / CHUNK_SIZE);

export function customBlock(block: Voxel): Voxel {
  const result = { ...block };
  if (isCrop(result.kind)) result.growth = 3;
  if (isChest(result.kind)) result.items = [];
  if (result.kind === BlockKind.Food) result.food = 'bread';
  if (isSign(result.kind)) result.text = result.kind === BlockKind.ParisStreetSign ? PARIS_STREET_SIGN_TEXT : '';
  if (isLadder(result.kind) || isDoor(result.kind) || isTrapdoor(result.kind) || isRail(result.kind) || isSign(result.kind) || isBed(result.kind) || result.kind === BlockKind.TrafficLight || isTrafficSign(result.kind)) result.facing = isBed(result.kind) ? 'south' : 'north';
  return result;
}

export function generateCustomChunk(cx: number, cz: number, seed: number, definition: CustomWorldDefinition): GeneratedChunk {
  const generated = definition.terrain === 'natural' ? generateChunk(cx, cz, seed) : { blocks: [], water: [] };
  const blocks = new Map(generated.blocks.map((block) => [voxelKey(block.x, block.y, block.z), block]));
  if (definition.terrain === 'flat') {
    for (let x = cx * CHUNK_SIZE; x < (cx + 1) * CHUNK_SIZE; x += 1) {
      for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z += 1) {
        for (let y = -4; y <= 0; y += 1) {
          const kind = y === -4 ? BlockKind.Bedrock : y === 0 ? BlockKind.Grass : y === -1 ? BlockKind.Dirt : BlockKind.Stone;
          blocks.set(voxelKey(x, y, z), { x, y, z, kind });
        }
      }
    }
  }
  for (const block of definition.blocks) {
    if (coordinate(block.x) !== cx || coordinate(block.z) !== cz) continue;
    blocks.set(voxelKey(block.x, block.y, block.z), customBlock(block));
  }
  return { blocks: [...blocks.values()], water: generated.water };
}

export function customWorldSpawn(definition: CustomWorldDefinition, seed: number) {
  const spawn = safeSpawnAt(0, 0, seed);
  const columns = new Map<string, number>();
  for (const block of definition.blocks) {
    if (Math.abs(block.x) > 4 || Math.abs(block.z) > 4 || isWaterBlock(block.kind)) continue;
    const key = `${block.x},${block.z}`;
    columns.set(key, Math.max(columns.get(key) ?? -Infinity, block.y));
  }
  let best = { x: 0, y: 1.01, z: 0, distance: Infinity };
  for (const [column, y] of columns) {
    const [x, z] = column.split(',').map(Number);
    const distance = x * x + z * z;
    if (distance < best.distance || distance === best.distance && y + 1.01 > best.y) best = { x, y: y + 1.01, z, distance };
  }
  if (definition.terrain === 'flat') return { x: best.x, y: best.y, z: best.z, onLand: true };
  const naturalTop = Math.max(0, ...definition.blocks.filter((block) => block.x === spawn.x && block.z === spawn.z).map((block) => block.y + 1));
  return { x: spawn.x, y: Math.max(spawn.y, naturalTop + 1.01), z: spawn.z, onLand: spawn.onLand };
}
