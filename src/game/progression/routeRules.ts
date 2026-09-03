export const LANTERN_ITEM_ID = 'key_item_lantern';
export const HIGHWAY_26_FOG_GATE_INDEX = 3;
const FOREST_RELIC_ID = 'relic_golden_thumb';
const LODGE_RELIC_ID = 'relic_amber_stein';

export function highway26GateMessage(
  targetIndex: number,
  inventory: readonly string[],
  relics: readonly string[],
): string | null {
  if (
    targetIndex >= HIGHWAY_26_FOG_GATE_INDEX &&
    !inventory.includes(LANTERN_ITEM_ID)
  )
    return 'COASTAL FOG BLOCKS THE PASS • FIND THE COLEMAN LANTERN';
  if (targetIndex >= 3 && !relics.includes(FOREST_RELIC_ID))
    return 'THE FOREST TRAIL IS SEALED • RECOVER THE GOLDEN THUMB';
  if (targetIndex >= 4 && !relics.includes(LODGE_RELIC_ID))
    return 'THE EAST ROAD IS BARRED • RECOVER THE AMBER STEIN AT CAMP 18';
  return null;
}

export function isHighway26FogGateBlocked(
  targetIndex: number,
  inventory: readonly string[],
  relics: readonly string[] = [],
): boolean {
  return highway26GateMessage(targetIndex, inventory, relics) !== null;
}
