import { describe, expect, it } from 'vitest';
import { resolveWilsonRiverChoice } from './wilsonRiver';

describe('Wilson River calamity', () => {
  const state = { life: 6, magic: 4, experience: 10 };

  it('trades life for the largest experience reward when fording', () => {
    expect(resolveWilsonRiverChoice(state, 'ford_traffic')).toMatchObject({
      life: 4,
      magic: 4,
      experience: 60,
      flag: 'calamity_wilson_river_choice_ford_traffic',
    });
  });

  it('trades magic for experience when floating the Subaru', () => {
    expect(resolveWilsonRiverChoice(state, 'float_subaru')).toMatchObject({
      life: 6,
      magic: 2,
      experience: 35,
      flag: 'calamity_wilson_river_choice_float_subaru',
    });
  });

  it('keeps resources intact when waiting for ODOT', () => {
    expect(resolveWilsonRiverChoice(state, 'wait_odot')).toMatchObject(state);
  });

  it('never reduces life below one or magic below zero', () => {
    expect(
      resolveWilsonRiverChoice({ ...state, life: 1 }, 'ford_traffic').life,
    ).toBe(1);
    expect(
      resolveWilsonRiverChoice({ ...state, magic: 1 }, 'float_subaru').magic,
    ).toBe(0);
  });
});

