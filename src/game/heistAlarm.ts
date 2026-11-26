import heistAlarmUrl from '../../alarme-police.mp3';

export function playHeistAlarm() {
  const element = new Audio(heistAlarmUrl);
  element.volume = 0.85;
  void element.play().catch(() => {
  });
}
