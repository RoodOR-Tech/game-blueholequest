import type { SaveData } from '../saves/schema';

export const FOREST_RELIC_ID = 'relic_golden_thumb';

export function awardForestRelic(save: SaveData, savedAt: string): SaveData {
  if (save.relics.includes(FOREST_RELIC_ID)) return { ...save, savedAt };
  return {
    ...save,
    stats: { ...save.stats, experience: save.stats.experience + 75 },
    relics: [...save.relics, FOREST_RELIC_ID],
    flags: { ...save.flags, forest_fog_warden_defeated: true },
    savedAt,
  };
}

