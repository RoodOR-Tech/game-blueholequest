import type { BossLocationId } from './bossLocations';

export interface RouteActionDefinition {
  readonly id: string;
  readonly locationId: BossLocationId;
  readonly eventIndex: 1 | 2;
  readonly title: string;
  readonly terrain: string;
  readonly skyColor: number;
  readonly groundColor: number;
  readonly accentColor: number;
  readonly obstacleXs: readonly number[];
  readonly enemyXs: readonly number[];
  readonly flyingEnemyXs: readonly number[];
}

export const ROUTE_ACTIONS: readonly RouteActionDefinition[] = [
  {
    id: 'west_thicket',
    locationId: 'hillsboro_west',
    eventIndex: 1,
    title: 'BLACKBERRY BREAKOUT',
    terrain: 'THORNY FOREST',
    skyColor: 0x496d52,
    groundColor: 0x31472f,
    accentColor: 0x8e3f73,
    obstacleXs: [142, 271, 386],
    enemyXs: [205, 348],
    flyingEnemyXs: [],
  },
  {
    id: 'west_detour',
    locationId: 'hillsboro_west',
    eventIndex: 2,
    title: 'CONSTRUCTION DETOUR',
    terrain: 'BROKEN HIGHWAY',
    skyColor: 0x7a8791,
    groundColor: 0x4b4d4f,
    accentColor: 0xf0a23b,
    obstacleXs: [118, 212, 325, 421],
    enemyXs: [170, 374],
    flyingEnemyXs: [286],
  },
  {
    id: 'east_power',
    locationId: 'hillsboro_east',
    eventIndex: 1,
    title: 'POWER CORRIDOR',
    terrain: 'STORM GRID',
    skyColor: 0x33465f,
    groundColor: 0x263643,
    accentColor: 0xffd95a,
    obstacleXs: [155, 303, 403],
    enemyXs: [229],
    flyingEnemyXs: [188, 359],
  },
  {
    id: 'east_wetlands',
    locationId: 'hillsboro_east',
    eventIndex: 2,
    title: 'WETLANDS RUN',
    terrain: 'FLOODED MARSH',
    skyColor: 0x668b91,
    groundColor: 0x38594c,
    accentColor: 0x62c8d3,
    obstacleXs: [126, 244, 365],
    enemyXs: [190, 320, 430],
    flyingEnemyXs: [],
  },
  {
    id: 'milwaukie_bank',
    locationId: 'milwaukie',
    eventIndex: 1,
    title: 'RIVERBANK SCRAMBLE',
    terrain: 'WILLAMETTE EDGE',
    skyColor: 0x6ba7bd,
    groundColor: 0x6d593c,
    accentColor: 0x4dd2dc,
    obstacleXs: [164, 286, 408],
    enemyXs: [231, 361],
    flyingEnemyXs: [331],
  },
  {
    id: 'milwaukie_rail',
    locationId: 'milwaukie',
    eventIndex: 2,
    title: 'RAIL YARD RUSH',
    terrain: 'FREIGHT MAZE',
    skyColor: 0x697079,
    groundColor: 0x453f3b,
    accentColor: 0xc45d3f,
    obstacleXs: [105, 181, 280, 359, 438],
    enemyXs: [147, 325],
    flyingEnemyXs: [],
  },
  {
    id: 'walla_wheat',
    locationId: 'walla_walla',
    eventIndex: 1,
    title: 'WHEATFIELD CHARGE',
    terrain: 'WINDSWEPT FIELD',
    skyColor: 0x8dc5d3,
    groundColor: 0xb48b3e,
    accentColor: 0xf4d45c,
    obstacleXs: [173, 315, 417],
    enemyXs: [233, 376],
    flyingEnemyXs: [279],
  },
  {
    id: 'walla_vines',
    locationId: 'walla_walla',
    eventIndex: 2,
    title: 'VINEYARD MAZE',
    terrain: 'GRAPE ROWS',
    skyColor: 0x86a16f,
    groundColor: 0x59432f,
    accentColor: 0x763f88,
    obstacleXs: [118, 220, 342, 431],
    enemyXs: [174, 291, 390],
    flyingEnemyXs: [],
  },
  {
    id: 'bend_lava',
    locationId: 'bend',
    eventIndex: 1,
    title: 'LAVA FIELD LEAP',
    terrain: 'VOLCANIC FLOW',
    skyColor: 0x6d6370,
    groundColor: 0x29262a,
    accentColor: 0xff663d,
    obstacleXs: [111, 202, 298, 389, 451],
    enemyXs: [160, 347],
    flyingEnemyXs: [252],
  },
  {
    id: 'bend_canyon',
    locationId: 'bend',
    eventIndex: 2,
    title: 'CANYON CROSSING',
    terrain: 'HIGH DESERT',
    skyColor: 0xd18b5a,
    groundColor: 0x70452f,
    accentColor: 0xffc16b,
    obstacleXs: [145, 263, 372, 442],
    enemyXs: [211, 330, 414],
    flyingEnemyXs: [],
  },
] as const;

export function routeActionFor(
  locationId: BossLocationId,
  eventIndex: 1 | 2,
): RouteActionDefinition {
  const action = ROUTE_ACTIONS.find(
    (candidate) =>
      candidate.locationId === locationId &&
      candidate.eventIndex === eventIndex,
  );
  if (!action)
    throw new Error(`Missing route action for ${locationId} ${eventIndex}`);
  return action;
}
