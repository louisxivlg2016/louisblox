export function readModeProgress<T extends object>(mode: string, worldId: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(`louisblox-${mode}-progress-${worldId}`) ?? 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? { ...fallback, ...value } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

export function writeModeProgress(mode: string, worldId: string, value: object) {
  try {
    localStorage.setItem(`louisblox-${mode}-progress-${worldId}`, JSON.stringify(value));
  } catch {
  }
}
