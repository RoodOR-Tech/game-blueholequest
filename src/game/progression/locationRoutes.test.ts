import { describe, expect, it } from 'vitest';
import { LOCATION_ROUTES, resolveRouteChoice } from './locationRoutes';

describe('five destination routes', () => {
  it('gives every route one calamity and two environment interactions', () => {
    expect(LOCATION_ROUTES).toHaveLength(5);
    LOCATION_ROUTES.forEach((route) => {
      expect(route.events.filter((event) => event.kind === 'calamity')).toHaveLength(1);
      expect(route.events.filter((event) => event.kind === 'environment')).toHaveLength(2);
    });
  });

  it('applies choice costs and life-loss risk', () => {
    const choice = { label: 'RISK', summary: 'Risked it', lifeCost: 2, experience: 40, lifeRisk: 0.25 };
    expect(resolveRouteChoice({ life: 6, magic: 4, experience: 0, lives: 3 }, choice, 0.1)).toEqual({
      life: 4,
      magic: 4,
      experience: 40,
      lives: 2,
      lostLife: true,
    });
  });
});
