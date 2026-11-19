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
  const passengers = Object.values(players).filter((remote) => remote.mounted && vehicleId !== undefined && remote.vehicleId === vehicleId).length + 1;
  if (mode !== 'play' || !vehicleId || passengers < 2) return null;
  return <div className="passenger-notice">{translate(`${passengers} joueurs dans le véhicule`, `${passengers} players in the vehicle`, `${passengers} jugadores en el vehículo`)}</div>;
}
