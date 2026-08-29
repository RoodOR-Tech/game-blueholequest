import type { SaveData } from '../saves/schema';

export const FOUNDRY_VICTORY_REWARD_EXP = 100;
export const POWER_WRENCH_TECHNIQUE = 'power_wrench';

export interface FoundryRewardResult {
  readonly save: SaveData;
  readonly firstVictory: boolean;
}

export function awardFoundryVictory(
  save: SaveData,
  savedAt: string,
): FoundryRewardResult {
  const firstVictory = !save.flags.foundry_drone_defeated;
  return {
    firstVictory,
    save: {
      ...save,
      stats: {
        ...save.stats,
        experience:
          save.stats.experience +
          (firstVictory ? FOUNDRY_VICTORY_REWARD_EXP : 0),
      },
      techniques: firstVictory
        ? [...save.techniques, POWER_WRENCH_TECHNIQUE]
        : save.techniques,
      flags: { ...save.flags, foundry_drone_defeated: true },
      savedAt,
    },
  };
}

