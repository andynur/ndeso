import { parseClockTime } from './calendar.ts';

/**
 * Day/night lighting keyframes (DESIGN §1.3), the schema for `content/data/lighting.json5`.
 * The renderer interpolates between them by the game clock; nothing here knows `three`.
 */

/** An sRGB colour as three 0–1 channels, parsed from `'#RRGGBB'`. */
export type Rgb = readonly [number, number, number];

export interface LightingKeyframe {
  /** Minutes after midnight, 0 ≤ at < 1440. */
  readonly at: number;
  readonly id: string;
  readonly sun: Rgb;
  readonly sunIntensity: number;
  /** Degrees above the horizon. */
  readonly sunElevation: number;
  /** Degrees clockwise from world north (−z); east is +x. Not wrapped, so it interpolates. */
  readonly sunAzimuth: number;
  readonly ambient: Rgb;
  readonly ambientIntensity: number;
  /** How far the fog and sky lean from the ambient colour towards the sun's, 0–1. */
  readonly haze: number;
  /** Where the fog is total, in multiples of the camera distance: lower is hazier. */
  readonly fog: number;
  /** Teras and warung lamps, 0 (off) to 1 (full). */
  readonly lamps: number;
}

export interface RainModifier {
  /** Multiplies both light intensities at full rain. */
  readonly intensity: number;
  /** Fraction of saturation removed at full rain. */
  readonly desaturate: number;
}

export interface LightingData {
  /** Strictly increasing by `at`; sampling wraps from the last to the first. */
  readonly keyframes: readonly LightingKeyframe[];
  readonly rain: RainModifier;
}

export type LightingResult =
  | { readonly ok: true; readonly data: LightingData }
  | { readonly ok: false; readonly errors: readonly string[] };

/** `'#FF9A4D'` → `[1, 0.604, 0.302]`. Undefined for anything else. */
export function parseHexColor(value: unknown): Rgb | undefined {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) return undefined;
  const n = Number.parseInt(value.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

/** Every field name the file uses, so a parsed object can be read with dot access. */
type Field =
  | 'keyframes'
  | 'rain'
  | 'at'
  | 'id'
  | 'sun'
  | 'sunIntensity'
  | 'sunElevation'
  | 'sunAzimuth'
  | 'ambient'
  | 'ambientIntensity'
  | 'haze'
  | 'fog'
  | 'lamps'
  | 'intensity'
  | 'desaturate';
type Obj = Partial<Readonly<Record<Field, unknown>>>;

const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const FILE = 'lighting.json5';

export function validateLighting(raw: unknown): LightingResult {
  const errors: string[] = [];
  const err = (message: string) => errors.push(`${FILE}: ${message}`);
  const keyframes: LightingKeyframe[] = [];
  let rain: RainModifier = { intensity: 1, desaturate: 0 };

  if (!isObj(raw)) return { ok: false, errors: [`${FILE}: is not an object`] };

  if (!Array.isArray(raw.keyframes) || raw.keyframes.length < 2) {
    err('keyframes must be an array of at least two');
  } else {
    for (const [index, entry] of raw.keyframes.entries()) {
      const at = `keyframes[${index}]`;
      if (!isObj(entry)) {
        err(`${at} is not an object`);
        continue;
      }
      const id = entry.id;
      const name = typeof id === 'string' ? id : at;
      const problems: string[] = [];
      const minute = parseClockTime(entry.at);
      if (minute === undefined) problems.push(`at must be an 'HH:MM' time`);
      if (typeof id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(id)) {
        problems.push('id must be a snake_case id');
      }
      const sun = parseHexColor(entry.sun);
      if (sun === undefined) problems.push(`sun must be '#RRGGBB'`);
      const ambient = parseHexColor(entry.ambient);
      if (ambient === undefined) problems.push(`ambient must be '#RRGGBB'`);
      const ranges = [
        ['sunIntensity', 0, 10],
        ['ambientIntensity', 0, 10],
        ['sunElevation', -90, 90],
        ['sunAzimuth', -360, 360],
        ['haze', 0, 1],
        ['fog', 1.2, 10],
        ['lamps', 0, 1],
      ] as const;
      for (const [field, min, max] of ranges) {
        if (!isNumberIn(entry[field], min, max)) {
          problems.push(`${field} must be a number in ${min}…${max}`);
        }
      }
      if (problems.length > 0) {
        for (const problem of problems) err(`${name}: ${problem}`);
        continue;
      }
      const previous = keyframes.at(-1);
      if (previous !== undefined && (minute as number) <= previous.at) {
        err(`${name}: keyframes must be strictly increasing by 'at'`);
        continue;
      }
      keyframes.push({
        at: minute as number,
        id: id as string,
        sun: sun as Rgb,
        sunIntensity: entry.sunIntensity as number,
        sunElevation: entry.sunElevation as number,
        sunAzimuth: entry.sunAzimuth as number,
        ambient: ambient as Rgb,
        ambientIntensity: entry.ambientIntensity as number,
        haze: entry.haze as number,
        fog: entry.fog as number,
        lamps: entry.lamps as number,
      });
    }
  }

  const rawRain = raw.rain;
  if (
    !isObj(rawRain) ||
    !isNumberIn(rawRain.intensity, 0, 1) ||
    !isNumberIn(rawRain.desaturate, 0, 1)
  ) {
    err('rain must be { intensity: 0…1, desaturate: 0…1 }');
  } else {
    rain = { intensity: rawRain.intensity, desaturate: rawRain.desaturate };
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, data: { keyframes, rain } };
}
