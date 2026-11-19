import { useQuery, useQueryFirst, useTrait } from 'koota/react';
import type { Entity } from 'koota';
import { Player, PlayerMount, Vehicle, VehicleMesh, VehicleMotion, VehiclePosition } from '../game/traits';
import { useGameStore } from '../game/store';
import { VehicleGlb } from './VehicleGlb';
import { VehicleInterior } from './TransportInterior';
import { useRemotePlayerStore } from '../game/multiplayerStore';

function VehicleView({ entity }: { entity: Entity }) {
  const vehicle = useTrait(entity, Vehicle);
  const player = useQueryFirst(Player);
  const ridingRole = useGameStore((state) => state.ridingRole);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const position = entity.get(VehiclePosition)!;
  const mount = player?.get(PlayerMount);
  const kind = vehicle?.kind ?? 'car';
  const remotePlayers = useRemotePlayerStore((state) => state.players);
  const remoteOccupants = Object.values(remotePlayers).filter((remote) => remote.mounted && remote.vehicleId === vehicle?.id);
  const remoteDriver = remoteOccupants.some((remote) => remote.mountRole === 'driver');
  const localDriver = mount?.vehicle === entity && mount.role === 'driver' && ridingRole === 'driver';
  const showInterior = mount?.vehicle === entity && cameraMode === 'first';
  return (
    <group
      ref={(group) => {
        const holder = entity.get(VehicleMesh);
        if (holder) holder.value = group;
      }}
      position={[position.x, position.y, position.z]}
    >
      {vehicle && <VehicleGlb entity={entity} kind={kind} color={vehicle.color} interior={showInterior}  />}
      {showInterior && <VehicleInterior
        kind={kind}
        driverPresent={!localDriver && !remoteDriver}
        passengerSeat={mount?.vehicle === entity && mount.role === 'passenger' ? mount.seat : null}
        rightHandDrive={kind === 'car' && vehicle?.color.toLowerCase() === '#347cd0'}
      />}
    </group>
  );
}

export function Vehicles() {
  const vehicles = useQuery(Vehicle, VehiclePosition, VehicleMotion);
  return vehicles.map((entity) => <VehicleView key={entity} entity={entity} />);
}
