import { clearPirates, receivePirateInventory, receivePirateState, setPirateSocket } from './piratesClient';
import { clearFootball, receiveFootballSpawn, receiveFootballState, setFootballSocket } from './footballClient';
import { clearMaze, receiveMazeSpawn, receiveMazeState, setMazeSocket } from './mazeClient';

export function setMinigameSocket(socket: WebSocket | null) {
  setPirateSocket(socket);
  setFootballSocket(socket);
  setMazeSocket(socket);
}

export function clearMinigames() {
  clearPirates();
  clearFootball();
  clearMaze();
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
  else return false;
  return true;
}
