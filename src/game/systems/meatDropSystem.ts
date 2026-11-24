import type { Entity, World } from 'koota';
import type { AnimalKind } from '../animals';
import { changeInventory } from '../inventory';
import { MeatDrop, MeatDropMesh, MeatDropMotion, MeatDropPosition, Player, PlayerPosition } from '../traits';

export function meatDropSystem(world: World, dt: number) {
  const player = world.queryFirst(Player)?.get(PlayerPosition);
  const pickups: Array<{ entity: Entity; kind: AnimalKind }> = [];

  world.query(MeatDrop, MeatDropPosition, MeatDropMotion, MeatDropMesh).updateEach(([drop, position, motion, mesh], entity) => {
    motion.age += dt;
    position.y = motion.baseY + Math.sin(motion.age * 3) * 0.12;
    if (mesh.value) {
      mesh.value.position.copy(position);
      mesh.value.rotation.y = motion.age * 1.4;
    }
    if (player && position.distanceToSquared(player) < 2.25) pickups.push({ entity, kind: drop.kind });
  });

  if (pickups.length === 0) return;
  for (const pickup of pickups) {
    pickup.entity.destroy();
    changeInventory(pickup.kind === 'chicken' || pickup.kind === 'duck' ? 'raw_chicken' : 'raw_meat', 1);
  }
}
