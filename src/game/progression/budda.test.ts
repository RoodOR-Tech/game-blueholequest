import { describe, expect, it } from 'vitest';
import { createNewSave } from '../saves/schema';
import { BUDDA_ACHIEVEMENT, BUDDA_ENCOUNTERS, discoverBudda } from './budda';

describe('Budda encounters', () => {
  it('grants each encounter once and unlocks the six-location achievement', () => {
    let save = createNewSave('dad_paula');
    for (const id of Object.keys(BUDDA_ENCOUNTERS))
      save = discoverBudda(save, id as keyof typeof BUDDA_ENCOUNTERS, 'now');
    expect(save.stats.experience).toBe(50);
    expect(save.stats.attackLevel).toBe(4);
    expect(save.inventory).toContain(BUDDA_ACHIEVEMENT);
    expect(discoverBudda(save, 'milwaukie', 'later').stats.attackLevel).toBe(4);
  });
});
