import type { SaveData } from '../saves/schema';
import { bossLocationForCheckpoint } from './bossLocations';

export type CheckpointScene = 'blue-hole-hub' | 'highway-26' | 'location-boss';

export const CHECKPOINTS = {
  home: 'rockaway_blue_hole',
  route: 'connected_quest_route',
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
  if (checkpointId === CHECKPOINTS.route) return 'highway-26';
  if (bossLocationForCheckpoint(checkpointId)) return 'location-boss';
  // Saves from the retired forest, lodge and foundry prototypes resume at home.
  return 'blue-hole-hub';
}
