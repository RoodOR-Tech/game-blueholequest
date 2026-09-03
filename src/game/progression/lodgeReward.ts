import type { SaveData } from '../saves/schema';

export const LODGE_RELIC_ID = 'relic_amber_stein';
export const LODGE_REWARD_EXP = 90;

export function awardLodgeRelic(save: SaveData, savedAt: string): SaveData {
  if (save.relics.includes(LODGE_RELIC_ID)) return { ...save, savedAt };
  return {
    ...save,
    stats: {
      ...save.stats,
      experience: save.stats.experience + LODGE_REWARD_EXP,
    },
    relics: [...save.relics, LODGE_RELIC_ID],
    flags: { ...save.flags, lodge_keg_golem_defeated: true },
    savedAt,
  };
}
