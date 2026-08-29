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
  readonly lives: number;
}

interface CalamityOutcome extends CalamityState {
  readonly flag: `calamity_wilson_river_choice_${WilsonRiverChoice}`;
  readonly summary: string;
  readonly lostLife: boolean;
}

export function resolveWilsonRiverChoice(
  state: CalamityState,
  choice: WilsonRiverChoice,
  chanceRoll = Math.random(),
): CalamityOutcome {
  if (choice === 'ford_traffic') {
    const lostLife = chanceRoll < 0.25;
    return {
      ...state,
      life: Math.max(1, state.life - 2),
      lives: Math.max(0, state.lives - Number(lostLife)),
      experience: state.experience + 50,
      flag: 'calamity_wilson_river_choice_ford_traffic',
      lostLife,
      summary: lostLife
        ? 'A WAGON WRECK! • LOST 1 LIFE • +50 EXP'
        : 'YOU FORD THE TRAFFIC • -2 HEALTH • +50 EXP',
    };
  }
  if (choice === 'float_subaru') {
    const lostLife = chanceRoll < 0.1;
    return {
      ...state,
      magic: Math.max(0, state.magic - 2),
      lives: Math.max(0, state.lives - Number(lostLife)),
      experience: state.experience + 25,
      flag: 'calamity_wilson_river_choice_float_subaru',
      lostLife,
      summary: lostLife
        ? 'THE SUBARU CAPSIZES! • LOST 1 LIFE • +25 EXP'
        : 'THE SUBARU FLOATS • -2 MAGIC • +25 EXP',
    };
  }
  return {
    ...state,
    flag: 'calamity_wilson_river_choice_wait_odot',
    lostLife: false,
    summary: 'ODOT CLEARS THE CROSSING • NO DAMAGE',
  };
}

