import type { BossLocationId } from './bossLocations';

export interface LocationArrival {
  readonly locationId: BossLocationId;
  readonly title: string;
  readonly subtitle: string;
  readonly progress: string;
}

export const LOCATION_ARRIVALS: Readonly<
  Record<BossLocationId, LocationArrival>
> = {
  hillsboro_west: {
    locationId: 'hillsboro_west',
    title: 'ENTERING HILLSBORO WEST',
    subtitle: 'Beyond the fog, something moves between the pines.',
    progress: 'DESTINATION 1 OF 5',
  },
  hillsboro_east: {
    locationId: 'hillsboro_east',
    title: 'ENTERING HILLSBORO EAST',
    subtitle: 'Power lines hum above the waking city.',
    progress: 'DESTINATION 2 OF 5',
  },
  milwaukie: {
    locationId: 'milwaukie',
    title: 'ENTERING MILWAUKIE',
    subtitle: 'Cold river mist curls beneath the old bridge.',
    progress: 'DESTINATION 3 OF 5',
  },
  walla_walla: {
    locationId: 'walla_walla',
    title: 'ENTERING WALLA WALLA',
    subtitle: 'A restless wind races across the golden fields.',
    progress: 'DESTINATION 4 OF 5',
  },
  bend: {
    locationId: 'bend',
    title: 'ENTERING BEND',
    subtitle: 'The high desert glows beneath a volcanic sky.',
    progress: 'FINAL DESTINATION',
  },
};

export function locationArrivalFlag(locationId: BossLocationId): string {
  return `location_arrival_${locationId}`;
}
