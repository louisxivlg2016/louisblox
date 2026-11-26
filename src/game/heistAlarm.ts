import heistAlarmUrl from '../../alarme-police.mp3';

let currentAlarm: { pause: () => void; currentTime: number } | null = null;

export function playHeistAlarm() {
  stopHeistAlarm();
  const element = new Audio(heistAlarmUrl);
  currentAlarm = element;
  element.volume = 0.85;
  void element.play().catch(() => {
  });
}

export function stopHeistAlarm() {
  if (!currentAlarm) return;
  currentAlarm.pause();
  currentAlarm.currentTime = 0;
  currentAlarm = null;
}
