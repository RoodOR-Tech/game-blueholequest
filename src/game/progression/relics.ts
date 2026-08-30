import { BOSS_LOCATIONS } from './bossLocations';

export const RELIC_IDS = BOSS_LOCATIONS.map((location) => location.crystalId);

export type RelicId = (typeof RELIC_IDS)[number];

export function recoveredRelicCount(relics: readonly string[]): number {
  const recovered = new Set(relics);
  return RELIC_IDS.filter((id) => recovered.has(id)).length;
}
