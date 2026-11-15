import { getWorldSeed } from '../game/chunks';
import { BIOME_NAMES } from '../game/levels';
import { MEAT_NAMES } from '../game/meats';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { nearestRuin } from '../game/ruins';
import { useGameStore } from '../game/store';
import { Player } from '../game/traits';
import { world } from '../game/world';

const WEATHER_NAMES = { clear: 'Clear sky', rain: 'Rain', snow: 'Snow' } as const;
const RUIN_NAMES = { church: 'Church', palace: 'Palace', fort: 'Fort' } as const;

function Coordinates() {
  const coordinates = useGameStore((state) => state.coordinates);
  const nearbyRuin = world.queryFirst(Player) ? nearestRuin(coordinates.x, coordinates.z, getWorldSeed(world)) : null;
  return (
    <>
      <span className="coordinates">XYZ {coordinates.x.toFixed(2)} / {coordinates.y.toFixed(2)} / {coordinates.z.toFixed(2)}</span>
      {nearbyRuin && nearbyRuin.distance < 64 && <span className="weather-info">Ruins: {RUIN_NAMES[nearbyRuin.type]} at {Math.round(nearbyRuin.distance)} m</span>}
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
      <span className="biome-info">{BIOME_NAMES[environment.biome]} · {hours}:{minutes}</span>
      <span className={`weather-info ${environment.weather}`}>{WEATHER_NAMES[environment.weather]}</span>
    </>
  );
}

export function WorldStats() {
  const blockCount = useGameStore((state) => state.blockCount);
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
    .map(([kind, count]) => `${MEAT_NAMES[kind as keyof typeof MEAT_NAMES]} ×${count}`)
    .join(' · ');

  return (
    <div className="world-stats">
      <strong className="block-count">{blockCount.toLocaleString('en-US')}</strong> loaded blocks
      <Coordinates />
      <EnvironmentInfo />
      {multiplayerEnabled && <span className={`weather-info multiplayer-hud ${multiplayerStatus}`}>{multiplayerStatus === 'online' ? `Online · ${multiplayerRoom} · ${multiplayerPlayerCount} player${multiplayerPlayerCount > 1 ? 's' : ''}` : multiplayerStatus === 'connecting' ? `Connexion · ${multiplayerRoom}` : `Offline · ${multiplayerRoom}`}</span>}
      <span className="weather-info apple-count">Apples: {apples}</span>
      <span className="weather-info meat-count">Meats: {meatSummary || 'none'}</span>
      <span className="weather-info lives-count">Lives: {lives}/10</span>
      {equippedArmor && <span className="weather-info">Armor: {equippedArmor}</span>}
      {riding && <span className="weather-info">{riding === 'car' ? 'Driving · E to exit' : riding === 'horse' ? 'On horseback · E to dismount' : `${riding === 'plane' ? 'Airplane' : riding === 'boat' ? 'Boat' : 'Train'} · ${ridingRole === 'passenger' ? 'Passenger' : 'Driver'} · E pour descendre`}</span>}
      {flying && <span className="weather-info flight-status">Flight enabled</span>}
    </div>
  );
}
