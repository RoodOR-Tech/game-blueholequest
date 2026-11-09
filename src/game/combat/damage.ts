export interface HealthState {
  readonly current: number;
  readonly maximum: number;
}

export interface DamageResult {
  readonly health: HealthState;
  readonly defeated: boolean;
  readonly damageApplied: number;
}

export function applyDamage(
  health: HealthState,
  requestedDamage: number,
): DamageResult {
  const damage = Math.max(0, Math.floor(requestedDamage));
  const current = Math.max(0, Math.min(health.maximum, health.current));
  const next = Math.max(0, current - damage);
  return {
    health: { current: next, maximum: health.maximum },
    defeated: next === 0,
    damageApplied: current - next,
  };
}

