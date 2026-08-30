import { describe, expect, it } from 'vitest';
import { createNewSave } from '../saves/schema';
import {
  awardLocationCrystal,
  BOSS_LOCATIONS,
  isLocationUnlocked,
} from './bossLocations';

describe('location boss progression', () => {
  it('awards each location crystal only once', () => {
    const location = BOSS_LOCATIONS[0];
    const first = awardLocationCrystal(createNewSave('dad_paula'), location, 'one');
    const second = awardLocationCrystal(first, location, 'two');
    expect(first.relics).toContain(location.crystalId);
    expect(first.stats.experience).toBe(100);
    expect(first.checkpointId).toBe('connected_quest_route');
    expect(second.relics).toEqual(first.relics);
    expect(second.stats.experience).toBe(100);
  });

  it('unlocks locations in crystal order', () => {
    expect(isLocationUnlocked(0, [])).toBe(true);
    expect(isLocationUnlocked(1, [])).toBe(false);
    expect(isLocationUnlocked(1, [BOSS_LOCATIONS[0].crystalId])).toBe(true);
  });
});
