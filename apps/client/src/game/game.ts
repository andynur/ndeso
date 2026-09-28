import type { CalendarData } from '@bale/shared';
import {
  type CollisionGrid,
  type Command,
  createCommandsSystem,
  createContext,
  createPlayerState,
  createTimeState,
  createTimeSystem,
  type PlayerState,
  type SimEvent,
  type System,
  sanitizeCommand,
  type TimeState,
  type Vec2,
} from '@bale/sim';
import { PLACEHOLDER_SPAWN } from './placeholder-area.ts';

const NO_COMMANDS: readonly Command[] = [];

/**
 * The glue between the loop and the sim (ARCHITECTURE §1, `game/`): owns the state, runs
 * the systems once per tick, and buffers the events they emit until the frame drains them.
 * Systems run in ARCHITECTURE §3.2 order; the rest join as they land.
 */

/** The slices of `GameState` (ARCHITECTURE §3.3) that exist so far. */
export type GameState = TimeState & PlayerState;

export interface Game {
  readonly state: Readonly<GameState>;
  /** Ticks stepped since boot; with `alpha` it gives render a continuous sim time. */
  readonly ticks: number;
  /** The player's position before the last tick, for render to interpolate from. */
  readonly previousPos: Readonly<Vec2>;
  /**
   * Queues a player command for the next tick. Malformed commands are dropped here, so the
   * sim only ever sees sanitized ones. Several ticks in one frame: only the first gets them.
   */
  submit(command: Command): void;
  step(): void;
  /** Hands over and clears the events emitted since the last drain, in emission order. */
  drainEvents(): SimEvent[];
}

export function createGameState(cal: CalendarData): GameState {
  return { ...createTimeState(cal), ...createPlayerState(PLACEHOLDER_SPAWN) };
}

/** `after` runs after the built-in systems each tick; tests use it to observe a tick. */
export function createGame(
  cal: CalendarData,
  area: CollisionGrid,
  state: GameState = createGameState(cal),
  after: readonly System<GameState>[] = [],
): Game {
  const time = createTimeSystem(cal);
  const commandsSystem = createCommandsSystem(area);
  const previousPos = { x: state.player.pos.x, z: state.player.pos.z };
  let ticks = 0;
  let pending: SimEvent[] = [];
  let queued: Command[] = [];

  return {
    state,
    get ticks() {
      return ticks;
    },
    previousPos,
    submit(command) {
      const clean = sanitizeCommand(command);
      if (clean) queued.push(clean);
    },
    step() {
      const commands = queued.length > 0 ? queued : NO_COMMANDS;
      if (queued.length > 0) queued = [];
      const ctx = createContext(1, commands);
      previousPos.x = state.player.pos.x;
      previousPos.z = state.player.pos.z;
      time(state, ctx);
      commandsSystem(state, ctx);
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
