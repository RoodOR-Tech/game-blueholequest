import { describe, expect, it } from 'vitest';
import { createNewSave } from '../saves/schema';
import {
  CHECKPOINTS,
  saveAtCheckpoint,
  sceneForCheckpoint,
} from './checkpoints';

describe('location checkpoints', () => {
  it('records a checkpoint without changing progression', () => {
    const save = createNewSave('dad_paula');
    const result = saveAtCheckpoint(save, CHECKPOINTS.forest, 'saved');
    expect(result.checkpointId).toBe(CHECKPOINTS.forest);
    expect(result.resources).toEqual(save.resources);
    expect(result.savedAt).toBe('saved');
  });

  it('routes Continue to each location entrance', () => {
    expect(sceneForCheckpoint(CHECKPOINTS.forest)).toBe('forest-quest');
    expect(sceneForCheckpoint(CHECKPOINTS.lodge)).toBe('lodge-quest');
    expect(sceneForCheckpoint(CHECKPOINTS.foundry)).toBe('foundry-test');
    expect(sceneForCheckpoint('unknown')).toBe('blue-hole-hub');
  });
});
