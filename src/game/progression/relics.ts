export const RELIC_IDS = [
  'relic_golden_thumb',
  'relic_crystal_hound',
  'relic_amber_stein',
  'relic_emerald_leaf',
  'relic_marble_mountain',
] as const;

export type RelicId = (typeof RELIC_IDS)[number];

export function recoveredRelicCount(relics: readonly string[]): number {
  const recovered = new Set(relics);
  return RELIC_IDS.filter((id) => recovered.has(id)).length;
}

