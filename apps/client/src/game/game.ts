import type { CalendarData } from '@bale/shared';
import {
  createContext,
  createTimeState,
  createTimeSystem,
  type SimEvent,
  type TimeState,
} from '@bale/sim';

/**
 * The glue between the loop and the sim (ARCHITECTURE §1, `game/`): owns the state, runs
 * the systems once per tick, and buffers the events they emit until the frame drains them.
 * Only the `time` system exists yet; the rest join in ARCHITECTURE §3.2 order as they land.
 */

export interface Game {
  readonly state: Readonly<TimeState>;
  /** Ticks stepped since boot; with `alpha` it gives render a continuous sim time. */
  readonly ticks: number;
  step(): void;
  /** Hands over and clears the events emitted since the last drain, in emission order. */
  drainEvents(): SimEvent[];
}

export function createGame(cal: CalendarData, state: TimeState = createTimeState(cal)): Game {
  const time = createTimeSystem(cal);
  let ticks = 0;
  let pending: SimEvent[] = [];

  return {
    state,
    get ticks() {
      return ticks;
    },
    step() {
      const ctx = createContext(1);
      time(state, ctx);
      ticks++;
      if (ctx.events.length > 0) pending.push(...ctx.events);
    },
    drainEvents() {
      const events = pending;
      pending = [];
      return events;
    },
  };
}
