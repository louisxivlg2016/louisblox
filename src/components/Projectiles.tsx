import { useQuery } from 'koota/react';
import type { Entity } from 'koota';
import { Projectile, ProjectileMesh, ProjectilePosition } from '../game/traits';
import { PixelPart } from './ItemModel';

function ProjectileView({ entity }: { entity: Entity }) {
  const position = entity.get(ProjectilePosition)!;
  const projectile = entity.get(Projectile)!;
  return (
    <group
      ref={(group) => {
        const holder = entity.get(ProjectileMesh);
        if (holder) holder.value = group;
      }}
      position={[position.x, position.y, position.z]}
    >
      {projectile.kind === 'bomb' ? (
        <group>
          <PixelPart position={[0, 0, 0]} size={[0.34, 0.34, 0.34]} color="#343c47" />
          <PixelPart position={[0, 0.2, 0]} size={[0.12, 0.1, 0.12]} color="#a9a9a0" />
          <PixelPart position={[0, 0.3, 0]} size={[0.04, 0.14, 0.04]} color="#edc45a" />
        </group>
      ) : projectile.kind === 'arrow' ? (
        <group>
          <PixelPart position={[0, 0, 0]} size={[0.035, 0.035, 0.7]} color="#a38759" />
          <PixelPart position={[0, 0, -0.4]} size={[0.1, 0.1, 0.13]} color="#dbe2e0" />
          <PixelPart position={[0, 0, 0.3]} size={[0.14, 0.04, 0.16]} color="#e9e8d6" />
        </group>
      ) : <PixelPart position={[0, 0, 0]} size={[0.07, 0.07, 0.22]} color="#ffdc75" />}
    </group>
  );
}

export function Projectiles() {
  const projectiles = useQuery(Projectile);
  return projectiles.map((entity) => <ProjectileView key={entity} entity={entity} />);
}
