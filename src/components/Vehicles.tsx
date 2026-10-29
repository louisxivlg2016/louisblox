import { useQuery, useQueryFirst, useTrait } from 'koota/react';
import type { Entity } from 'koota';
import { Player, PlayerMount, Vehicle, VehicleMesh, VehicleMotion, VehiclePosition } from '../game/traits';
import { useGameStore } from '../game/store';
import { VehicleGlb } from './VehicleGlb';
import { VehicleInterior } from './TransportInterior';

function VehicleView({ entity }: { entity: Entity }) {
  const vehicle = useTrait(entity, Vehicle);
  const player = useQueryFirst(Player);
  const ridingRole = useGameStore((state) => state.ridingRole);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const position = entity.get(VehiclePosition)!;
  const mount = player?.get(PlayerMount);
  const kind = vehicle?.kind ?? 'car';
  return (
    <group
      ref={(group) => {
        const holder = entity.get(VehicleMesh);
        if (holder) holder.value = group;
      }}
      position={[position.x, position.y, position.z]}
    >
      {vehicle && <VehicleGlb kind={kind} color={vehicle.color} interior={mount?.vehicle === entity && cameraMode === 'first'} />}
      <VehicleInterior
        kind={kind}
        color={vehicle?.color ?? '#d63935'}
        driverPresent={!(mount?.vehicle === entity && mount.role === 'driver' && ridingRole === 'driver')}
        passengerSeat={mount?.vehicle === entity && mount.role === 'passenger' ? mount.seat : null}
      />
    </group>
  );
}

export function Vehicles() {
  const vehicles = useQuery(Vehicle, VehiclePosition, VehicleMotion);
  return vehicles.map((entity) => <VehicleView key={entity} entity={entity} />);
}
