export function turnToward(current: number, target: number, maxDelta: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + Math.max(-maxDelta, Math.min(maxDelta, delta));
}
