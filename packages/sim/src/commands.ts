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

export type Command =
  /**
   * Held movement intent on the ground plane, length ≤ 1 (analogue sticks give less).
   * Sent when the intent changes, including back to `{0, 0}`; the sim holds it until then.
   */
  | { readonly type: 'move'; readonly x: number; readonly z: number }
  /** Use the held tool or talk to whatever is in front of the player (GDD §12 auto-target). */
  | { readonly type: 'interact' }
  /** Pick a hotbar slot, `0` to `HOTBAR_SLOTS - 1`. */
  | { readonly type: 'selectSlot'; readonly slot: number }
  /** Step the hotbar selection by one, wrapping. */
  | { readonly type: 'cycleSlot'; readonly delta: 1 | -1 };

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
      return { type: 'interact' };
    case 'selectSlot':
      return Number.isInteger(command.slot) && command.slot >= 0 && command.slot < HOTBAR_SLOTS
        ? { type: 'selectSlot', slot: command.slot }
        : null;
    case 'cycleSlot':
      return command.delta === 1 || command.delta === -1
        ? { type: 'cycleSlot', delta: command.delta }
        : null;
    default:
      return null;
  }
}
