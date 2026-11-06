import { PixelPart, SteeringWheel } from './ItemModel';
import { CABINS } from '../game/vehicleTypes';
import type { CabinDefinition, VehicleKind } from '../game/vehicleTypes';

function Seat({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <PixelPart position={[0, 0, 0]} size={[0.56, 0.16, 0.58]} color="#354859" />
      <PixelPart position={[0, 0.32, 0.25]} size={[0.56, 0.58, 0.12]} color="#415b70" />
    </group>
  );
}

function Person({ position, color, worker = false }: { position: [number, number, number]; color: string; worker?: boolean }) {
  return (
    <group position={position}>
      <PixelPart position={[0, 0.44, 0]} size={[0.34, 0.48, 0.26]} color={color} />
      <PixelPart position={[0, 0.86, 0]} size={[0.32, 0.32, 0.32]} color="#d7a080" />
      <PixelPart position={[-0.1, 0.1, -0.18]} size={[0.12, 0.22, 0.4]} color="#293c50" />
      <PixelPart position={[0.1, 0.1, -0.18]} size={[0.12, 0.22, 0.4]} color="#293c50" />
      <PixelPart position={[-0.22, 0.43, -0.03]} size={[0.11, 0.38, 0.16]} color={color} />
      <PixelPart position={[0.22, 0.43, -0.03]} size={[0.11, 0.38, 0.16]} color={color} />
      {worker && <PixelPart position={[0, 1.055, 0]} size={[0.37, 0.09, 0.37]} color="#25466c" />}
    </group>
  );
}

function CabinShell({ cabin }: { cabin: CabinDefinition }) {
  const length = cabin.rear - cabin.front;
  const middle = (cabin.rear + cabin.front) / 2;
  const height = cabin.ceiling - cabin.floor;
  return (
    <group name="walkable-cabin">
      <PixelPart position={[0, cabin.floor - 0.1, middle]} size={[cabin.halfWidth * 2 + 0.4, 0.2, length + 0.4]} color="#64727d" />
      <PixelPart position={[0, cabin.floor + 0.012, middle]} size={[1.2, 0.025, length]} color="#405c76" />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (cabin.halfWidth + 0.12), cabin.floor + height / 2, middle]}>
          <boxGeometry args={[0.2, height, length + 0.4]} />
          <meshLambertMaterial color="#cfdae0" transparent opacity={0.2} depthWrite={false} />
        </mesh>
      ))}
      <PixelPart position={[0, cabin.floor + height / 2, cabin.front - 0.1]} size={[cabin.halfWidth * 2 + 0.4, height, 0.2]} color="#a9b9c4" />
      <PixelPart position={[0, cabin.floor + height / 2, cabin.rear + 0.1]} size={[cabin.halfWidth * 2 + 0.4, height, 0.2]} color="#a9b9c4" />
      <mesh position={[0, cabin.ceiling + 0.1, middle]}>
        <boxGeometry args={[cabin.halfWidth * 2 + 0.4, 0.2, length + 0.4]} />
        <meshLambertMaterial color="#dce5e8" transparent opacity={0.24} depthWrite={false} />
      </mesh>
    </group>
  );
}

function PlaneInterior({ driverPresent }: { driverPresent: boolean }) {
  const cabin = CABINS.plane!;
  const rows = Array.from({ length: 6 }, (_, index) => cabin.front + 5 + index * 3.4);
  return (
    <group name="plane-cabin">
      <CabinShell cabin={cabin} />
      <SteeringWheel position={[-0.65, cabin.floor + 0.95, cabin.front + 0.25]} />
      <Seat position={[-0.65, cabin.floor + 0.55, cabin.front + 1.1]} />
      {driverPresent && <Person position={[-0.65, cabin.floor + 0.55, cabin.front + 1.1]} color="#31537b" worker />}
      {rows.flatMap((z, row) => [-0.62, 0.62].map((x, column) => (
        <group key={`${row}-${column}`}>
          <Seat position={[x, cabin.floor + 0.55, z]} />
          <Person position={[x, cabin.floor + 0.55, z]} color={(row + column) % 2 === 0 ? '#568b62' : '#8d5e9d'} />
        </group>
      )))}
      <Person position={[0, cabin.floor, cabin.rear - 2]} color="#31537b" worker />
    </group>
  );
}

function TrainInterior({ driverPresent, passengerSeat }: { driverPresent: boolean; passengerSeat: number | null }) {
  const cabin = CABINS.train!;
  const passengers: Array<[number, number, number]> = [[0.65, 0.62, -1], [-0.65, 0.62, 0.6], [0.65, 0.62, 2.2], [-0.65, 0.62, 3.8]];
  return (
    <group name="train-cabin">
      <CabinShell cabin={cabin} />
      <SteeringWheel position={[-0.65, 1.16, -4.1]} />
      {passengers.map((position, index) => (
        <group key={index}>
          <Seat position={position} />
          {passengerSeat !== index && <Person position={position} color={index % 2 === 0 ? '#a36248' : '#4d789c'} />}
        </group>
      ))}
      <Seat position={[-0.65, 0.62, -3.7]} />
      {driverPresent && <Person position={[-0.65, 0.62, -3.7]} color="#31537b" worker />}
      <Person position={[-0.65, 0.62, 4.7]} color="#31537b" worker />
    </group>
  );
}

function CarriageInterior({ driverPresent }: { driverPresent: boolean }) {
  return (
    <group name="carriage-cabin">
      <CabinShell cabin={CABINS.carriage!} />
      <Seat position={[0, 1.55, -2]} />
      {driverPresent && <Person position={[0, 1.55, -2]} color="#563f31" worker />}
      <Seat position={[-0.48, 1.5, 0.45]} />
      <Seat position={[0.48, 1.5, 0.45]} />
      <Seat position={[0, 1.5, 1.3]} />
      <PixelPart position={[0, 1.04, 0.5]} size={[1.8, 0.05, 2]} color="#9b3040" />
    </group>
  );
}

export function VehicleInterior({ kind, driverPresent, passengerSeat }: {
  kind: VehicleKind;
  driverPresent: boolean;
  passengerSeat: number | null;
}) {
  if (kind === 'plane') return <PlaneInterior driverPresent={driverPresent} />;
  if (kind === 'train') return <TrainInterior driverPresent={driverPresent} passengerSeat={passengerSeat} />;
  if (kind === 'carriage') return <CarriageInterior driverPresent={driverPresent} />;
  if (kind === 'boat') {
    return <><Seat position={[0, 0.45, -0.72]} /><Seat position={[0, 0.45, 0.72]} /><PixelPart position={[-0.9, 0.45, 0.4]} size={[0.1, 0.1, 2.4]} color="#9a7042" rotation={[0, -0.35, 0]} /></>;
  }
  if (kind === 'cannon') return null;
  return <><SteeringWheel position={[-0.58, 1.05, -0.65]} /><Seat position={[0.58, 0.68, -0.05]} /></>;
}
