const REDUCED_EFFECTS_KEY = 'blue-hole-reduced-effects';

function readStoredFlag(key: string): boolean | undefined {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? undefined : value === 'true';
  } catch {
    return undefined;
  }
}

let reducedEffects =
  readStoredFlag(REDUCED_EFFECTS_KEY) ??
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True when screen flashes and shakes should be suppressed. */
export function isReducedEffects(): boolean {
  return reducedEffects;
}

export function setReducedEffects(value: boolean): void {
  reducedEffects = value;
  try {
    window.localStorage.setItem(REDUCED_EFFECTS_KEY, String(value));
  } catch {
    // Storage can be unavailable in private windows; the choice lasts the session.
  }
}
