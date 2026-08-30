import { describe, expect, it } from 'vitest';
import { createNewSave } from '../saves/schema';
import {
  prepareCheckpointRetry,
  recoverFromGameOver,
  resolveKnockout,
} from './lives';

describe('limited lives', () => {
  it('starts a new game with three lives', () => {
    expect(createNewSave('dad_paula').resources.lives).toBe(3);
  });

  it('consumes a life and stays at zero health until retry', () => {
    const result = resolveKnockout(createNewSave('dad_paula'), 'knockout');
    expect(result.gameOver).toBe(false);
    expect(result.save.resources).toMatchObject({ life: 0, lives: 2 });
    expect(prepareCheckpointRetry(result.save, 'retry').resources.life).toBe(6);
  });

  it('reaches game over on the final life', () => {
    const save = createNewSave('dad_paula');
    const result = resolveKnockout(
      { ...save, resources: { ...save.resources, life: 0, lives: 1 } },
      'game-over',
    );
    expect(result.gameOver).toBe(true);
    expect(result.save.resources).toMatchObject({ life: 0, lives: 0 });
  });

  it('recovers at home with a 25 percent experience penalty', () => {
    const save = createNewSave('dad_paula');
    const recovered = recoverFromGameOver(
      {
        ...save,
        stats: { ...save.stats, experience: 101 },
        resources: { ...save.resources, life: 0, lives: 0 },
      },
      'recovered',
    );
    expect(recovered.stats.experience).toBe(75);
    expect(recovered.resources).toMatchObject({ life: 6, lives: 3 });
    expect(recovered.checkpointId).toBe('rockaway_blue_hole');
  });
});
