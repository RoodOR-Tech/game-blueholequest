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
    title: 'HILLSBORO WEST',
    subtitle:
      'Fog pours off the Coast Range and swallows the firs. Something in the Silicon Forest is watching the road.',
    progress: 'DESTINATION 1 OF 5',
  },
  hillsboro_east: {
    locationId: 'hillsboro_east',
    title: 'HILLSBORO EAST',
    subtitle:
      'Storm clouds stack over the city. Every tower crackles with a charge that is not natural.',
    progress: 'DESTINATION 2 OF 5',
  },
  milwaukie: {
    locationId: 'milwaukie',
    title: 'MILWAUKIE',
    subtitle:
      'Cold mist rides the Willamette. Beneath the old iron bridge, the river has started to move on its own.',
    progress: 'DESTINATION 3 OF 5',
  },
  walla_walla: {
    locationId: 'walla_walla',
    title: 'WALLA WALLA',
    subtitle:
      'Wind rakes the golden wheat and rattles the vines. On the far hill, the oldest vine has opened its eyes.',
    progress: 'DESTINATION 4 OF 5',
  },
  bend: {
    locationId: 'bend',
    title: 'BEND',
    subtitle:
      'Ash drifts over the high desert and the snow is melting from the inside. The mountain is awake.',
    progress: 'FINAL DESTINATION',
  },
};

export function locationArrivalFlag(locationId: BossLocationId): string {
  return `location_arrival_${locationId}`;
}
