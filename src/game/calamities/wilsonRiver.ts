export const WILSON_RIVER_CHOICES = [
  'ford_traffic',
  'float_subaru',
  'wait_odot',
] as const;

export type WilsonRiverChoice = (typeof WILSON_RIVER_CHOICES)[number];

interface CalamityState {
  readonly life: number;
  readonly magic: number;
  readonly experience: number;
}

interface CalamityOutcome extends CalamityState {
  readonly flag: `calamity_wilson_river_choice_${WilsonRiverChoice}`;
  readonly summary: string;
}

export function resolveWilsonRiverChoice(
  state: CalamityState,
  choice: WilsonRiverChoice,
): CalamityOutcome {
  if (choice === 'ford_traffic') {
    return {
      ...state,
      life: Math.max(1, state.life - 2),
      experience: state.experience + 50,
      flag: 'calamity_wilson_river_choice_ford_traffic',
      summary: 'YOU FORD THE TRAFFIC • -2 LIFE • +50 EXP',
    };
  }
  if (choice === 'float_subaru') {
    return {
      ...state,
      magic: Math.max(0, state.magic - 2),
      experience: state.experience + 25,
      flag: 'calamity_wilson_river_choice_float_subaru',
      summary: 'THE SUBARU FLOATS • -2 MAGIC • +25 EXP',
    };
  }
  return {
    ...state,
    flag: 'calamity_wilson_river_choice_wait_odot',
    summary: 'ODOT CLEARS THE CROSSING • NO DAMAGE',
  };
}

