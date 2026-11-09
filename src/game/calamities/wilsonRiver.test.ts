import { describe, expect, it } from 'vitest';
import { resolveWilsonRiverChoice } from './wilsonRiver';

describe('Wilson River calamity', () => {
  const state = { life: 6, magic: 4, experience: 10, lives: 3 };

  it('trades life for the largest experience reward when fording', () => {
    expect(resolveWilsonRiverChoice(state, 'ford_traffic', 0.9)).toMatchObject({
      life: 4,
      magic: 4,
      experience: 60,
      flag: 'calamity_wilson_river_choice_ford_traffic',
    });
  });

  it('trades magic for experience when floating the Subaru', () => {
    expect(resolveWilsonRiverChoice(state, 'float_subaru', 0.9)).toMatchObject({
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
      resolveWilsonRiverChoice({ ...state, life: 1 }, 'ford_traffic', 0.9).life,
    ).toBe(1);
    expect(
      resolveWilsonRiverChoice({ ...state, magic: 1 }, 'float_subaru', 0.9)
        .magic,
    ).toBe(0);
  });

  it('can consume a limited life on risky choices', () => {
    expect(resolveWilsonRiverChoice(state, 'ford_traffic', 0.24)).toMatchObject(
      {
        lives: 2,
        lostLife: true,
      },
    );
    expect(resolveWilsonRiverChoice(state, 'float_subaru', 0.09)).toMatchObject(
      {
        lives: 2,
        lostLife: true,
      },
    );
    expect(resolveWilsonRiverChoice(state, 'wait_odot', 0)).toMatchObject({
      lives: 3,
      lostLife: false,
    });
  });
});

