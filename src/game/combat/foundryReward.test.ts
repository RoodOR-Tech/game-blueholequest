import { describe, expect, it } from 'vitest';
import { createNewSave } from '../saves/schema';
import { awardFoundryVictory } from './foundryReward';

describe('awardFoundryVictory', () => {
  it('grants Power Wrench and 100 experience on the first victory', () => {
    const result = awardFoundryVictory(createNewSave('dad_paula'), 'victory');
    expect(result.firstVictory).toBe(true);
    expect(result.save.stats.experience).toBe(100);
    expect(result.save.techniques).toContain('power_wrench');
    expect(result.save.flags.foundry_drone_defeated).toBe(true);
  });

  it('does not grant the reward twice', () => {
    const first = awardFoundryVictory(createNewSave('dad_paula'), 'first');
    const second = awardFoundryVictory(first.save, 'second');
    expect(second.firstVictory).toBe(false);
    expect(second.save.stats.experience).toBe(100);
    expect(second.save.techniques).toEqual(['power_wrench']);
  });
});

