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

function WindowPart({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={position} name="cabin-window">
      <boxGeometry args={size} />
      <meshLambertMaterial color="#a9d3e2" transparent opacity={0.2} depthWrite={false} />
    </mesh>
  );
}

function CabinShell({ cabin, showFloor = true }: { cabin: CabinDefinition; showFloor?: boolean }) {
  const length = cabin.rear - cabin.front;
  const middle = (cabin.rear + cabin.front) / 2;
  const height = cabin.ceiling - cabin.floor;
  return (
    <group name="walkable-cabin">
      {showFloor && <PixelPart position={[0, cabin.floor - 0.1, middle]} size={[cabin.halfWidth * 2 + 0.4, 0.2, length + 0.4]} color="#64727d" />}
      {showFloor && <PixelPart position={[0, cabin.floor + 0.012, middle]} size={[1.2, 0.025, length]} color="#405c76" />}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (cabin.halfWidth + 0.12), cabin.floor + height / 2, middle]}>
          <boxGeometry args={[0.2, height, length + 0.4]} />
          <meshLambertMaterial color="#a9d3e2" transparent opacity={0.2} depthWrite={false} />
        </mesh>
      ))}
      {[-1, 1].map((side) => <PixelPart key={side} position={[side * (cabin.halfWidth + 0.12), cabin.floor + height / 2, cabin.front - 0.1]} size={[0.16, height, 0.2]} color="#a9b9c4" />)}
      <PixelPart position={[0, cabin.ceiling - 0.16, cabin.front - 0.1]} size={[cabin.halfWidth * 2 + 0.4, 0.3, 0.2]} color="#a9b9c4" />
      <PixelPart position={[0, cabin.floor + 0.22, cabin.front - 0.1]} size={[cabin.halfWidth * 2 + 0.4, 0.44, 0.2]} color="#a9b9c4" />
      <mesh name="plane-windshield" position={[0, cabin.floor + height * 0.56, cabin.front - 0.115]}>
        <boxGeometry args={[cabin.halfWidth * 2 + 0.2, height * 0.66, 0.035]} />
        <meshLambertMaterial color="#a9d3e2" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <PixelPart position={[0, cabin.floor + height / 2, cabin.rear + 0.1]} size={[cabin.halfWidth * 2 + 0.4, height, 0.2]} color="#a9b9c4" />
      <mesh position={[0, cabin.ceiling + 0.1, middle]}>
        <boxGeometry args={[cabin.halfWidth * 2 + 0.4, 0.2, length + 0.4]} />
        <meshLambertMaterial color="#dce5e8" />
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

