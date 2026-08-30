export type TeamId =
  'dad_paula' | 'jen_omar' | 'jason_hilary' | 'joe_cia' | 'kris_lea';

export interface TeamStats {
  readonly attack: number;
  readonly magic: number;
  readonly life: number;
}

export interface TeamDefinition {
  readonly id: TeamId;
  readonly displayName: string;
  readonly weaponId: string;
  readonly passiveId: string;
  readonly startingStats: TeamStats;
  readonly productionReady: boolean;
}

export const TEAMS: readonly TeamDefinition[] = [
  {
    id: 'dad_paula',
    displayName: 'Dad & Paula',
    weaponId: 'threaded_plumbing_wrench',
    passiveId: 'master_craftsman',
    startingStats: { attack: 3, magic: 1, life: 2 },
    productionReady: true,
  },
  {
    id: 'jen_omar',
    displayName: 'Jen & Omar',
    weaponId: 'smart_tech_stun_baton',
    passiveId: 'parental_reflexes',
    startingStats: { attack: 1, magic: 2, life: 3 },
    productionReady: true,
  },
  {
    id: 'jason_hilary',
    displayName: 'Jason & Hilary',
    weaponId: 'river_oak_mash_paddle',
    passiveId: 'riverbank_endurance',
    startingStats: { attack: 2, magic: 1, life: 3 },
    productionReady: true,
  },
  {
    id: 'joe_cia',
    displayName: 'Joe & Cia',
    weaponId: 'enchanted_oak_pointer',
    passiveId: 'academic_insight',
    startingStats: { attack: 1, magic: 3, life: 2 },
    productionReady: true,
  },
  {
    id: 'kris_lea',
    displayName: 'Kris & Lea',
    weaponId: 'carabiner_trekking_pole',
    passiveId: 'alpine_trekker',
    startingStats: { attack: 2, magic: 2, life: 2 },
    productionReady: true,
  },
] as const;

export function getTeam(id: TeamId): TeamDefinition {
  const team = TEAMS.find((candidate) => candidate.id === id);
  if (!team) throw new Error(`Unknown team: ${id}`);
  return team;
}
