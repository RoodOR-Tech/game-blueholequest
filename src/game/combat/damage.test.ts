import { describe, expect, it } from 'vitest';
import { applyDamage } from './damage';

describe('applyDamage', () => {
  it('reduces health without passing zero', () => {
    expect(applyDamage({ current: 2, maximum: 3 }, 5)).toEqual({
      health: { current: 0, maximum: 3 },
      defeated: true,
      damageApplied: 2,
    });
  });

  it('normalizes fractional and negative damage', () => {
    expect(applyDamage({ current: 3, maximum: 3 }, 1.9).health.current).toBe(2);
    expect(applyDamage({ current: 3, maximum: 3 }, -2).health.current).toBe(3);
  });
});

