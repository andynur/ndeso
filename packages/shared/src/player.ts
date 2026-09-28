/**
 * Player movement tuning (`content/data/player.json5`). GDD gives no walk speed, so these
 * are feel numbers, tuned on a phone rather than derived.
 */
export interface PlayerData {
  /** Walking speed at full stick, tiles per second. */
  readonly speed: number;
  /** Half the edge of the player's collision square, tiles. Under 0.5 fits a 1-tile gap. */
  readonly radius: number;
}

export type PlayerResult =
  | { readonly ok: true; readonly data: PlayerData }
  | { readonly ok: false; readonly errors: readonly string[] };

const FILE = 'player.json5';
/** One tick's step must stay under one tile, or the collision could skip a wall. */
const MAX_SPEED = 9;

export function validatePlayer(raw: unknown): PlayerResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: [`${FILE}: is not an object`] };
  }
  const { speed, radius } = raw as { speed?: unknown; radius?: unknown };
  const errors: string[] = [];
  if (typeof speed !== 'number' || !(speed > 0 && speed <= MAX_SPEED)) {
    errors.push(`${FILE}: speed must be a number in (0, ${MAX_SPEED}] tiles/s`);
  }
  if (typeof radius !== 'number' || !(radius > 0 && radius < 0.5)) {
    errors.push(`${FILE}: radius must be a number in (0, 0.5) tiles`);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { speed: speed as number, radius: radius as number } };
}
