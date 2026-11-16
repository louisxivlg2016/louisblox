import { translate } from './language';

export type GameplayMode = 'survival' | 'creative' | 'battle' | 'city-ancient' | 'city-modern' | 'pirates' | 'football' | 'maze';
export type WorldTemplate = 'nature' | 'city-ancient' | 'city-modern' | 'custom';

export const isCityMode = (mode: GameplayMode) => mode === 'city-ancient' || mode === 'city-modern';
export const isMinigameMode = (mode: GameplayMode) => mode === 'battle' || mode === 'pirates' || mode === 'football' || mode === 'maze';
export const isMultiplayerOnlyMode = (mode: GameplayMode) => mode === 'pirates' || mode === 'football';
export const hasTeamCombat = (mode: GameplayMode) => mode === 'battle' || mode === 'pirates';
export const CITY_LIMIT = 5000;

export const GAMEPLAY_MODE_LABELS = (): Record<GameplayMode, string> => ({
  creative: translate('Créatif', 'Creative'),
  survival: translate('Survie', 'Survival'),
  battle: translate('Bataille', 'Combat'),
  'city-ancient': translate('Ville ancienne', 'Historic City'),
  'city-modern': translate('Ville moderne', 'Modern City'),
  pirates: 'Pirates',
  football: 'Football',
  maze: translate('Course Labyrinthe', 'Maze Race'),
});

export function isGameplayMode(value: unknown): value is GameplayMode {
  return typeof value === 'string' && value in GAMEPLAY_MODE_LABELS();
}
