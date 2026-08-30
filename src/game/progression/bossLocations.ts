import type { SaveData } from '../saves/schema';

export const BOSS_LOCATIONS = [
  {
    id: 'hillsboro_west',
    label: 'HILLSBORO WEST',
    bossName: 'SILICON SENTINEL',
    artifactId: 'relic_crystal_hound',
    artifactName: 'CRYSTAL HOUND',
    checkpointId: 'hillsboro_west_boss_entry',
    color: 0xf0b84c,
    bossColor: 0x9e6850,
    maximumHealth: 4,
    projectileSpeed: 66,
    attackInterval: 1450,
  },
  {
    id: 'hillsboro_east',
    label: 'HILLSBORO EAST',
    bossName: 'CIRCUIT WARDEN',
    artifactId: 'relic_golden_thumb',
    artifactName: 'GOLDEN THUMB',
    checkpointId: 'hillsboro_east_boss_entry',
    color: 0x55c8ef,
    bossColor: 0x456fb3,
    maximumHealth: 5,
    projectileSpeed: 74,
    attackInterval: 1280,
  },
  {
    id: 'milwaukie',
    label: 'MILWAUKIE',
    bossName: 'RIVERFORGED GUARDIAN',
    artifactId: 'relic_amber_stein',
    artifactName: 'AMBER STEIN',
    checkpointId: 'milwaukie_boss_entry',
    color: 0xffa33e,
    bossColor: 0x337d83,
    maximumHealth: 6,
    projectileSpeed: 82,
    attackInterval: 1160,
  },
  {
    id: 'walla_walla',
    label: 'WALLA WALLA',
    bossName: 'VINEYARD COLOSSUS',
    artifactId: 'relic_emerald_leaf',
    artifactName: 'EMERALD LEAF',
    checkpointId: 'walla_walla_boss_entry',
    color: 0x7de06f,
    bossColor: 0x6f4938,
    maximumHealth: 7,
    projectileSpeed: 88,
    attackInterval: 1030,
  },
  {
    id: 'bend',
    label: 'BEND',
    bossName: 'LAVA PEAK TITAN',
    artifactId: 'relic_marble_mountain',
    artifactName: 'MARBLE MOUNTAIN',
    checkpointId: 'bend_boss_entry',
    color: 0xff5e55,
    bossColor: 0x662f37,
    maximumHealth: 8,
    projectileSpeed: 96,
    attackInterval: 920,
  },
] as const;

export type BossLocation = (typeof BOSS_LOCATIONS)[number];
export type BossLocationId = BossLocation['id'];
export type ArtifactId = BossLocation['artifactId'];

export function bossLocationById(id: unknown): BossLocation {
  return (
    BOSS_LOCATIONS.find((location) => location.id === id) ?? BOSS_LOCATIONS[0]
  );
}

export function bossLocationForCheckpoint(checkpointId: string): BossLocation | null {
  return (
    BOSS_LOCATIONS.find((location) => location.checkpointId === checkpointId) ??
    null
  );
}

export function awardLocationArtifact(
  save: SaveData,
  location: BossLocation,
  savedAt: string,
): SaveData {
  const firstRecovery = !save.relics.includes(location.artifactId);
  return {
    ...save,
    relics: firstRecovery
      ? [...save.relics, location.artifactId]
      : save.relics,
    stats: {
      ...save.stats,
      experience: save.stats.experience + (firstRecovery ? 100 : 0),
    },
    flags: {
      ...save.flags,
      [`boss_${location.id}_defeated`]: true,
      [`artifact_${location.id}_recovered`]: true,
    },
    checkpointId: 'connected_quest_route',
    savedAt,
  };
}

export function isLocationUnlocked(
  locationIndex: number,
  recovered: readonly string[],
): boolean {
  if (locationIndex <= 0) return true;
  const previous = BOSS_LOCATIONS[locationIndex - 1];
  return previous ? recovered.includes(previous.artifactId) : false;
}
