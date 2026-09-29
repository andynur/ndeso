import type { AreaDef, CalendarData, PlayerData } from '@bale/shared';
import { createFarmingState, type FarmingState, type FarmPlot } from './systems/farming.ts';
import { createInventoryPlayerState, type InventoryState } from './systems/inventory.ts';
import { createPlayerState, type MovementState } from './systems/movement.ts';
import { createTimeState, type TimeState } from './systems/time.ts';

/**
 * The sim state so far (ARCHITECTURE §3.3 sketch): each system's slice, joined. Grows task
 * by task; the saved schema arrives with `save.ts`.
 */
export type GameState = TimeState & MovementState & FarmingState & InventoryState;

export function createGameState(
  cal: CalendarData,
  area: AreaDef,
  playerData: PlayerData,
): GameState {
  const plots: FarmPlot[] = [];
  const xEnd = area.field.x + area.field.w;
  const zEnd = area.field.z + area.field.d;
  for (let x = area.field.x; x < xEnd; x++) {
    for (let z = area.field.z; z < zEnd; z++) {
      plots.push({ area: area.id, x, z, plot: 'tegalan' as const });
    }
  }
  return {
    ...createTimeState(cal),
    player: { ...createPlayerState(area), ...createInventoryPlayerState(playerData) },
    ...createFarmingState(plots),
  };
}
