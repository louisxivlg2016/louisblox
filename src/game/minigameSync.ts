import { clearPirates, receivePirateInventory, receivePirateState, setPirateSocket } from './piratesClient';
import { clearFootball, receiveFootballSpawn, receiveFootballState, setFootballSocket } from './footballClient';
import { clearMaze, receiveMazeSpawn, receiveMazeState, setMazeSocket } from './mazeClient';
import { clearHeist, receiveHeistPrison, receiveHeistState, receiveHeistTaser, setHeistSocket } from './heistClient';
import { clearDelivery } from './deliveryClient';
import { clearSkyfall } from './skyfallClient';
import { clearPlanet } from './planetClient';
import { clearDeep } from './deepClient';
import { clearRoleplay } from './roleplayClient';

export function setMinigameSocket(socket: WebSocket | null) {
  setPirateSocket(socket);
  setFootballSocket(socket);
  setMazeSocket(socket);
  setHeistSocket(socket);
}

export function clearMinigames() {
  clearPirates();
  clearFootball();
  clearMaze();
  clearHeist();
  clearDelivery();
  clearSkyfall();
  clearPlanet();
  clearDeep();
  clearRoleplay();
}

export function receiveMinigameMessage(data: unknown) {
  if (!data || typeof data !== 'object') return false;
  const type = (data as { type?: unknown }).type;
  if (type === 'pirates-state') receivePirateState(data);
  else if (type === 'pirates-inventory') receivePirateInventory(data);
  else if (type === 'football-state') receiveFootballState(data);
  else if (type === 'football-spawn') receiveFootballSpawn(data);
  else if (type === 'maze-state') receiveMazeState(data);
  else if (type === 'maze-spawn') receiveMazeSpawn(data);
  else if (type === 'heist-state') receiveHeistState(data);
  else if (type === 'heist-prison') receiveHeistPrison();
  else if (type === 'heist-taser') receiveHeistTaser();
  else return false;
  return true;
}
