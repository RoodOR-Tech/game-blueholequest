import type { BossLocationId } from './bossLocations';
import type { SaveData } from '../saves/schema';

export const BUDDA_FLAG_PREFIX = 'budda_found_';
export const BUDDA_ACHIEVEMENT = 'title_nine_buzzed_lives';

export type BuddaLocationId = 'rockaway' | BossLocationId;

export interface BuddaEncounter {
  readonly locationId: BuddaLocationId;
  readonly line: string;
  readonly reward: string;
}

export const BUDDA_ENCOUNTERS: Readonly<Record<BuddaLocationId, BuddaEncounter>> = {
  rockaway: {
    locationId: 'rockaway',
    line: '*YAWN* THE SINK HAS EXCELLENT ACOUSTICS.',
    reward: 'FULL HEALTH',
  },
  hillsboro_west: {
    locationId: 'hillsboro_west',
    line: '*PURR* UNION BREAK. MAKE IT QUICK.',
    reward: '+50 XP',
  },
  hillsboro_east: {
    locationId: 'hillsboro_east',
    line: '*HIC* THE DOGS THINK THEY RUN THIS CITADEL.',
    reward: 'FULL HEALTH',
  },
  milwaukie: {
    locationId: 'milwaukie',
    line: 'THE HOPS HERE HAVE EXCELLENT CITRUS NOTES.',
    reward: '+1 ATTACK LEVEL',
  },
  walla_walla: {
    locationId: 'walla_walla',
    line: '*PURR* MY GRADE IN ADVANCED CHILL IS AN A+.',
    reward: 'FULL HEALTH',
  },
  bend: {
    locationId: 'bend',
    line: '*HIC* THE HIGH DESERT NAPS HIT HARDER.',
    reward: 'FULL MAGIC',
  },
};

export function buddaFlag(locationId: BuddaLocationId): string {
  return `${BUDDA_FLAG_PREFIX}${locationId}`;
}

export function foundBuddaCount(save: SaveData): number {
  return Object.keys(BUDDA_ENCOUNTERS).filter((id) =>
    Boolean(save.flags[buddaFlag(id as BuddaLocationId)]),
  ).length;
}

export function discoverBudda(
  save: SaveData,
  locationId: BuddaLocationId,
  savedAt: string,
): SaveData {
  if (save.flags[buddaFlag(locationId)]) return save;
  const stats = { ...save.stats };
  const resources = { ...save.resources };
  if (locationId === 'hillsboro_west') stats.experience += 50;
  else if (locationId === 'milwaukie') stats.attackLevel += 1;
  else if (locationId === 'bend') resources.magic = resources.maxMagic;
  else resources.life = resources.maxLife;
  const flags = { ...save.flags, [buddaFlag(locationId)]: true };
  const foundAll = Object.keys(BUDDA_ENCOUNTERS).every((id) =>
    Boolean(flags[buddaFlag(id as BuddaLocationId)]),
  );
  return {
    ...save,
    stats,
    resources,
    flags,
    inventory:
      foundAll && !save.inventory.includes(BUDDA_ACHIEVEMENT)
        ? [...save.inventory, BUDDA_ACHIEVEMENT]
        : save.inventory,
    savedAt,
  };
}
