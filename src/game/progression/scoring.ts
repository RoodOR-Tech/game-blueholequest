import type { SaveData } from '../saves/schema';

export const SCORE_VALUES = {
  enemy: 100,
  budda: 300,
  calamityRisk: 650,
  calamityCareful: 250,
  actionSequence: 750,
  bossBase: 2000,
  bossStep: 500,
} as const;

export function addScore(
  save: SaveData,
  points: number,
  savedAt: string,
): SaveData {
  return {
    ...save,
    stats: {
      ...save.stats,
      score: save.stats.score + Math.max(0, Math.floor(points)),
    },
    savedAt,
  };
}
