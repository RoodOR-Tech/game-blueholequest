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
  readonly passiveDescription: string;
  readonly startingStats: TeamStats;
  readonly productionReady: boolean;
}

export const TEAMS: readonly TeamDefinition[] = [
  {
    id: 'dad_paula',
    displayName: 'Dad & Paula',
    weaponId: 'threaded_plumbing_wrench',
    passiveId: 'master_plumber',
    passiveDescription: 'Smashes standard blocks.',
    startingStats: { attack: 3, magic: 1, life: 2 },
    productionReady: true,
  },
  {
    id: 'jen_omar',
    displayName: 'Jen & Omar',
    weaponId: 'power_tool_wrench',
    passiveId: 'power_mom',
    passiveDescription: '+10% move speed and knockback immunity.',
    startingStats: { attack: 1, magic: 2, life: 3 },
    productionReady: true,
  },
  {
    id: 'jason_hilary',
    displayName: 'Jason & Hilary',
    weaponId: 'blueprint_engineering_tool',
    passiveId: 'engineer_multitool',
    passiveDescription: '+2 maximum HP and passive health regeneration.',
    startingStats: { attack: 2, magic: 1, life: 3 },
    productionReady: true,
  },
  {
    id: 'joe_cia',
    displayName: 'Joe & Cia',
    weaponId: 'enchanted_oak_pointer',
    passiveId: 'efficient_spellcraft',
    passiveDescription: 'Spells cost 25% less magic.',
    startingStats: { attack: 1, magic: 3, life: 2 },
    productionReady: true,
  },
  {
    id: 'kris_lea',
    displayName: 'Kris & Lea',
    weaponId: 'climbing_rope_and_carabiner',
    passiveId: 'alpine_trekker',
    passiveDescription: 'Ignores mud and snow speed penalties.',
    startingStats: { attack: 2, magic: 2, life: 2 },
    productionReady: true,
  },
] as const;

export function getTeam(id: TeamId): TeamDefinition {
  const team = TEAMS.find((candidate) => candidate.id === id);
  if (!team) throw new Error(`Unknown team: ${id}`);
  return team;
}

export function isTeamId(value: unknown): value is TeamId {
  return typeof value === 'string' && TEAMS.some((team) => team.id === value);
}
