import { getWorldSeed } from '../game/chunks';
import { BIOME_NAMES } from '../game/levels';
import { MEAT_NAMES } from '../game/meats';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { nearestRuin } from '../game/ruins';
import { useGameStore } from '../game/store';
import { Player } from '../game/traits';
import { world } from '../game/world';
import { translate } from '../game/language';

const WEATHER_NAMES = () => ({ clear: translate('Ciel clair', 'Clear sky'), rain: translate('Pluie', 'Rain'), snow: translate('Neige', 'Snow') });
const RUIN_NAMES = () => ({ church: translate('Église', 'Church'), palace: translate('Palais', 'Palace'), fort: 'Fort' });

function Coordinates() {
  const coordinates = useGameStore((state) => state.coordinates);
  const nearbyRuin = world.queryFirst(Player) ? nearestRuin(coordinates.x, coordinates.z, getWorldSeed(world)) : null;
  return (
    <>
      <span className="coordinates">XYZ {coordinates.x.toFixed(2)} / {coordinates.y.toFixed(2)} / {coordinates.z.toFixed(2)}</span>
      {nearbyRuin && nearbyRuin.distance < 64 && <span className="weather-info">{translate('Ruines :', 'Ruins:')} {RUIN_NAMES()[nearbyRuin.type]} {translate('à', 'at')} {Math.round(nearbyRuin.distance)} m</span>}
    </>
  );
}

function EnvironmentInfo() {
  const environment = useGameStore((state) => state.environment);
  const totalMinutes = Math.floor(environment.dayProgress * 24 * 60);
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return (
    <>
      <span className="biome-info">{BIOME_NAMES()[environment.biome]} · {hours}:{minutes}</span>
      <span className={`weather-info ${environment.weather}`}>{WEATHER_NAMES()[environment.weather]}</span>
    </>
  );
}

export function WorldStats() {
  const blockCount = useGameStore((state) => state.blockCount);
  const coins = useGameStore((state) => state.coins);
  const apples = useGameStore((state) => state.apples);
  const meat = useGameStore((state) => state.meat);
  const flying = useGameStore((state) => state.flying);
  const riding = useGameStore((state) => state.riding);
  const ridingRole = useGameStore((state) => state.ridingRole);
  const equippedArmor = useGameStore((state) => state.equippedArmor);
  const lives = useGameStore((state) => state.lives);
  const multiplayerEnabled = useMultiplayerStore((state) => state.enabled);
  const multiplayerStatus = useMultiplayerStore((state) => state.status);
  const multiplayerRoom = useMultiplayerStore((state) => state.room);
  const multiplayerPlayerCount = useMultiplayerStore((state) => state.players.length);
  const meatSummary = Object.entries(meat)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${MEAT_NAMES()[kind as keyof typeof MEAT_NAMES]} ×${count}`)
    .join(' · ');

  return (
    <div className="world-stats">
      <strong className="block-count">{blockCount.toLocaleString(translate('fr-FR', 'en-US'))}</strong> {translate('blocs chargés', 'loaded blocks')}
      <Coordinates />
      <EnvironmentInfo />
      {multiplayerEnabled && <span className={`weather-info multiplayer-hud ${multiplayerStatus}`}>{multiplayerStatus === 'online' ? `${translate('En ligne', 'Online')} · ${multiplayerRoom} · ${multiplayerPlayerCount} ${translate('joueur', 'player')}${multiplayerPlayerCount > 1 ? 's' : ''}` : multiplayerStatus === 'connecting' ? `${translate('Connexion', 'Connecting')} · ${multiplayerRoom}` : `${translate('Hors ligne', 'Offline')} · ${multiplayerRoom}`}</span>}
      <span className="weather-info coin-count">{translate('Monnaie :', 'Coins:')} {coins}</span>
      <span className="weather-info apple-count">{translate('Pommes :', 'Apples:')} {apples}</span>
      <span className="weather-info meat-count">{translate('Viandes :', 'Meats:')} {meatSummary || translate('aucune', 'none')}</span>
      <span className="weather-info lives-count">{translate('Vies :', 'Lives:')} {lives}/10</span>
      {equippedArmor && <span className="weather-info">{translate('Armure :', 'Armor:')} {equippedArmor}</span>}
      {riding && <span className="weather-info">{riding === 'car' ? translate('Au volant · E pour sortir', 'Driving · E to exit') : riding === 'horse' ? translate('À cheval · E pour descendre', 'On horseback · E to dismount') : `${riding === 'plane' ? translate('Avion', 'Airplane') : riding === 'boat' ? translate('Bateau', 'Boat') : 'Train'} · ${ridingRole === 'passenger' ? translate('Passager', 'Passenger') : translate('Conducteur', 'Driver')} · ${translate('E pour descendre', 'E to exit')}`}</span>}
      {flying && <span className="weather-info flight-status">{translate('Vol activé', 'Flight enabled')}</span>}
    </div>
  );
}
