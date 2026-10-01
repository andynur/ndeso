import {
  type AreaDef,
  type CalendarData,
  type MarketData,
  type PlayerData,
  parseClockTime,
  type WeatherData,
  type WeatherId,
} from '@bale/shared';
import type { CropDef, ItemDef, ToolDef } from '@bale/shared/content';
import {
  buildCollisionGrid,
  type Command,
  createContext,
  createDayTransitionSystem,
  createEconomySystem,
  createFarmCommandSystem,
  createFarmInteractionSystem,
  createFarmingSystem,
  createGameState,
  createInventoryEventSystem,
  createMovementSystem,
  createStaminaSystem,
  createTimeSystem,
  createWeatherSystem,
  type Dir,
  type GameState,
  inventoryCommandSystem,
  isMoving,
  type SimEvent,
  type System,
  sanitizeCommand,
} from '@bale/sim';

const NO_COMMANDS: readonly Command[] = [];

/**
 * The glue between the loop and the sim (ARCHITECTURE §1, `game/`): owns the state, runs
 * the systems once per tick, and buffers the events they emit until the frame drains them.
 * `time` and player movement exist so far; the rest join in ARCHITECTURE §3.2 order.
 */

/** Where render draws the player this frame: between the last two ticks (ARCH §4.1). */
export interface PlayerPose {
  x: number;
  z: number;
  facing: Dir;
  moving: boolean;
}

export interface Game {
  readonly state: Readonly<GameState>;
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
  /** Writes the player's pose `alpha` of the way from the previous tick to the last. */
  playerPose(alpha: number, out: PlayerPose): PlayerPose;
}

/**
 * `after` runs after the built-in systems each tick; tests use it to observe what a tick
 * receives.
 */
export function createGame(
  cal: CalendarData,
  area: AreaDef,
  player: PlayerData,
  crops: readonly CropDef[],
  items: readonly ItemDef[],
  tools: readonly ToolDef[],
  weatherData: WeatherData,
  market: MarketData,
  state: GameState = createGameState(cal, area, player, weatherData),
  after: readonly System<GameState>[] = [],
): Game {
  const time = createTimeSystem(cal);
  const dayTransition = createDayTransitionSystem(cal);
  const movement = createMovementSystem(buildCollisionGrid(area), player);
  const weather = createWeatherSystem(cal, weatherData);
  const farmCommands = createFarmCommandSystem(crops);
  const farmInteraction = createFarmInteractionSystem(crops, items, tools);
  const inventoryEvents = createInventoryEventSystem(items);
  const farming = createFarmingSystem(crops, cal);
  const stamina = createStaminaSystem(tools);
  const economy = createEconomySystem(area, items, cal, market);
  // The player's position before the last tick, for render interpolation.
  let previousX = state.player.x;
  let previousZ = state.player.z;
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
      previousX = state.player.x;
      previousZ = state.player.z;
      if (state.player.dayEndSummary) dayTransition(state, ctx);
      else {
        time(state, ctx);
        dayTransition(state, ctx);
      }
      if (state.player.dayEndSummary) {
        ticks++;
        if (ctx.events.length > 0) pending.push(...ctx.events);
        return;
      }
      weather(state, ctx);
      movement(state, ctx);
      inventoryCommandSystem(state, ctx);
      farmCommands(state, ctx);
      farmInteraction(state, ctx);
      stamina(state, ctx);
      if (state.player.dayEndSummary) {
        ticks++;
        if (ctx.events.length > 0) pending.push(...ctx.events);
        return;
      }
      inventoryEvents(state, ctx);
      farming(state, ctx);
      economy(state, ctx);
      for (const system of after) system(state, ctx);
      ticks++;
      if (ctx.events.length > 0) pending.push(...ctx.events);
    },
    drainEvents() {
      const events = pending;
      pending = [];
      return events;
    },
    playerPose(alpha, out) {
      const { player } = state;
      out.x = previousX + (player.x - previousX) * alpha;
      out.z = previousZ + (player.z - previousZ) * alpha;
      out.facing = player.facing;
      out.moving = isMoving(player);
      return out;
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

/** `?weather=rain` pins the opening day for visual QA; later days return to seeded weather. */
export function parseStartWeather(value: string | null): WeatherId | undefined {
  return value === 'clear' || value === 'cloudy' || value === 'rain' || value === 'storm'
    ? value
    : undefined;
}
