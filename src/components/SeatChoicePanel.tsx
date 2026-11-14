import { requestPlay } from '../game/input';
import { useGameStore } from '../game/store';
import { VehicleMotion } from '../game/traits';
import { mountEntity } from '../game/vehicles';
import { world } from '../game/world';
import { canWalkInVehicle } from '../game/vehicleTypes';
import type { VehicleKind } from '../game/vehicleTypes';

const names: Record<VehicleKind, string> = { car: 'Voiture', plane: 'Avion', train: 'Train', metro: 'Métro', boat: 'Bateau', jeep: 'Jeep', police: 'Voiture de police', firetruck: 'Camion de pompier', carriage: 'Calèche', cannon: 'Canon' };

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
      <section className="book-panel backpack-panel seat-choice-panel" aria-label="Choisir une place">
        <div className="backpack-header"><h2>{names[choice.kind]}</h2><button type="button" className="secondary-button" onClick={close}>Fermer</button></div>
        <p>{choice.kind === 'cannon' ? 'Prends les commandes du canon pour viser et tirer.' : walkable ? 'Choisis ta place. En passager, tu peux marcher dans le véhicule. Rien ne démarre sans conducteur.' : 'Choisis ta place dans le véhicule. Le passager ne conduit jamais.'}</p>
        <div className="seat-choice-actions">
          <button className="primary-button" disabled={choice.vehicle.get(VehicleMotion)?.mounted} onClick={() => choose('driver')}>{choice.kind === 'carriage' ? 'Cocher' : choice.kind === 'plane' ? 'Piloter' : choice.kind === 'cannon' ? 'Utiliser le canon' : 'Conduire'}</button>
          {choice.kind !== 'cannon' && <button className="primary-button" onClick={() => choose('passenger')}>Passager{walkable ? ' · marcher à bord' : ''}</button>}
        </div>
      </section>
    </div>
  );
}
