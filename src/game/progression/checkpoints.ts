import type { SaveData } from '../saves/schema';
import { bossLocationForCheckpoint } from './bossLocations';

export type CheckpointScene =
  | 'blue-hole-hub'
  | 'forest-quest'
  | 'lodge-quest'
  | 'foundry-test'
  | 'location-boss';

export const CHECKPOINTS = {
  home: 'rockaway_blue_hole',
  forest: 'coast_range_forest_entry',
  lodge: 'camp_18_lodge_entry',
  foundry: 'hillsboro_west_foundry_entry',
} as const;

export function saveAtCheckpoint(
  save: SaveData,
  checkpointId: string,
  savedAt: string,
): SaveData {
  return { ...save, checkpointId, savedAt };
}

export function sceneForCheckpoint(checkpointId: string): CheckpointScene {
  if (bossLocationForCheckpoint(checkpointId)) return 'location-boss';
  if (checkpointId === CHECKPOINTS.forest) return 'forest-quest';
  if (checkpointId === CHECKPOINTS.lodge) return 'lodge-quest';
  if (checkpointId === CHECKPOINTS.foundry) return 'foundry-test';
  return 'blue-hole-hub';
}
