import { normalizeSaveData, type SaveData } from './schema';

export const SAVE_KEY = 'blue-hole-quest:save';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class SaveRepository {
  constructor(private readonly storage: StorageAdapter) {}

  load(): SaveData | null {
    const serialized = this.storage.getItem(SAVE_KEY);
    if (!serialized) return null;

    try {
      const parsed: unknown = JSON.parse(serialized);
      return normalizeSaveData(parsed);
    } catch {
      return null;
    }
  }

  save(data: SaveData): void {
    this.storage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  clear(): void {
    this.storage.removeItem(SAVE_KEY);
  }
}

