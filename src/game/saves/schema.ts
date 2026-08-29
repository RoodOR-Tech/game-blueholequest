import type { TeamId } from '../../content/teams';

export const SAVE_VERSION = 1 as const;

export interface SaveDataV1 {
  readonly version: typeof SAVE_VERSION;
  readonly activeTeamId: TeamId;
  readonly checkpointId: string;
  readonly stats: {
    readonly attackLevel: number;
    readonly magicLevel: number;
    readonly lifeLevel: number;
    readonly experience: number;
  };
  readonly resources: {
    readonly life: number;
    readonly maxLife: number;
    readonly magic: number;
    readonly maxMagic: number;
    readonly lives: number;
    readonly maxLives: number;
  };
  readonly techniques: readonly string[];
  readonly spells: readonly string[];
  readonly relics: readonly string[];
  readonly inventory: readonly string[];
  readonly flags: Readonly<Record<string, boolean>>;
  readonly savedAt: string;
}

export type SaveData = SaveDataV1;

export function createNewSave(activeTeamId: TeamId): SaveDataV1 {
  return {
    version: SAVE_VERSION,
    activeTeamId,
    checkpointId: 'rockaway_blue_hole',
    stats: { attackLevel: 1, magicLevel: 1, lifeLevel: 1, experience: 0 },
    resources: {
      life: 6,
      maxLife: 6,
      magic: 4,
      maxMagic: 4,
      lives: 3,
      maxLives: 3,
    },
    techniques: [],
    spells: [],
    relics: [],
    inventory: ['key_item_lantern'],
    flags: {},
    savedAt: new Date().toISOString(),
  };
}

export function normalizeSaveData(value: unknown): SaveData | null {
  if (!isSaveData(value)) return null;
  const legacyResources = value.resources as SaveData['resources'] & {
    lives?: number;
    maxLives?: number;
  };
  return {
    ...value,
    resources: {
      ...value.resources,
      lives: legacyResources.lives ?? 3,
      maxLives: legacyResources.maxLives ?? 3,
    },
  };
}

export function isSaveData(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SaveData>;
  return (
    candidate.version === SAVE_VERSION &&
    typeof candidate.activeTeamId === 'string' &&
    typeof candidate.checkpointId === 'string' &&
    typeof candidate.savedAt === 'string' &&
    typeof candidate.stats === 'object' &&
    typeof candidate.resources === 'object' &&
    Array.isArray(candidate.techniques) &&
    Array.isArray(candidate.spells) &&
    Array.isArray(candidate.relics) &&
    Array.isArray(candidate.inventory)
  );
}

