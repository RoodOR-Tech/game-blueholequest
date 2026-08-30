import { describe, expect, it } from 'vitest';
import { getTeam, TEAMS } from './teams';

describe('team content', () => {
  it('defines five unique family teams', () => {
    expect(TEAMS).toHaveLength(5);
    expect(new Set(TEAMS.map((team) => team.id)).size).toBe(5);
  });

  it('makes every family team playable', () => {
    expect(getTeam('dad_paula').productionReady).toBe(true);
    expect(TEAMS.filter((team) => team.productionReady)).toHaveLength(5);
  });
});
