import { PixelPart, SteeringWheel } from './ItemModel';
import { PLANE_SCALE } from '../game/vehicles';

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

export function VehicleInterior({ kind, driverPresent, passengerSeat }: {
  kind: 'car' | 'plane' | 'train';
  driverPresent: boolean;
  passengerSeat: number | null;
}) {
  if (kind === 'car') {
    return <SteeringWheel position={[-0.35, 0.8, -0.48]} />;
  }

  if (kind === 'plane') {
    const passengers: Array<[number, number, number]> = [[0.55, 0.56, 0.3], [-0.55, 0.56, 1.7], [-0.55, 0.56, 3.1]];
    return (
      <group scale={PLANE_SCALE}>
        <PixelPart position={[0, 0.28, 0.6]} size={[1.75, 0.16, 6.8]} color="#87939a" />
        <SteeringWheel position={[-0.5, 1.03, -2.85]} />
        {passengers.map((position, index) => (
          <group key={index}>
            <Seat position={position} />
            {passengerSeat !== index && <Person position={position} color={index === 1 ? '#8d5e9d' : '#568b62'} />}
          </group>
        ))}
        <Seat position={[-0.5, 0.56, -2.4]} />
        {driverPresent && <Person position={[-0.5, 0.56, -2.4]} color="#31537b" worker />}
        <Person position={[0.55, 0.56, 4.2]} color="#31537b" worker />
      </group>
    );
  }

  const passengers: Array<[number, number, number]> = [[0.65, 0.62, -1], [-0.65, 0.62, 0.6], [0.65, 0.62, 2.2], [-0.65, 0.62, 3.8]];
  return (
    <group>
      <PixelPart position={[0, 0.28, 0]} size={[2.2, 0.16, 9.5]} color="#5e666c" />
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
