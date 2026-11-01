export type GameplayMode = 'survival' | 'creative' | 'battle' | 'city-ancient' | 'city-modern';

export const isCityMode = (mode: GameplayMode) => mode === 'city-ancient' || mode === 'city-modern';
export const CITY_LIMIT = 5000;

export const GAMEPLAY_MODE_LABELS: Record<GameplayMode, string> = {
  creative: 'Créatif',
  survival: 'Survie',
  battle: 'Bataille',
  'city-ancient': 'Ville ancienne',
  'city-modern': 'Ville moderne',
};

export function isGameplayMode(value: unknown): value is GameplayMode {
  return typeof value === 'string' && value in GAMEPLAY_MODE_LABELS;
}
