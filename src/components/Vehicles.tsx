import { useQuery, useTrait } from 'koota/react';
import type { Entity } from 'koota';
import { Vehicle, VehicleMesh, VehicleMotion, VehiclePosition } from '../game/traits';
import { CarModel } from './ItemModel';

function VehicleView({ entity }: { entity: Entity }) {
  const vehicle = useTrait(entity, Vehicle);
  const position = entity.get(VehiclePosition)!;
  return (
    <group
      ref={(group) => {
        const holder = entity.get(VehicleMesh);
        if (holder) holder.value = group;
      }}
      position={[position.x, position.y, position.z]}
    >
      {vehicle && <CarModel color={vehicle.color} />}
    </group>
  );
}

export function Vehicles() {
  const vehicles = useQuery(Vehicle, VehiclePosition, VehicleMotion);
  return vehicles.map((entity) => <VehicleView key={entity} entity={entity} />);
}
