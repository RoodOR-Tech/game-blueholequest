import type { TeamId } from '../../content/teams';
import type { StorageAdapter } from './repository';

export const HIGH_SCORES_KEY = 'blue-hole-quest:high-scores';

export interface HighScoreEntry {
  readonly teamId: TeamId;
  readonly score: number;
  readonly artifacts: number;
  readonly completedAt: string;
}

export class HighScoreRepository {
  constructor(private readonly storage: StorageAdapter) {}

  list(): readonly HighScoreEntry[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(HIGH_SCORES_KEY) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry): entry is HighScoreEntry =>
          typeof entry === 'object' && entry !== null &&
          typeof (entry as HighScoreEntry).score === 'number' &&
          typeof (entry as HighScoreEntry).teamId === 'string',
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  record(entry: HighScoreEntry): readonly HighScoreEntry[] {
    const scores = [...this.list(), entry].sort((a, b) => b.score - a.score).slice(0, 10);
    this.storage.setItem(HIGH_SCORES_KEY, JSON.stringify(scores));
    return scores;
  }
}

