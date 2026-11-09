import { describe, expect, it } from 'vitest';
import { createNewSave } from '../saves/schema';
import { awardForestRelic, FOREST_RELIC_ID } from './forestReward';

describe('awardForestRelic', () => {
  it('grants the first relic and experience once', () => {
    const first = awardForestRelic(createNewSave('dad_paula'), 'first');
    const second = awardForestRelic(first, 'second');
    expect(first.relics).toContain(FOREST_RELIC_ID);
    expect(first.stats.experience).toBe(75);
    expect(first.flags.forest_fog_warden_defeated).toBe(true);
    expect(second.relics).toEqual([FOREST_RELIC_ID]);
    expect(second.stats.experience).toBe(75);
  });
});

