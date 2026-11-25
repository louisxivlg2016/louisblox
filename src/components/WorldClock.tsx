import { useGameStore } from '../game/store';
import { worldClockAt } from '../game/worldClock';
import { translate } from '../game/language';

export function WorldClock() {
  const dayProgress = useGameStore((state) => state.environment.dayProgress);
  const clock = worldClockAt(dayProgress);
  const period = clock.period === 'night' ? translate('Nuit', 'Night', 'Noche') : clock.period === 'morning' ? translate('Matin', 'Morning', 'Mañana') : clock.period === 'afternoon' ? translate('Après-midi', 'Afternoon', 'Tarde') : translate('Soir', 'Evening', 'Noche');
  return (
    <div className={`world-clock ${clock.period}`} data-world-clock aria-label={`${clock.time} · ${period}`}>
      <strong>{clock.time}</strong>
      <span data-world-period>{period}</span>
    </div>
  );
}
