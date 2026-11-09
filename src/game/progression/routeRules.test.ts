import { describe, expect, it } from 'vitest';
import {
  highway26GateMessage,
  isHighway26FogGateBlocked,
  LANTERN_ITEM_ID,
} from './routeRules';

describe('Highway 26 fog gate', () => {
  it('blocks the pass without the Coleman Lantern', () => {
    expect(isHighway26FogGateBlocked(3, [])).toBe(true);
  });

  it('requires both the lantern and forest relic to open the pass', () => {
    expect(isHighway26FogGateBlocked(3, [LANTERN_ITEM_ID], [])).toBe(true);
    expect(
      isHighway26FogGateBlocked(3, [LANTERN_ITEM_ID], ['relic_golden_thumb']),
    ).toBe(false);
  });

  it('allows travel before the fog gate', () => {
    expect(isHighway26FogGateBlocked(2, [])).toBe(false);
  });

  it('requires the Amber Stein to travel east of Camp 18', () => {
    expect(
      highway26GateMessage(4, [LANTERN_ITEM_ID], ['relic_golden_thumb']),
    ).toContain('AMBER STEIN');
    expect(
      highway26GateMessage(
        4,
        [LANTERN_ITEM_ID],
        ['relic_golden_thumb', 'relic_amber_stein'],
      ),
    ).toBeNull();
  });
});
