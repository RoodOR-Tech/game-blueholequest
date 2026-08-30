import type { SaveData } from '../saves/schema';

export const BOSS_LOCATIONS = [
  {
    id: 'hillsboro_west',
    label: 'HILLSBORO WEST',
    bossName: 'SILICON SENTINEL',
    crystalId: 'crystal_hillsboro_west',
    crystalName: 'GOLDEN CURRENT CRYSTAL',
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
    crystalId: 'crystal_hillsboro_east',
    crystalName: 'AZURE SIGNAL CRYSTAL',
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
    crystalId: 'crystal_milwaukie',
    crystalName: 'AMBER RIVER CRYSTAL',
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
    crystalId: 'crystal_walla_walla',
    crystalName: 'EMERALD HARVEST CRYSTAL',
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
    crystalId: 'crystal_bend',
    crystalName: 'RUBY CASCADE CRYSTAL',
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
export type CrystalId = BossLocation['crystalId'];

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

export function awardLocationCrystal(
  save: SaveData,
  location: BossLocation,
  savedAt: string,
): SaveData {
  const firstRecovery = !save.relics.includes(location.crystalId);
  return {
    ...save,
    relics: firstRecovery
      ? [...save.relics, location.crystalId]
      : save.relics,
    stats: {
      ...save.stats,
      experience: save.stats.experience + (firstRecovery ? 100 : 0),
    },
    flags: {
      ...save.flags,
      [`boss_${location.id}_defeated`]: true,
      [`crystal_${location.id}_recovered`]: true,
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
  return previous ? recovered.includes(previous.crystalId) : false;
}
