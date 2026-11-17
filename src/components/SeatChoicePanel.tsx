import { requestPlay } from '../game/input';
import { useGameStore } from '../game/store';
import { VehicleMotion } from '../game/traits';
import { mountEntity } from '../game/vehicles';
import { world } from '../game/world';
import { canWalkInVehicle } from '../game/vehicleTypes';
import type { VehicleKind } from '../game/vehicleTypes';
import { translate } from '../game/language';
import { usePlaneTitleStore } from '../game/planeTitle';
import { usePoliceTitleStore } from '../game/policeTitle';

const names = (): Record<VehicleKind, string> => ({ car: translate('Voiture', 'Car'), plane: translate('Avion', 'Airplane'), train: 'Train', metro: translate('Métro', 'Metro'), boat: translate('Bateau', 'Boat'), jeep: 'Jeep', police: translate('Voiture de police', 'Police Car'), firetruck: translate('Camion de pompier', 'Fire Truck'), carriage: translate('Calèche', 'Carriage'), cannon: translate('Canon', 'Cannon') });

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
      <section className="book-panel backpack-panel seat-choice-panel" aria-label={translate('Choisir une place', 'Choose a seat')}>
        <div className="backpack-header"><h2>{names()[choice.kind]}</h2><button type="button" className="secondary-button" onClick={close}>{translate('Fermer', 'Close')}</button></div>
        <p>{choice.kind === 'cannon' ? translate('Prends les commandes du canon pour viser et tirer.', 'Take control of the cannon to aim and fire.') : walkable ? translate('Choisis ta place. En passager, tu peux marcher dans le véhicule. Rien ne démarre sans conducteur.', 'Choose your seat. As a passenger, you can walk inside the vehicle. Nothing moves without a driver.') : translate('Choisis ta place dans le véhicule. Le passager ne conduit jamais.', 'Choose your seat in the vehicle. Passengers never drive.')}</p>
        <div className="seat-choice-actions">
          <button className="primary-button" disabled={choice.vehicle.get(VehicleMotion)?.mounted} onClick={() => choose('driver')}>{choice.kind === 'carriage' ? translate('Cocher', 'Drive carriage') : choice.kind === 'plane' ? translate('Piloter', 'Pilot') : choice.kind === 'cannon' ? translate('Utiliser le canon', 'Use cannon') : translate('Conduire', 'Drive')}</button>
          {choice.kind !== 'cannon' && <button className="primary-button" onClick={() => choose('passenger')}>{translate('Passager', 'Passenger', 'Pasajero')}{walkable ? translate(' · marcher à bord', ' · walk on board') : ''}</button>}
          {choice.kind === 'plane' && <button type="button" className="secondary-button" onClick={() => { usePlaneTitleStore.getState().setEditorOpen(true); setSeatChoice(null); }}>{translate('Modifier le titre de l’avion', 'Edit airplane title', 'Editar el título del avión')}</button>}
          {choice.kind === 'police' && <button type="button" className="secondary-button" onClick={() => { usePoliceTitleStore.getState().setEditorOpen(true); setSeatChoice(null); }}>{translate('Modifier le titre de la voiture de police', 'Edit police car title', 'Editar el título del coche de policía')}</button>}
        </div>
      </section>
    </div>
  );
}
