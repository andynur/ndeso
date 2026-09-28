import type { AreaDef, CalendarData } from '@bale/shared';
import { createPlayerState, type MovementState } from './systems/movement.ts';
import { createTimeState, type TimeState } from './systems/time.ts';

/**
 * The sim state so far (ARCHITECTURE §3.3 sketch): each system's slice, joined. Grows task
 * by task; the saved schema arrives with `save.ts`.
 */
export type GameState = TimeState & MovementState;

export function createGameState(cal: CalendarData, area: AreaDef): GameState {
  return { ...createTimeState(cal), player: createPlayerState(area) };
}
