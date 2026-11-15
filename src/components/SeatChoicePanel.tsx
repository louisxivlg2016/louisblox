import { requestPlay } from '../game/input';
import { useGameStore } from '../game/store';
import { VehicleMotion } from '../game/traits';
import { mountEntity } from '../game/vehicles';
import { world } from '../game/world';
import { canWalkInVehicle } from '../game/vehicleTypes';
import type { VehicleKind } from '../game/vehicleTypes';

const names: Record<VehicleKind, string> = { car: 'Car', plane: 'Airplane', train: 'Train', metro: 'Metro', boat: 'Boat', jeep: 'Jeep', police: 'Police Car', firetruck: 'Fire Truck', carriage: 'Carriage', cannon: 'Cannon' };

export function SeatChoicePanel() {
  const choice = useGameStore((state) => state.seatChoice);
  const setSeatChoice = useGameStore((state) => state.setSeatChoice);
  if (!choice) return null;
  const close = () => {
    setSeatChoice(null);
    void requestPlay();
  };
  const choose = (role: 'driver' | 'passenger') => {
    if (mountEntity(world, choice.vehicle, choice.kind, role)) close();
  };
  const walkable = canWalkInVehicle(choice.kind, 'passenger');
  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel seat-choice-panel" aria-label="Choose a seat">
        <div className="backpack-header"><h2>{names[choice.kind]}</h2><button type="button" className="secondary-button" onClick={close}>Close</button></div>
        <p>{choice.kind === 'cannon' ? 'Take control of the cannon to aim and fire.' : walkable ? 'Choose your seat. As a passenger, you can walk inside the vehicle. Nothing moves without a driver.' : 'Choose your seat in the vehicle. Passengers never drive.'}</p>
        <div className="seat-choice-actions">
          <button className="primary-button" disabled={choice.vehicle.get(VehicleMotion)?.mounted} onClick={() => choose('driver')}>{choice.kind === 'carriage' ? 'Drive carriage' : choice.kind === 'plane' ? 'Pilot' : choice.kind === 'cannon' ? 'Use cannon' : 'Drive'}</button>
          {choice.kind !== 'cannon' && <button className="primary-button" onClick={() => choose('passenger')}>Passenger{walkable ? ' · walk on board' : ''}</button>}
        </div>
      </section>
    </div>
  );
}
