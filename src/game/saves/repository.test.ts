import { describe, expect, it } from 'vitest';
import { createNewSave } from './schema';
import { SaveRepository, type StorageAdapter } from './repository';

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('SaveRepository', () => {
  it('round-trips a versioned save', () => {
    const repository = new SaveRepository(new MemoryStorage());
    const save = createNewSave('dad_paula');
    repository.save(save);
    expect(repository.load()).toEqual(save);
  });

  it('rejects corrupted data without throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem('blue-hole-quest:save', '{not-json');
    expect(new SaveRepository(storage).load()).toBeNull();
  });

  it('rejects structurally invalid saves without throwing', () => {
    const storage = new MemoryStorage();
    const save = createNewSave('dad_paula');
    storage.setItem(
      'blue-hole-quest:save',
      JSON.stringify({ ...save, activeTeamId: 'unknown_team' }),
    );
    expect(new SaveRepository(storage).load()).toBeNull();

    storage.setItem(
      'blue-hole-quest:save',
      JSON.stringify({ ...save, resources: null }),
    );
    expect(new SaveRepository(storage).load()).toBeNull();
  });

  it('preserves current and maximum resources', () => {
    const repository = new SaveRepository(new MemoryStorage());
    const save = createNewSave('dad_paula');
    repository.save({
      ...save,
      resources: { ...save.resources, life: 2, magic: 1 },
    });
    expect(repository.load()?.resources).toEqual({
      life: 2,
      maxLife: 6,
      magic: 1,
      maxMagic: 4,
      lives: 3,
      maxLives: 3,
    });
  });

  it('adds the lives pool when loading a legacy save', () => {
    const storage = new MemoryStorage();
    const save = createNewSave('dad_paula');
    const legacyResources = {
      life: save.resources.life,
      maxLife: save.resources.maxLife,
      magic: save.resources.magic,
      maxMagic: save.resources.maxMagic,
    };
    storage.setItem(
      'blue-hole-quest:save',
      JSON.stringify({ ...save, resources: legacyResources }),
    );
    expect(new SaveRepository(storage).load()?.resources).toMatchObject({
      lives: 3,
      maxLives: 3,
    });
  });

  it('advances completed boss checkpoints to the connected route', () => {
    const repository = new SaveRepository(new MemoryStorage());
    const save = createNewSave('dad_paula');
    repository.save({
      ...save,
      checkpointId: 'hillsboro_west_boss_entry',
      relics: ['crystal_hillsboro_west'],
    });
    expect(repository.load()?.checkpointId).toBe('connected_quest_route');
    expect(repository.load()?.relics).toEqual(['relic_crystal_hound']);
  });
});
