import { isNightProgress } from './dayNight';

export function worldClockAt(progress: number) {
  const normalized = ((progress % 1) + 1) % 1;
  const totalMinutes = Math.floor(normalized * 24 * 60 + 0.000001) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = isNightProgress(normalized) ? 'night' : normalized < 0.5 ? 'morning' : normalized < 0.68 ? 'afternoon' : 'evening';
  return { time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, period } as const;
}
