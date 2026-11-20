import { useMemo } from 'react';
import { Object3D } from 'three';
import { useQuery, useQueryFirst, useTrait } from 'koota/react';
import type { Entity } from 'koota';
import { Player, PlayerMount, Vehicle, VehicleMesh, VehicleMotion, VehiclePosition } from '../game/traits';
import { useGameStore } from '../game/store';
import { VehicleGlb } from './VehicleGlb';
import { VehicleInterior } from './TransportInterior';
import { useRemotePlayerStore } from '../game/multiplayerStore';
import { useVehicleControls } from '../game/vehicleControls';

function VehicleHeadlights({ kind }: { kind: import('../game/vehicleTypes').VehicleKind }) {
  const enabled = useVehicleControls((state) => state.headlights);
  const target = useMemo(() => new Object3D(), []);
  if (!enabled || !['car', 'police', 'jeep', 'firetruck'].includes(kind)) return null;
  return (
    <group name="vehicle-headlights">
      <primitive object={target} position={[0, 0.5, -12]} />
      {[-0.55, 0.55].map((x) => <group key={x}>
        <mesh position={[x, 0.65, -2.05]}>
          <boxGeometry args={[0.28, 0.18, 0.05]} />
          <meshBasicMaterial color="#fff5bd" toneMapped={false} />
        </mesh>
        <spotLight position={[x, 0.7, -1.85]} target={target} color="#fff2bd" intensity={180} distance={40} angle={0.45} penumbra={0.55} decay={1} />
        <pointLight position={[x, 0.75, -2.1]} color="#fff2bd" intensity={8} distance={7} decay={1} />
      </group>)}
    </group>
  );
}

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
      <VehicleHeadlights kind={kind} />
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
