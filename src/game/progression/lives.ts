import type { SaveData } from '../saves/schema';

export interface KnockoutResult {
  readonly save: SaveData;
  readonly gameOver: boolean;
}

export function resolveKnockout(
  save: SaveData,
  savedAt: string,
): KnockoutResult {
  const lives = Math.max(0, save.resources.lives - 1);
  const gameOver = lives === 0;
  return {
    gameOver,
    save: {
      ...save,
      resources: {
        ...save.resources,
        life: gameOver ? 0 : save.resources.maxLife,
        lives,
      },
      savedAt,
    },
  };
}

export function recoverFromGameOver(save: SaveData, savedAt: string): SaveData {
  return {
    ...save,
    checkpointId: 'rockaway_blue_hole',
    stats: {
      ...save.stats,
      experience: Math.floor(save.stats.experience * 0.75),
    },
    resources: {
      ...save.resources,
      life: save.resources.maxLife,
      magic: save.resources.maxMagic,
      lives: save.resources.maxLives,
    },
    savedAt,
  };
}

