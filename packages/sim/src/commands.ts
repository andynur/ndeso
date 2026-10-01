/**
 * Player intents (ARCHITECTURE §3.1 "commands in, events out"). The client's input layer
 * turns keys, sticks, and taps into these; the sim never sees a device. Every field is
 * plain data in world space, so a recorded command list replays deterministically.
 *
 * The camera is view state and never becomes a `Command` — turning or zooming the view
 * changes nothing the sim owns.
 */

/** Hotbar size (GDD §12: keys 1–9). */
export const HOTBAR_SLOTS = 9;

export interface TileTarget {
  readonly area: string;
  readonly x: number;
  readonly z: number;
}

export type Command =
  /**
   * Held movement intent on the ground plane, length ≤ 1 (analogue sticks give less).
   * Sent when the intent changes, including back to `{0, 0}`; the sim holds it until then.
   */
  | { readonly type: 'move'; readonly x: number; readonly z: number }
  /** Use the held tool or talk to whatever is in front of the player (GDD §12 auto-target). */
  | { readonly type: 'interact' }
  /** End the current day voluntarily and open its summary. */
  | { readonly type: 'sleep' }
  /** Close the day-end summary and begin the next day. */
  | { readonly type: 'continueDay' }
  /** Pick a hotbar slot, `0` to `HOTBAR_SLOTS - 1`. */
  | { readonly type: 'selectSlot'; readonly slot: number }
  /** Step the hotbar selection by one, wrapping. */
  | { readonly type: 'cycleSlot'; readonly delta: 1 | -1 }
  /** Use a soil tool on one farm tile. Inventory chooses the tool in M2-04. */
  | { readonly type: 'useTool'; readonly tool: 'hoe' | 'watering_can'; readonly target: TileTarget }
  /** Put one seed into a prepared tile. Inventory consumption arrives in M2-04. */
  | { readonly type: 'plantSeed'; readonly cropId: string; readonly target: TileTarget }
  /** Pick a mature crop. The emitted event carries the yield for inventory to collect. */
  | { readonly type: 'harvest'; readonly target: TileTarget };

export type CommandType = Command['type'];

/**
 * The `commands` system's gate (ARCHITECTURE §3.2): returns a well-formed copy, or `null`
 * for anything malformed. A save, a replay, or a future network peer can hand the sim
 * arbitrary data, so nothing downstream trusts a command that did not pass through here.
 */
export function sanitizeCommand(command: Command): Command | null {
  switch (command.type) {
    case 'move': {
      const { x, z } = command;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
      const length = Math.hypot(x, z);
      if (length <= 1) return { type: 'move', x, z };
      return { type: 'move', x: x / length, z: z / length };
    }
    case 'interact':
    case 'sleep':
    case 'continueDay':
      return { type: command.type };
    case 'selectSlot':
      return Number.isInteger(command.slot) && command.slot >= 0 && command.slot < HOTBAR_SLOTS
        ? { type: 'selectSlot', slot: command.slot }
        : null;
    case 'cycleSlot':
      return command.delta === 1 || command.delta === -1
        ? { type: 'cycleSlot', delta: command.delta }
        : null;
    case 'useTool': {
      const target = sanitizeTarget(command.target);
      return target && (command.tool === 'hoe' || command.tool === 'watering_can')
        ? { type: 'useTool', tool: command.tool, target }
        : null;
    }
    case 'plantSeed': {
      const target = sanitizeTarget(command.target);
      return target && CONTENT_ID.test(command.cropId)
        ? { type: 'plantSeed', cropId: command.cropId, target }
        : null;
    }
    case 'harvest': {
      const target = sanitizeTarget(command.target);
      return target ? { type: 'harvest', target } : null;
    }
    default:
      return null;
  }
}

const CONTENT_ID = /^[a-z][a-z0-9_]*$/;

function sanitizeTarget(target: unknown): TileTarget | null {
  if (typeof target !== 'object' || target === null) return null;
  const value = target as Partial<TileTarget>;
  return typeof value.area === 'string' &&
    CONTENT_ID.test(value.area) &&
    Number.isInteger(value.x) &&
    Number.isInteger(value.z)
    ? { area: value.area, x: value.x as number, z: value.z as number }
    : null;
}
