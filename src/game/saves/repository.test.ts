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
});

