import type { Entity, World } from 'koota';
import type { PlayerSnapshot } from './multiplayer';
import { Animal, AnimalId, AnimalMesh, AnimalMotion, AnimalPosition, HorseRider, Player, PlayerMount } from './traits';
import { spawnAnimal } from './animals';
import { isAnimalDead } from './deathSync';
import { mountSnapshotsById } from './mounts';

export function syncRemoteMounts(world: World, players: Record<string, PlayerSnapshot>, previous: Set<Entity>) {
  const current = new Set<Entity>();
  const localMount = world.queryFirst(Player)?.get(PlayerMount);
  const locallyDriven = (entity: Entity) => localMount?.vehicle === entity && localMount.role === 'driver';
  const horses = [...world.query(Animal, AnimalId, AnimalPosition, AnimalMotion, AnimalMesh)];
  for (const { snapshot, kind, hasDriver, hasPassenger } of mountSnapshotsById(players).values()) {
    if (isAnimalDead(snapshot.id)) continue;
    let entity: Entity | undefined = horses.find((candidate) => candidate.get(AnimalId) === snapshot.id);
    if (!entity) {
      entity = spawnAnimal(world, kind, snapshot.x, snapshot.y, snapshot.z, 0, snapshot.id) ?? undefined;
      if (!entity) continue;
      entity.set(AnimalId, snapshot.id);
      horses.push(entity);
    }
    if (locallyDriven(entity)) continue;
    current.add(entity);
    const localPassenger = localMount?.vehicle === entity && localMount.role === 'passenger';
    const rider = entity.get(HorseRider);
    if (rider) {
      entity.set(HorseRider, { mounted: hasDriver, passenger: hasPassenger || localPassenger, speed: 0 });
    } else {
      entity.add(HorseRider({ mounted: hasDriver, passenger: hasPassenger || localPassenger }));
    }
    const position = entity.get(AnimalPosition)!;
    position.set(snapshot.x, snapshot.y, snapshot.z);
    entity.set(AnimalMotion, { yaw: snapshot.yaw, displayYaw: snapshot.yaw + Math.PI });
    const mesh = entity.get(AnimalMesh)?.value;
    if (mesh) {
      mesh.position.copy(position);
      mesh.rotation.y = snapshot.yaw + Math.PI;
    }
  }
  for (const entity of previous) {
    if (current.has(entity) || locallyDriven(entity) || !entity.get(HorseRider)) continue;
    const motion = entity.get(AnimalMotion);
    if (motion) entity.set(AnimalMotion, { yaw: motion.displayYaw });
    const localPassenger = localMount?.vehicle === entity && localMount.role === 'passenger';
    entity.set(HorseRider, { mounted: false, passenger: localPassenger, speed: 0 });
  }
  return current;
}
