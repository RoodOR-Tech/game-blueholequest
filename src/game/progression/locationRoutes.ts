import { BOSS_LOCATIONS, type BossLocationId } from './bossLocations';

export interface RouteChoice {
  readonly label: string;
  readonly summary: string;
  readonly lifeCost?: number;
  readonly magicCost?: number;
  readonly experience?: number;
  readonly lifeRisk?: number;
}

export interface RouteEvent {
  readonly id: string;
  readonly kind: 'calamity' | 'environment';
  readonly title: string;
  readonly description: string;
  readonly choices: readonly [RouteChoice, RouteChoice];
}

export interface LocationRoute {
  readonly locationId: BossLocationId;
  readonly origin: string;
  readonly label: string;
  readonly events: readonly [RouteEvent, RouteEvent, RouteEvent];
}

const event = (
  id: string,
  kind: RouteEvent['kind'],
  title: string,
  description: string,
  risky: string,
  careful: string,
): RouteEvent => ({
  id,
  kind,
  title,
  description,
  choices: [
    {
      label: risky,
      summary: 'You push through and gain valuable experience.',
      lifeCost: kind === 'calamity' ? 2 : 1,
      experience: kind === 'calamity' ? 45 : 25,
      lifeRisk: kind === 'calamity' ? 0.2 : 0,
    },
    {
      label: careful,
      summary: 'You take the safer route and conserve your strength.',
      magicCost: kind === 'calamity' ? 1 : 0,
      experience: 10,
      lifeRisk: 0,
    },
  ],
});

export const LOCATION_ROUTES: readonly LocationRoute[] = [
  {
    locationId: 'hillsboro_west',
    origin: 'ROCKAWAY BEACH',
    label: 'HILLSBORO WEST ROUTE',
    events: [
      event('flooded_underpass', 'calamity', 'FLOODED UNDERPASS', 'Storm water covers the road ahead.', 'WADE THROUGH', 'CLIMB THE EMBANKMENT'),
      event('blackberry_thicket', 'environment', 'BLACKBERRY THICKET', 'Thorny vines have swallowed the trail.', 'CUT A PATH', 'FOLLOW THE DEER TRACK'),
      event('construction_detour', 'environment', 'CONSTRUCTION DETOUR', 'Broken concrete and equipment block the way.', 'SCRAMBLE OVER', 'SEARCH FOR A SIDE ROAD'),
    ],
  },
  {
    locationId: 'hillsboro_east',
    origin: 'HILLSBORO WEST',
    label: 'HILLSBORO EAST ROUTE',
    events: [
      event('ice_storm', 'calamity', 'ICE STORM', 'Freezing rain turns the route into glass.', 'CROSS QUICKLY', 'WAIT UNDER COVER'),
      event('power_corridor', 'environment', 'POWER CORRIDOR', 'Fallen branches spark beside the path.', 'DASH THROUGH', 'CIRCLE AROUND'),
      event('wetlands_crossing', 'environment', 'WETLANDS CROSSING', 'Deep mud hides the safest footing.', 'LEAP THE POOLS', 'TEST EACH STEP'),
    ],
  },
  {
    locationId: 'milwaukie',
    origin: 'HILLSBORO EAST',
    label: 'MILWAUKIE ROUTE',
    events: [
      event('river_flood', 'calamity', 'WILLAMETTE FLOOD', 'The river has surged across the low road.', 'FORD THE WATER', 'BUILD A RAFT'),
      event('riverbank_trail', 'environment', 'RIVERBANK TRAIL', 'A washed-out bank narrows to a ledge.', 'EDGE ACROSS', 'CLIMB ABOVE IT'),
      event('rail_yard', 'environment', 'RAIL YARD', 'Parked freight cars form a steel maze.', 'CLIMB BETWEEN CARS', 'FOLLOW THE SIGNALS'),
    ],
  },
  {
    locationId: 'walla_walla',
    origin: 'MILWAUKIE',
    label: 'WALLA WALLA ROUTE',
    events: [
      event('dust_storm', 'calamity', 'DUST STORM', 'A wall of dust erases the horizon.', 'PRESS FORWARD', 'MAKE A SHELTER'),
      event('wheat_field', 'environment', 'WHEAT FIELD', 'The wind has flattened every landmark.', 'FOLLOW THE WIND', 'MARK A COMPASS LINE'),
      event('vineyard_maze', 'environment', 'VINEYARD MAZE', 'Endless rows twist toward the hills.', 'CUT BETWEEN ROWS', 'FOLLOW THE IRRIGATION'),
    ],
  },
  {
    locationId: 'bend',
    origin: 'WALLA WALLA',
    label: 'BEND ROUTE',
    events: [
      event('wildfire_smoke', 'calamity', 'WILDFIRE SMOKE', 'Smoke rolls across the high desert.', 'RUN THE CLEARING', 'WRAP UP AND WAIT'),
      event('lava_field', 'environment', 'LAVA FIELD', 'Jagged black rock tears at every step.', 'BOUND ACROSS', 'FIND THE OLD FLOW'),
      event('desert_canyon', 'environment', 'DESERT CANYON', 'A narrow canyon channels fierce wind.', 'CLIMB THE RIDGE', 'TAKE THE CANYON FLOOR'),
    ],
  },
] as const;

export interface RouteEventState {
  readonly life: number;
  readonly magic: number;
  readonly experience: number;
  readonly lives: number;
}

export function routeEventFlag(
  locationId: BossLocationId,
  eventId: string,
): string {
  return `route_${locationId}_${eventId}_resolved`;
}

export function resolveRouteChoice(
  state: RouteEventState,
  choice: RouteChoice,
  roll: number,
): RouteEventState & { readonly lostLife: boolean } {
  const lostLife = roll < (choice.lifeRisk ?? 0);
  return {
    life: Math.max(1, state.life - (choice.lifeCost ?? 0)),
    magic: Math.max(0, state.magic - (choice.magicCost ?? 0)),
    experience: state.experience + (choice.experience ?? 0),
    lives: Math.max(0, state.lives - (lostLife ? 1 : 0)),
    lostLife,
  };
}

export function routeForLocation(locationId: BossLocationId): LocationRoute {
  const route =
    LOCATION_ROUTES.find((candidate) => candidate.locationId === locationId) ??
    LOCATION_ROUTES[0];
  if (!route) throw new Error('No location routes are configured');
  return route;
}

export function completedRouteCount(relics: readonly string[]): number {
  return BOSS_LOCATIONS.filter((location) =>
    relics.includes(location.artifactId),
  ).length;
}
