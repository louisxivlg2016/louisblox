import { useGameStore } from '../game/store';
import { calendarAt, worldClockAt } from '../game/worldClock';
import { translate } from '../game/language';

type IconName = 'sun' | 'sunCloud' | 'moon' | 'rain' | 'snow' | 'spring' | 'summer' | 'autumn' | 'winter';

function ClockIcon({ name, weather = false }: { name: IconName; weather?: boolean }) {
  return (
    <svg className={weather ? 'world-clock-icon world-weather-icon' : 'world-clock-icon'} data-clock-icon={name} viewBox="0 0 24 24" aria-hidden="true">
      {name === 'sun' || name === 'summer' ? <>
        <circle cx="12" cy="12" r="4.2" fill="#ffd85a" />
        <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" fill="none" stroke="#ffd85a" strokeWidth="1.8" strokeLinecap="round" />
      </> : name === 'sunCloud' ? <>
        <circle cx="8" cy="8" r="3.5" fill="#ffd85a" />
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M3.4 12.6l1.4-1.4" fill="none" stroke="#ffd85a" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M7 18.5h11.5a3.5 3.5 0 0 0 .3-7 5.2 5.2 0 0 0-9.7-1.4A4.2 4.2 0 0 0 7 18.5Z" fill="#dce8f1" stroke="#9db3c4" strokeWidth=".7" />
      </> : name === 'moon' ? <>
        <path d="M18.8 15.7A7.4 7.4 0 0 1 8.3 5.2a7.4 7.4 0 1 0 10.5 10.5Z" fill="#e5edff" />
        <path d="m17.5 3 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" fill="#fff3a5" />
      </> : name === 'rain' ? <>
        <path d="M5 14.5h13.5a3.5 3.5 0 0 0 .3-7A5.2 5.2 0 0 0 9.1 6.1 4.2 4.2 0 0 0 5 14.5Z" fill="#b7cad8" />
        <path d="m7 17-1 3M12 17l-1 3M17 17l-1 3" stroke="#64bde8" strokeWidth="1.8" strokeLinecap="round" />
      </> : name === 'snow' || name === 'winter' ? <>
        <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8.5 3.5 12 7l3.5-3.5M8.5 20.5 12 17l3.5 3.5M3.5 10.5 8 12l-4.5 1.5M20.5 10.5 16 12l4.5 1.5" fill="none" stroke="#d9f3ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </> : name === 'spring' ? <>
        <path d="M12 21V11" stroke="#65a85b" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 16c-4 1-6-1-6-4 4-1 6 1 6 4ZM12 14c4 1 6-1 6-4-4-1-6 1-6 4Z" fill="#72b85e" />
        <circle cx="12" cy="7" r="2.2" fill="#ffd85a" />
        <circle cx="12" cy="3.8" r="2.5" fill="#f3a6c8" /><circle cx="12" cy="10.2" r="2.5" fill="#f3a6c8" /><circle cx="8.8" cy="7" r="2.5" fill="#f3a6c8" /><circle cx="15.2" cy="7" r="2.5" fill="#f3a6c8" />
      </> : <>
        <path d="M19.5 3.5C11 3 5.5 7 6 13c.5 5.5 7 7 10 3 3-3 3.5-8 3.5-12.5Z" fill="#e89a45" />
        <path d="M4 21 16 7M8 16l-1-5M12 12l5 .5" stroke="#9c5c32" strokeWidth="1.5" strokeLinecap="round" />
      </>}
    </svg>
  );
}

const MONTHS = () => [
  translate('janvier', 'January', 'enero'), translate('février', 'February', 'febrero'), translate('mars', 'March', 'marzo'),
  translate('avril', 'April', 'abril'), translate('mai', 'May', 'mayo'), translate('juin', 'June', 'junio'),
  translate('juillet', 'July', 'julio'), translate('août', 'August', 'agosto'), translate('septembre', 'September', 'septiembre'),
  translate('octobre', 'October', 'octubre'), translate('novembre', 'November', 'noviembre'), translate('décembre', 'December', 'diciembre'),
];

export function WorldClock() {
  const dayProgress = useGameStore((state) => state.environment.dayProgress);
  const weather = useGameStore((state) => state.environment.weather);
  const elapsed = useGameStore((state) => state.environment.elapsed);
  const clock = worldClockAt(dayProgress);
  const calendar = calendarAt(elapsed);
  const period = clock.period === 'night' ? translate('Nuit', 'Night', 'Noche') : clock.period === 'morning' ? translate('Matin', 'Morning', 'Mañana') : clock.period === 'afternoon' ? translate('Après-midi', 'Afternoon', 'Tarde') : translate('Soir', 'Evening', 'Noche');
  const periodIcon = clock.period === 'night' ? 'moon' : clock.period === 'morning' ? 'sun' : 'sunCloud';
  const season = calendar.season === 'spring' ? translate('Printemps', 'Spring', 'Primavera') : calendar.season === 'summer' ? translate('Été', 'Summer', 'Verano') : calendar.season === 'autumn' ? translate('Automne', 'Autumn', 'Otoño') : translate('Hiver', 'Winter', 'Invierno');
  const date = `${calendar.day} ${MONTHS()[calendar.monthIndex]}`;
  const year = `${translate('An', 'Year', 'Año')} ${calendar.year}`;
  const weatherLabel = weather === 'rain' ? translate('Pluie', 'Rain', 'Lluvia') : weather === 'snow' ? translate('Neige', 'Snow', 'Nieve') : '';
  return (
    <div className={`world-clock ${clock.period}`} data-world-clock aria-label={`${clock.time} · ${period} · ${weatherLabel} · ${season} · ${date} · ${year}`}>
      <span data-clock-period-icon><ClockIcon name={periodIcon} /></span>
      <strong>{clock.time}</strong>
      <span data-world-period>{period}</span>
      {weather !== 'clear' && <span data-weather-icon title={weatherLabel}><ClockIcon name={weather} weather /></span>}
      <div className="world-calendar">
        <span className="world-season" data-season={calendar.season}><ClockIcon name={calendar.season} /><span>{season}</span></span>
        <span data-calendar-date>{date}</span>
        <span data-calendar-year>{year}</span>
      </div>
    </div>
  );
}
