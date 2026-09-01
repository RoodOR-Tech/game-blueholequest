import type { SaveData } from '../saves/schema';

export const SCORE_VALUES = {
  enemy: 100,
  budda: 300,
  calamity: 350,
  actionSequence: 750,
  bossBase: 2000,
  bossStep: 500,
} as const;

export function addScore(save: SaveData, points: number, savedAt: string): SaveData {
  return {
    ...save,
    stats: { ...save.stats, score: save.stats.score + Math.max(0, Math.floor(points)) },
    savedAt,
  };
}

