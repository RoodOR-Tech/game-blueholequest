import { describe, expect, it } from 'vitest';
import { createNewSave } from '../saves/schema';
import {
  awardLocationArtifact,
  BOSS_LOCATIONS,
  celebrateHomecoming,
  isLocationUnlocked,
  pendingHomecomingArtifact,
} from './bossLocations';

describe('location boss progression', () => {
  it('awards each location crystal only once', () => {
    const location = BOSS_LOCATIONS[0];
    const first = awardLocationArtifact(
      createNewSave('dad_paula'),
      location,
      'one',
    );
    const second = awardLocationArtifact(first, location, 'two');
    expect(first.relics).toContain(location.artifactId);
    expect(first.stats.experience).toBe(100);
    expect(first.checkpointId).toBe('connected_quest_route');
    expect(second.relics).toEqual(first.relics);
    expect(second.stats.experience).toBe(100);
  });

  it('celebrates a recovered artifact at home and restores health', () => {
    const location = BOSS_LOCATIONS[0];
    const damaged = awardLocationArtifact(
      createNewSave('dad_paula'),
      location,
      'one',
    );
    const homecoming = celebrateHomecoming(
      { ...damaged, resources: { ...damaged.resources, life: 1, magic: 0 } },
      location,
      'two',
    );

    expect(pendingHomecomingArtifact(damaged)).toBe(location);
    expect(pendingHomecomingArtifact(homecoming)).toBeUndefined();
    expect(homecoming.resources.life).toBe(homecoming.resources.maxLife);
    expect(homecoming.resources.magic).toBe(homecoming.resources.maxMagic);
    expect(homecoming.checkpointId).toBe('rockaway_blue_hole');
  });

  it('unlocks locations in crystal order', () => {
    expect(isLocationUnlocked(0, [])).toBe(true);
    expect(isLocationUnlocked(1, [])).toBe(false);
    expect(isLocationUnlocked(1, [BOSS_LOCATIONS[0].artifactId])).toBe(true);
  });
});
