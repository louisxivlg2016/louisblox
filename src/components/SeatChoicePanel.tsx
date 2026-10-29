import { requestPlay } from '../game/input';
import { useGameStore } from '../game/store';
import { VehicleMotion } from '../game/traits';
import { mountEntity } from '../game/vehicles';
import { world } from '../game/world';

const names = { car: 'Voiture', plane: 'Avion', train: 'Train' } as const;

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
  return (
    <div className="backpack-backdrop">
      <section className="book-panel backpack-panel seat-choice-panel" aria-label="Choisir une place">
        <div className="backpack-header"><h2>{names[choice.kind]}</h2><button className="secondary-button" onClick={close}>Fermer</button></div>
        <p>Choisis ta place dans le véhicule. Le personnel et les autres passagers sont déjà à bord.</p>
        <div className="seat-choice-actions">
          <button className="primary-button" disabled={choice.vehicle.get(VehicleMotion)?.mounted} onClick={() => choose('driver')}>Conduire</button>
          <button className="primary-button" onClick={() => choose('passenger')}>Passager</button>
        </div>
      </section>
    </div>
  );
}
