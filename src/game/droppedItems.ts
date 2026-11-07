import type { World } from 'koota';
import { Vector3 } from 'three';
import { world } from './world';
import { changeInventory, hasInventory, inventoryKey } from './inventory';
import { useGameStore } from './store';
import { DroppedItem, DroppedItemPosition, DroppedItemVelocity, Player, PlayerPosition, PlayerState } from './traits';
import { getBlockIndex } from './chunks';
import { isCollidable } from './systems/collisionSystem';
import { BLOCK_INFO } from './voxel';

export function dropSelectedItem() {
  const state = useGameStore.getState();
  const kind = state.selected;
  if (kind === 'hand' || !hasInventory(kind, state) || state.itemCounts[inventoryKey(kind)] <= 0 && state.gameplayMode === 'survival') {
    state.setNotice('Ta main est vide.');
    return;
  }
  const player = world.queryFirst(Player);
  const position = player?.get(PlayerPosition);
  if (!player || !position) return;
  const yaw = player.get(PlayerState)?.yaw ?? 0;
  world.spawn(
    DroppedItem({ kind, age: 0 }),
    DroppedItemPosition(new Vector3(position.x, position.y + 1.25, position.z)),
    DroppedItemVelocity(new Vector3(-Math.sin(yaw) * 3.4, 3.5, -Math.cos(yaw) * 3.4)),
  );
  changeInventory(kind, -1);
  state.setNotice(`${typeof kind === 'number' ? BLOCK_INFO[kind].name : 'Objet'} jeté. Rapproche-toi pour le ramasser.`);
}

export function dropBlock(gameWorld: World, block: { x: number; y: number; z: number; kind: import('./voxel').BlockKind }) {
  gameWorld.spawn(
    DroppedItem({ kind: block.kind, age: 0, mined: true }),
    DroppedItemPosition(new Vector3(block.x, block.y + 0.45, block.z)),
    DroppedItemVelocity(new Vector3(0, 1.8, 0)),
  );
}

export function droppedItemSystem(gameWorld: World, dt: number) {
  const player = gameWorld.queryFirst(Player)?.get(PlayerPosition);
  const blocks = getBlockIndex(gameWorld);
  gameWorld.query(DroppedItem, DroppedItemPosition, DroppedItemVelocity).updateEach(([item, position, velocity], entity) => {
    item.age += dt;
    if (item.age > 90) {
      entity.destroy();
      return;
    }
    if (player && item.age > (item.mined ? 0.18 : 0.8) && position.distanceToSquared(player) < (item.mined ? 1.1 * 1.1 : 2.5 * 2.5)) {
      changeInventory(item.kind, 1);
      entity.destroy();
      return;
    }
    velocity.y -= 16 * dt;
    const next = position.clone().addScaledVector(velocity, dt);
    const block = blocks.get(`${Math.round(next.x)},${Math.round(next.y - 0.18)},${Math.round(next.z)}`);
    if (block && isCollidable(block)) {
      velocity.y = Math.abs(velocity.y) * 0.3;
      velocity.x *= 0.75;
      velocity.z *= 0.75;
      next.y = Math.round(next.y - 0.18) + (item.mined ? 0.64 : 0.7);
    }
    position.copy(next);
  });
}
