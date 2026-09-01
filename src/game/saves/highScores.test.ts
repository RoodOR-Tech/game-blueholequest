import { describe, expect, it } from 'vitest';
import { HighScoreRepository } from './highScores';

describe('high score repository', () => {
  it('sorts scores descending and retains the top ten', () => {
    const values = new Map<string, string>();
    const repository = new HighScoreRepository({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    });
    for (let score = 1; score <= 12; score += 1)
      repository.record({ teamId: 'dad_paula', score, artifacts: 5, completedAt: `${score}` });

    expect(repository.list()).toHaveLength(10);
    expect(repository.list()[0]?.score).toBe(12);
    expect(repository.list()[9]?.score).toBe(3);
  });
});

