import { describe, expect, it } from 'vitest';
import { recoveredRelicCount } from './relics';

describe('recoveredRelicCount', () => {
  it('counts only canonical relics and ignores duplicates', () => {
    expect(
      recoveredRelicCount([
        'crystal_hillsboro_west',
        'crystal_hillsboro_west',
        'unknown_relic',
        'crystal_walla_walla',
      ]),
    ).toBe(2);
  });
});
