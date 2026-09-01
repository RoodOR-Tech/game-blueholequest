import { describe, expect, it } from 'vitest';
import { BOSS_LOCATIONS } from './bossLocations';
import { LOCATION_ARRIVALS, locationArrivalFlag } from './locationArrivals';

describe('location arrival scenes', () => {
  it('defines a unique arrival for every destination', () => {
    const ids = BOSS_LOCATIONS.map((location) => location.id);
    expect(Object.keys(LOCATION_ARRIVALS)).toEqual(ids);
    expect(new Set(ids.map(locationArrivalFlag)).size).toBe(ids.length);
  });
});
