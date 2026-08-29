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
  readonly techniques: readonly string[];
  readonly spells: readonly string[];
  readonly relics: readonly string[];
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
    techniques: [],
    spells: [],
    relics: [],
    flags: {},
    savedAt: new Date().toISOString(),
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
    Array.isArray(candidate.techniques) &&
    Array.isArray(candidate.spells) &&
    Array.isArray(candidate.relics)
  );
}

