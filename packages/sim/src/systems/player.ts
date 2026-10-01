import type { CalendarData } from '@bale/shared';
import type { ToolDef } from '@bale/shared/content';
import type { SimContext, System } from '../types.ts';
import type { MovementState } from './movement.ts';
import { startNextDay, type TimeState } from './time.ts';

/** GDD §8: the base cap grows through later relationship events, up to 160. */
export const BASE_STAMINA = 100;
export const MAX_STAMINA = 160;
export const MAX_FAINT_PENALTY = 5_000;

export type DayEndReason = 'sleep' | 'exhausted' | 'late';

export interface DayEndSummary {
  readonly day: number;
  readonly reason: DayEndReason;
  readonly staminaRemaining: number;
  readonly moneyLost: number;
}

export interface PlayerProgress {
  stamina: number;
  maxStamina: number;
  /** The economy owns earnings; day transitions may deduct the fainting penalty. */
  money: number;
  dayEndSummary: DayEndSummary | null;
}

export interface PlayerProgressState {
  player: PlayerProgress;
}

export function createPlayerProgress(): PlayerProgress {
  return {
    stamina: BASE_STAMINA,
    maxStamina: BASE_STAMINA,
    money: 0,
    dayEndSummary: null,
  };
}

/**
 * Runs immediately after time. A summary freezes the rest of the sim until the player
 * acknowledges it; only then is `dayStarted` emitted for the day's downstream systems.
 */
export function createDayTransitionSystem(
  cal: CalendarData,
): System<TimeState & MovementState & PlayerProgressState> {
  return (state, ctx) => {
    const { player } = state;
    if (player.dayEndSummary) {
      if (!ctx.commands.some((command) => command.type === 'continueDay')) return;
      player.dayEndSummary = null;
      player.stamina = player.maxStamina;
      player.moveX = 0;
      player.moveZ = 0;
      startNextDay(state, ctx, cal);
      ctx.emit({ type: 'staminaChanged', stamina: player.stamina, maxStamina: player.maxStamina });
      return;
    }

    if (ctx.commands.some((command) => command.type === 'sleep')) {
      endDay(state, 'sleep', ctx);
      return;
    }
    if (ctx.events.some((event) => event.type === 'dayExpired')) endDay(state, 'late', ctx);
  };
}

/** Charges only tool actions the farm accepted, identified by their emitted events. */
export function createStaminaSystem(
  tools: readonly ToolDef[],
): System<TimeState & MovementState & PlayerProgressState> {
  const costByAction = new Map<ToolDef['action'], number>(
    tools.map((tool) => [tool.action, tool.staminaCost]),
  );
  return (state, ctx) => {
    if (state.player.dayEndSummary) return;
    let spent = 0;
    for (const event of ctx.events) {
      if (event.type === 'tileHoed') spent += costByAction.get('hoe') ?? 0;
      else if (event.type === 'tileWatered') spent += costByAction.get('water') ?? 0;
    }
    if (spent === 0) return;
    state.player.stamina = Math.max(0, state.player.stamina - spent);
    ctx.emit({
      type: 'staminaChanged',
      stamina: state.player.stamina,
      maxStamina: state.player.maxStamina,
    });
    if (state.player.stamina === 0) endDay(state, 'exhausted', ctx);
  };
}

function endDay(
  state: TimeState & MovementState & PlayerProgressState,
  reason: DayEndReason,
  ctx: SimContext,
): void {
  if (state.player.dayEndSummary) return;
  const moneyLost =
    reason === 'sleep' ? 0 : Math.min(MAX_FAINT_PENALTY, Math.floor(state.player.money * 0.1));
  state.player.money -= moneyLost;
  state.player.moveX = 0;
  state.player.moveZ = 0;
  state.player.dayEndSummary = {
    day: state.clock.day,
    reason,
    staminaRemaining: state.player.stamina,
    moneyLost,
  };
  ctx.emit({ type: 'dayEnded', ...state.player.dayEndSummary });
}
