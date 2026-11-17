import { useQueryFirst } from 'koota/react';
import { Player, PlayerMount, Vehicle } from '../game/traits';
import { useRemotePlayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import { translate, useLanguageStore } from '../game/language';

export function VehiclePassengers() {
  useLanguageStore((state) => state.language);
  const player = useQueryFirst(Player);
  const mode = useGameStore((state) => state.mode);
  const mount = player?.get(PlayerMount);
  const vehicleId = mount?.vehicle?.get(Vehicle)?.id;
  const players = useRemotePlayerStore((state) => state.players);
  const passengers = Object.values(players).filter((remote) => remote.mounted && vehicleId !== undefined && remote.vehicleId === vehicleId);
  if (mode !== 'play' || !vehicleId || passengers.length === 0) return null;
  return <div className="passenger-notice">{passengers.length > 1 ? translate(`${passengers.length} joueurs dans le véhicule`, `${passengers.length} players in the vehicle`, `${passengers.length} jugadores en el vehículo`) : translate('1 joueur dans le véhicule', '1 player in the vehicle', '1 jugador en el vehículo')}</div>;
}
