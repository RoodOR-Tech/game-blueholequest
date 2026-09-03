import { describe, expect, it } from 'vitest';
import { LOCATION_ROUTES } from './locationRoutes';
import { ROUTE_ACTIONS } from './routeActions';

describe('route action sequences', () => {
  it('provides two side-scrolling sequences for every route', () => {
    LOCATION_ROUTES.forEach((route) => {
      expect(
        ROUTE_ACTIONS.filter(
          (action) => action.locationId === route.locationId,
        ),
      ).toHaveLength(2);
    });
  });

  it('uses a distinct obstacle layout for every sequence', () => {
    const layouts = ROUTE_ACTIONS.map((action) => action.obstacleXs.join(','));
    expect(new Set(layouts).size).toBe(ROUTE_ACTIONS.length);
  });
});
