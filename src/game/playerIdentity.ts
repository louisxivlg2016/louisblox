const PLAYER_ID_KEY = 'louisblox-player-id-v1';

export function playerIdentity() {
  try {
    const saved = localStorage.getItem(PLAYER_ID_KEY);
    if (saved && /^[0-9a-f-]{36}$/.test(saved)) return saved;
    const playerId = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, playerId);
    return playerId;
  } catch {
    return crypto.randomUUID();
  }
}

export function normalizePlayerName(name: string) {
  return name.trim().toLocaleLowerCase();
}
