import { FullCharacterGlb } from './FullCharacterGlb';
import type { VehicleKind } from '../game/vehicleTypes';

const outfits = ['classic-girl', 'classic-boy', 'worker', 'princess', 'police', 'king'] as const;
const planeSeats: Array<[number, number, number]> = [
  [-0.55, 5.5, -8], [0.55, 5.5, -12], [-0.55, 5.5, -16],
  [0.55, 5.5, -20], [-0.55, 5.5, -24], [0.55, 5.5, -27],
];
const trainSeats: Array<[number, number, number]> = [
  [-0.4, 0.18, -5.8], [0.4, 0.18, -4.2], [-0.4, 0.18, -2.6],
  [0.4, 0.18, -1], [-0.4, 0.18, 0.6], [0.4, 0.18, 2.2],
];

export function TransportPassengers({ kind }: { kind: VehicleKind }) {
  if (kind !== 'plane' && kind !== 'train' && kind !== 'metro') return null;
  const seats = kind === 'plane' ? planeSeats : trainSeats;
  return (
    <group name={`vehicle-passengers-${kind}`}>
      {seats.map((position, index) => (
        <group key={index} name={`npc-passenger-${outfits[index]}-${index}`} position={position} rotation={[0, Math.PI, 0]}>
          <FullCharacterGlb outfit={outfits[index]} seated remote airborne={false} />
        </group>
      ))}
    </group>
  );
}
