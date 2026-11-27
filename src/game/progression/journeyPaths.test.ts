import { describe, expect, it } from 'vitest';
import { BOSS_LOCATIONS } from './bossLocations';
import { JOURNEY_FRAME, journeyLayout, stopProgress } from './journeyPaths';

describe('journey map layouts', () => {
  it.each(BOSS_LOCATIONS.map((location) => location.id))(
    '%s winds through five stops inside the map frame',
    (id) => {
      const layout = journeyLayout(id);
      expect(layout.stops).toHaveLength(5);
      expect(layout.waypoints).toHaveLength(13);
      layout.waypoints.forEach((point) => {
        expect(point.x).toBeGreaterThan(JOURNEY_FRAME.x + 6);
        expect(point.x).toBeLessThan(JOURNEY_FRAME.x + JOURNEY_FRAME.width - 6);
        expect(point.y).toBeGreaterThan(JOURNEY_FRAME.y + 6);
        expect(point.y).toBeLessThan(
          JOURNEY_FRAME.y + JOURNEY_FRAME.height - 6,
        );
      });
      layout.stops.slice(1).forEach((stop, index) => {
        expect(stop.x).toBeGreaterThan(layout.stops[index]!.x);
      });
    },
  );

  it('places stops at increasing spline progress, ending at the lair', () => {
    const layout = journeyLayout('bend');
    const progress = [0, 1, 2, 3, 4].map((stop) => stopProgress(layout, stop));
    expect(progress[0]).toBe(0);
    expect(progress[4]).toBe(1);
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);
  });
});
