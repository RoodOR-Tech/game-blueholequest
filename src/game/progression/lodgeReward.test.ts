import { describe, expect, it } from 'vitest';
import { createNewSave } from '../saves/schema';
import { awardLodgeRelic, LODGE_RELIC_ID } from './lodgeReward';

describe('awardLodgeRelic', () => {
  it('awards the Amber Stein and 90 experience only once', () => {
    const first = awardLodgeRelic(createNewSave('dad_paula'), 'first');
    const second = awardLodgeRelic(first, 'second');
    expect(first.relics).toContain(LODGE_RELIC_ID);
    expect(first.stats.experience).toBe(90);
    expect(second.relics).toEqual([LODGE_RELIC_ID]);
    expect(second.stats.experience).toBe(90);
  });
});
