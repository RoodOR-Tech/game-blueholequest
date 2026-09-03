import { getTeam, isTeamId, type TeamId } from '../../content/teams';

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
    readonly score: number;
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
  const team = getTeam(activeTeamId);
  return {
    version: SAVE_VERSION,
    activeTeamId,
    checkpointId: 'rockaway_blue_hole',
    stats: {
      attackLevel: team.startingStats.attack,
      magicLevel: team.startingStats.magic,
      lifeLevel: team.startingStats.life,
      experience: 0,
      score: 0,
    },
    resources: {
      life: 4 + team.startingStats.life,
      maxLife: 4 + team.startingStats.life,
      magic: 3 + team.startingStats.magic,
      maxMagic: 3 + team.startingStats.magic,
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
  const defeatedBossCheckpoints: Readonly<Record<string, string>> = {
    hillsboro_west_boss_entry: 'relic_crystal_hound',
    hillsboro_east_boss_entry: 'relic_golden_thumb',
    milwaukie_boss_entry: 'relic_amber_stein',
    walla_walla_boss_entry: 'relic_emerald_leaf',
    bend_boss_entry: 'relic_marble_mountain',
  };
  const crystalToArtifact: Readonly<Record<string, string>> = {
    crystal_hillsboro_west: 'relic_crystal_hound',
    crystal_hillsboro_east: 'relic_golden_thumb',
    crystal_milwaukie: 'relic_amber_stein',
    crystal_walla_walla: 'relic_emerald_leaf',
    crystal_bend: 'relic_marble_mountain',
  };
  const relics = [
    ...new Set(value.relics.map((id) => crystalToArtifact[id] ?? id)),
  ];
  const checkpointCrystal = defeatedBossCheckpoints[value.checkpointId];
  const checkpointId =
    checkpointCrystal && relics.includes(checkpointCrystal)
      ? 'connected_quest_route'
      : value.checkpointId;
  return {
    ...value,
    checkpointId,
    relics,
    stats: {
      ...value.stats,
      score: typeof value.stats.score === 'number' ? value.stats.score : 0,
    },
    resources: {
      ...value.resources,
      lives: legacyResources.lives ?? 3,
      maxLives: legacyResources.maxLives ?? 3,
    },
  };
}

export function isSaveData(value: unknown): value is SaveData {
  if (!isRecord(value)) return false;
  const candidate = value as Partial<SaveData>;
  const stats = candidate.stats;
  const resources = candidate.resources;
  return (
    candidate.version === SAVE_VERSION &&
    isTeamId(candidate.activeTeamId) &&
    typeof candidate.checkpointId === 'string' &&
    typeof candidate.savedAt === 'string' &&
    isRecord(stats) &&
    isFiniteNumber(stats.attackLevel) &&
    isFiniteNumber(stats.magicLevel) &&
    isFiniteNumber(stats.lifeLevel) &&
    isFiniteNumber(stats.experience) &&
    (stats.score === undefined || isFiniteNumber(stats.score)) &&
    isRecord(resources) &&
    isFiniteNumber(resources.life) &&
    isFiniteNumber(resources.maxLife) &&
    isFiniteNumber(resources.magic) &&
    isFiniteNumber(resources.maxMagic) &&
    (resources.lives === undefined || isFiniteNumber(resources.lives)) &&
    (resources.maxLives === undefined || isFiniteNumber(resources.maxLives)) &&
    isStringArray(candidate.techniques) &&
    isStringArray(candidate.spells) &&
    isStringArray(candidate.relics) &&
    isStringArray(candidate.inventory) &&
    isBooleanRecord(candidate.flags)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === 'boolean')
  );
}
