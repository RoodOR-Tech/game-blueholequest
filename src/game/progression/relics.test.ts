import { describe, expect, it } from 'vitest';
import { recoveredRelicCount } from './relics';

describe('recoveredRelicCount', () => {
  it('counts only canonical relics and ignores duplicates', () => {
    expect(
      recoveredRelicCount([
        'relic_golden_thumb',
        'relic_golden_thumb',
        'unknown_relic',
        'relic_emerald_leaf',
      ]),
    ).toBe(2);
  });
});