function RoadInterior({ kind, rightHandDrive }: { kind: VehicleKind; rightHandDrive: boolean }) {
  const driverX = rightHandDrive ? 0.58 : -0.58;
  const halfWidth = kind === 'firetruck' ? 1.18 : kind === 'car' ? 1.02 : 1.08;
  const ceiling = kind === 'firetruck' ? 2.5 : 1.95;
  const front = kind === 'firetruck' ? -1.55 : -1.35;
  const rear = kind === 'firetruck' ? 2.15 : 1.45;
  const middle = (front + rear) / 2;
  const length = rear - front;
  return (
    <group name="road-cabin">
      <PixelPart position={[0, 0.24, middle]} size={[halfWidth * 2, 0.18, length]} color="#28333e" />
      <PixelPart position={[0, 0.36, middle]} size={[0.72, 0.04, length - 0.2]} color="#465664" />
      <PixelPart position={[0, ceiling, middle]} size={[halfWidth * 2, 0.16, length]} color="#d3d9dc" />
      {[-1, 1].map((side) => <group key={side}>
        <PixelPart position={[side * halfWidth, 0.7, middle]} size={[0.12, 0.85, length]} color="#596d7b" />
        <WindowPart position={[side * halfWidth, 1.38, middle]} size={[0.1, 0.72, length - 0.35]} />
        <PixelPart position={[side * (halfWidth - 0.07), 0.93, 0.45]} size={[0.08, 0.08, 0.42]} color="#c2cbd0" />
        <PixelPart position={[side * (halfWidth - 0.09), 1.38, front + 0.35]} size={[0.13, 0.78, 0.12]} color="#9aa9b2" />
        <PixelPart position={[side * (halfWidth - 0.09), 1.38, rear - 0.35]} size={[0.13, 0.78, 0.12]} color="#9aa9b2" />
      </group>)}
      <WindowPart position={[0, 1.4, front]} size={[halfWidth * 2, 0.82, 0.1]} />
      <PixelPart position={[0, 0.86, front + 0.28]} size={[halfWidth * 1.85, 0.34, 0.48]} color="#263642" />
      <PixelPart position={[driverX, 1.02, front + 0.54]} size={[0.5, 0.18, 0.14]} color="#10181f" />
      <PixelPart position={[driverX - 0.12, 1.04, front + 0.63]} size={[0.08, 0.08, 0.025]} color="#65b6cf" />
      <PixelPart position={[driverX + 0.04, 1.04, front + 0.63]} size={[0.08, 0.08, 0.025]} color="#d6b55b" />
      <SteeringWheel position={[driverX, 1.03, front + 0.72]} />
      <Seat position={[driverX, 0.52, -0.02]} />
      <Seat position={[-driverX, 0.52, -0.02]} />
      <Seat position={[driverX, 0.52, 0.95]} />
      <Seat position={[-driverX, 0.52, 0.95]} />
      <PixelPart position={[0, 1.35, rear]} size={[halfWidth * 2, 1.1, 0.12]} color="#596d7b" />
      <WindowPart position={[0, 1.45, rear - 0.07]} size={[halfWidth * 1.55, 0.58, 0.06]} />
    </group>
  );
}

function TrainInterior({ kind, driverPresent, passengerSeat }: { kind: 'train' | 'metro'; driverPresent: boolean; passengerSeat: number | null }) {
  const cabin = CABINS[kind]!;
  const seatX = Math.min(0.65, cabin.halfWidth - 0.38);
  const seatY = cabin.floor + 0.25;
  const passengers = [5.7, 4.1, 2.5, 0.9].map((offset, index): [number, number, number] => [index % 2 === 0 ? seatX : -seatX, seatY, cabin.rear - offset]);
  return (
    <group name="train-cabin">
      <CabinShell cabin={cabin} />
      <SteeringWheel position={[-seatX, cabin.floor + 0.79, cabin.front + 0.6]} />
      {passengers.map((position, index) => (
        <group key={index}>
          <Seat position={position} />
          {passengerSeat !== index && <Person position={position} color={index % 2 === 0 ? '#a36248' : '#4d789c'} />}
        </group>
      ))}
      <Seat position={[-seatX, seatY, cabin.front + 1]} />
      {driverPresent && <Person position={[-seatX, seatY, cabin.front + 1]} color="#31537b" worker />}
      <Person position={[-seatX, seatY, cabin.rear - 0.1]} color="#31537b" worker />
    </group>
  );
}

export function VehicleInterior({ kind, driverPresent, passengerSeat, rightHandDrive = false }: {
  kind: VehicleKind;
  driverPresent: boolean;
  passengerSeat: number | null;
  rightHandDrive?: boolean;
}) {
  if (kind === 'plane') return <PlaneInterior driverPresent={driverPresent} />;
  if (kind === 'train' || kind === 'metro') return <TrainInterior kind={kind} driverPresent={driverPresent} passengerSeat={passengerSeat} />;
  if (kind === 'carriage') return <><CabinShell cabin={CABINS.carriage!} /><Seat position={[-0.5, 1.04, 0.5]} /><Seat position={[0.5, 1.04, 0.5]} /></>;
  if (kind === 'boat') {
    return <><Seat position={[-0.42, 0.58, -0.3]} /><Seat position={[0.38, 0.58, -0.3]} /><SteeringWheel position={[-0.42, 0.94, -0.73]} /></>;
  }
  if (kind === 'cannon') return null;
  return <RoadInterior kind={kind} rightHandDrive={rightHandDrive} />;
}
