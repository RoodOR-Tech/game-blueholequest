import { describe, expect, it } from 'vitest';
import { getTeam, isTeamId, TEAMS } from './teams';

describe('team content', () => {
  it('defines five unique family teams', () => {
    expect(TEAMS).toHaveLength(5);
    expect(new Set(TEAMS.map((team) => team.id)).size).toBe(5);
  });

  it('makes every family team playable', () => {
    expect(getTeam('dad_paula').productionReady).toBe(true);
    expect(TEAMS.filter((team) => team.productionReady)).toHaveLength(5);
  });

  it('recognizes only configured team identifiers', () => {
    expect(isTeamId('jen_omar')).toBe(true);
    expect(isTeamId('unknown_team')).toBe(false);
  });
});
