import type { BossLocationId } from './bossLocations';

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

/** The journey map panel, in world pixels. */
export const JOURNEY_FRAME = { x: 8, y: 26, width: 240, height: 168 } as const;

/**
 * Stops on each route: the start, three events and the boss lair. They zig-zag
 * so the trail has to wind through the region instead of running straight.
 */
const STOPS: Readonly<Record<BossLocationId, readonly MapPoint[]>> = {
  hillsboro_west: [
    { x: 28, y: 170 },
    { x: 72, y: 112 },
    { x: 134, y: 158 },
    { x: 176, y: 92 },
    { x: 216, y: 56 },
  ],
  hillsboro_east: [
    { x: 26, y: 92 },
    { x: 80, y: 158 },
    { x: 132, y: 86 },
    { x: 182, y: 156 },
    { x: 220, y: 64 },
  ],
  milwaukie: [
    { x: 26, y: 72 },
    { x: 74, y: 150 },
    { x: 128, y: 84 },
    { x: 176, y: 164 },
    { x: 220, y: 104 },
  ],
  walla_walla: [
    { x: 28, y: 166 },
    { x: 66, y: 80 },
    { x: 130, y: 138 },
    { x: 178, y: 64 },
    { x: 220, y: 150 },
  ],
  bend: [
    { x: 26, y: 118 },
    { x: 70, y: 160 },
    { x: 120, y: 86 },
    { x: 174, y: 160 },
    { x: 216, y: 70 },
  ],
};

/** Sideways swing of the trail between stops, in world pixels. */
const WINDING = 13;
/** Waypoints inserted between each pair of stops. */
const BENDS = 2;

export interface JourneyLayout {
  readonly stops: readonly MapPoint[];
  /** Stops plus bends, in travel order, for a smooth spline. */
  readonly waypoints: readonly MapPoint[];
  /** Index into waypoints for each stop. */
  readonly stopWaypoint: readonly number[];
}

export function journeyLayout(locationId: BossLocationId): JourneyLayout {
  const stops = STOPS[locationId];
  const waypoints: MapPoint[] = [];
  const stopWaypoint: number[] = [];
  stops.forEach((stop, index) => {
    stopWaypoint.push(waypoints.length);
    waypoints.push(stop);
    const next = stops[index + 1];
    if (!next) return;
    const dx = next.x - stop.x;
    const dy = next.y - stop.y;
    const length = Math.hypot(dx, dy) || 1;
    // Perpendicular swing: one bend each way gives an S through the terrain.
    const nx = -dy / length;
    const ny = dx / length;
    for (let bend = 1; bend <= BENDS; bend += 1) {
      const t = bend / (BENDS + 1);
      const side = (bend % 2 === 1 ? 1 : -1) * (index % 2 === 0 ? 1 : -1);
      waypoints.push({
        x: stop.x + dx * t + nx * WINDING * side,
        y: stop.y + dy * t + ny * WINDING * side,
      });
    }
  });
  return { stops, waypoints, stopWaypoint };
}

/** Spline position (0–1) of a stop, for curves through every waypoint. */
export function stopProgress(layout: JourneyLayout, stop: number): number {
  const index = layout.stopWaypoint[stop] ?? 0;
  return index / Math.max(1, layout.waypoints.length - 1);
}
