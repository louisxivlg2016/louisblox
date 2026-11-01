export type GameplayMode = 'survival' | 'creative' | 'battle' | 'city-ancient' | 'city-modern';

export const isCityMode = (mode: GameplayMode) => mode === 'city-ancient' || mode === 'city-modern';
export const CITY_LIMIT = 5000;
