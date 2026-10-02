import {
  type AreaDef,
  type CalendarData,
  type FarmAreaDef,
  type MarketData,
  type PlayerData,
  parseClockTime,
  type WeatherData,
  type WeatherId,
} from '@bale/shared';
import type { AnimalData, CropDef, ItemDef, NpcDef, ToolDef } from '@bale/shared/content';
import {
  buildCollisionGrid,
  buildNavGrid,
  type Command,
  createAnimalsSystem,
  createContext,
  createDayTransitionSystem,
  createEconomySystem,
  createFarmCommandSystem,
  createFarmInteractionSystem,
  createFarmingSystem,
  createGameState,
  createInventoryEventSystem,
  createMovementSystem,
  createNpcSystem,
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

export interface NpcPose {
  id: string;
  area: string;
  x: number;
  z: number;
  facing: Dir;
  anim: string;
  active: boolean;
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
  /** Writes interpolated NPC projections into the caller-owned array. */
  npcPoses(alpha: number, out: NpcPose[]): NpcPose[];
  /** Adds collision/navigation for a lazily loaded area before the next sim step. */
  registerArea(area: AreaDef): void;
}

/**
 * `after` runs after the built-in systems each tick; tests use it to observe what a tick
 * receives.
 */
export function createGame(
  cal: CalendarData,
  area: FarmAreaDef,
  player: PlayerData,
  crops: readonly CropDef[],
  items: readonly ItemDef[],
  tools: readonly ToolDef[],
  weatherData: WeatherData,
  market: MarketData,
  npcs: readonly NpcDef[],
  animals: AnimalData,
  state: GameState = createGameState(cal, area, player, weatherData, npcs, animals),
  after: readonly System<GameState>[] = [],
  areas: readonly AreaDef[] = [area],
): Game {
  const time = createTimeSystem(cal);
  const dayTransition = createDayTransitionSystem(cal);
  const areaById: Record<string, AreaDef> = Object.fromEntries(
    areas.map((entry) => [entry.id, entry]),
  );
  const collisions: Record<string, ReturnType<typeof buildCollisionGrid>> = Object.fromEntries(
    areas.map((entry) => [entry.id, buildCollisionGrid(entry)]),
  );
  const navs = Object.fromEntries(
    Object.entries(collisions).map(([id, grid]) => [id, buildNavGrid(grid)]),
  );
  const movement = createMovementSystem(collisions, player, areaById);
  const weather = createWeatherSystem(cal, weatherData);
  const farmCommands = createFarmCommandSystem(crops);
  const farmInteraction = createFarmInteractionSystem(crops, items, tools);
  const inventoryEvents = createInventoryEventSystem(items);
  const farming = createFarmingSystem(crops, cal);
  const animal = createAnimalsSystem(area, animals, items);
  const stamina = createStaminaSystem(tools);
  const npc = createNpcSystem(npcs, cal, navs);
  const economy = createEconomySystem(area, items, cal, market);
  // The player's position before the last tick, for render interpolation.
  let previousX = state.player.x;
  let previousZ = state.player.z;
  const previousNpcs = state.npcs.map((actor) => ({
    x: actor.x,
    z: actor.z,
    active: actor.active,
  }));
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
      for (let index = 0; index < state.npcs.length; index++) {
        const actor = state.npcs[index];
        const previous = previousNpcs[index];
        if (actor && previous) {
          previous.x = actor.x;
          previous.z = actor.z;
          previous.active = actor.active;
        }
      }
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
      animal(state, ctx);
      npc(state, ctx);
      for (let index = 0; index < state.npcs.length; index++) {
        const actor = state.npcs[index];
        const previous = previousNpcs[index];
        if (actor?.active && previous && !previous.active) {
          previous.x = actor.x;
          previous.z = actor.z;
        }
      }
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
    npcPoses(alpha, out) {
      out.length = state.npcs.length;
      for (let index = 0; index < state.npcs.length; index++) {
        const actor = state.npcs[index];
        const previous = previousNpcs[index];
        if (!actor || !previous) continue;
        const pose = out[index] ?? ({} as NpcPose);
        pose.id = actor.id;
        pose.area = actor.area;
        pose.x = previous.x + (actor.x - previous.x) * alpha;
        pose.z = previous.z + (actor.z - previous.z) * alpha;
        pose.facing = actor.facing;
        pose.anim = actor.anim;
        pose.active = actor.active;
        pose.moving = actor.moving;
        out[index] = pose;
      }
      return out;
    },
    registerArea(nextArea) {
      if (areaById[nextArea.id]) return;
      const grid = buildCollisionGrid(nextArea);
      areaById[nextArea.id] = nextArea;
      collisions[nextArea.id] = grid;
      navs[nextArea.id] = buildNavGrid(grid);
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

/** `?area=pasar` opens an authored area directly for local visual QA. */
export function parseStartArea(value: string | null): 'bale' | 'pasar' | undefined {
  return value === 'bale' || value === 'pasar' ? value : undefined;
}
