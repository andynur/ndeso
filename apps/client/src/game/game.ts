import { type CalendarData, parseClockTime } from '@bale/shared';
import {
  type Command,
  createContext,
  createTimeState,
  createTimeSystem,
  type SimEvent,
  type System,
  sanitizeCommand,
  type TimeState,
} from '@bale/sim';

const NO_COMMANDS: readonly Command[] = [];

/**
 * The glue between the loop and the sim (ARCHITECTURE §1, `game/`): owns the state, runs
 * the systems once per tick, and buffers the events they emit until the frame drains them.
 * Only the `time` system exists yet; the rest join in ARCHITECTURE §3.2 order as they land.
 */

export interface Game {
  readonly state: Readonly<TimeState>;
  /** Ticks stepped since boot; with `alpha` it gives render a continuous sim time. */
  readonly ticks: number;
  /**
   * Queues a player command for the next tick. Malformed commands are dropped here, so the
   * sim only ever sees sanitized ones. Several ticks in one frame: only the first gets them.
   */
  submit(command: Command): void;
  step(): void;
  /** Hands over and clears the events emitted since the last drain, in emission order. */
  drainEvents(): SimEvent[];
}

/**
 * `after` runs after `time` each tick, in ARCHITECTURE §3.2 order. Empty until M1-06 adds
 * the `commands` system; tests use it to observe what a tick receives.
 */
export function createGame(
  cal: CalendarData,
  state: TimeState = createTimeState(cal),
  after: readonly System<TimeState>[] = [],
): Game {
  const time = createTimeSystem(cal);
  let ticks = 0;
  let pending: SimEvent[] = [];
  let queued: Command[] = [];

  return {
    state,
    get ticks() {
      return ticks;
    },
    submit(command) {
      const clean = sanitizeCommand(command);
      if (clean) queued.push(clean);
    },
    step() {
      const commands = queued.length > 0 ? queued : NO_COMMANDS;
      if (queued.length > 0) queued = [];
      const ctx = createContext(1, commands);
      time(state, ctx);
      for (const system of after) system(state, ctx);
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

/**
 * `?clock=17:30` → the clock minute to start the day at, for looking at one hour's lighting
 * without waiting for it. Times before the day starts are read as after midnight (00:30 is
 * minute 1470); anything outside the game day is ignored.
 */
export function parseStartClock(value: string | null, cal: CalendarData): number | undefined {
  const time = parseClockTime(value);
  if (time === undefined) return undefined;
  const minute = time < cal.clock.dayStartMinute ? time + 1440 : time;
  return minute < cal.clock.dayEndMinute ? minute : undefined;
}
