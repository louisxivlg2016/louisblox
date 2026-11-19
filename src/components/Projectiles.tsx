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
        <group name={projectile.effect === 'smoke' ? 'smoke-grenade' : projectile.effect === 'firework' ? 'firework-projectile' : 'bomb-projectile'}>
          {projectile.effect === 'firework' ? (
            <>
              <PixelPart position={[0, 0, 0]} size={[0.24, 0.58, 0.24]} color={projectile.color ?? '#a7b0b4'} />
              <PixelPart position={[0, -0.16, 0]} size={[0.26, 0.08, 0.26]} color="#f0e5c9" />
              <PixelPart position={[0, 0.34, 0]} size={[0.07, 0.16, 0.07]} color="#c6a35a" />
              <PixelPart position={[0, 0.45, 0]} size={[0.1, 0.1, 0.1]} color="#ffb43c" />
            </>
          ) : (
            <>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.17, 0.17, 0.38, 12]} />
                <meshLambertMaterial color={projectile.effect === 'smoke' ? '#43564b' : '#343c47'} />
              </mesh>
              <PixelPart position={[0, 0.22, 0]} size={[0.12, 0.1, 0.12]} color="#b7c0c4" />
              <PixelPart position={[0.08, 0.28, 0]} size={[0.2, 0.05, 0.08]} color="#d8dfe1" />
              <PixelPart position={[0, -0.04, -0.17]} size={[0.32, 0.07, 0.04]} color={projectile.effect === 'smoke' ? '#d7c34b' : '#a9a9a0'} />
            </>
          )}
        </group>
      ) : projectile.kind === 'arrow' ? (
        <group>
          <PixelPart position={[0, 0, 0]} size={[0.035, 0.035, 0.7]} color="#a38759" />
          <PixelPart position={[0, 0, -0.4]} size={[0.1, 0.1, 0.13]} color="#dbe2e0" />
          <PixelPart position={[0, 0, 0.3]} size={[0.14, 0.04, 0.16]} color="#e9e8d6" />
        </group>
      ) : projectile.color ? (
        <group name="paintball-projectile" userData={{ color: projectile.color }}>
          <PixelPart position={[0, 0, 0]} size={[0.16, 0.16, 0.16]} color={projectile.color} />
          <PixelPart position={[0, 0.08, 0.04]} size={[0.08, 0.08, 0.08]} color={projectile.color} />
        </group>
      ) : <PixelPart position={[0, 0, 0]} size={[0.07, 0.07, 0.22]} color="#ffdc75" />}
    </group>
  );
}

export function Projectiles() {
  const projectiles = useQuery(Projectile);
  return projectiles.map((entity) => <ProjectileView key={entity} entity={entity} />);
}
