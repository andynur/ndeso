/**
 * Day/night lighting from the DESIGN §1.3 keyframes, sampled by the game clock.
 *
 * Pure (no `three`): the scene copies a `LightingSample` into its lights each frame. Colours
 * come in as sRGB hex from `lighting.json5` and are interpolated in **linear** space — the
 * space the renderer lights in — so a dusk blend does not go muddy halfway. Everything the
 * frame reads is written into a caller-owned sample, so sampling allocates nothing.
 */

import type { LightingData, LightingKeyframe, Rgb } from '@bale/shared';

const DAY_MINUTES = 1440;
const DEG = Math.PI / 180;

/**
 * Sprites are unlit billboards (M1-03), tinted to sit in the light. Without a floor they go
 * near-black at night and the player stops reading at phone size (DESIGN §1: readability
 * first), so the tint is lifted this far towards white before the light is applied.
 */
export const SPRITE_LIFT = 0.35;

export type MutableRgb = [number, number, number];

/** One frame's lighting. Colours are linear-sRGB, ready for `Color.setRGB`. */
export interface LightingSample {
  readonly sun: MutableRgb;
  sunIntensity: number;
  /** Unit vector from the ground towards the sun (or moon). */
  readonly sunDirection: MutableRgb;
  readonly ambient: MutableRgb;
  ambientIntensity: number;
  /** Fog and sky colour. */
  readonly haze: MutableRgb;
  /** Fog far plane in multiples of the camera distance. */
  fog: number;
  /** Lamp strength, 0–1. */
  lamps: number;
  /** Multiplier for the unlit sprite shader, each channel ≤ 1. */
  readonly spriteTint: MutableRgb;
}

export function createLightingSample(): LightingSample {
  return {
    sun: [1, 1, 1],
    sunIntensity: 0,
    sunDirection: [0, 1, 0],
    ambient: [1, 1, 1],
    ambientIntensity: 0,
    haze: [0, 0, 0],
    fog: 3,
    lamps: 0,
    spriteTint: [1, 1, 1],
  };
}

/** The sRGB transfer function, inverted: what `Color.setHex` does under colour management. */
export function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

const toLinear = (rgb: Rgb): Rgb => [
  srgbToLinear(rgb[0]),
  srgbToLinear(rgb[1]),
  srgbToLinear(rgb[2]),
];

interface LinearKeyframe {
  readonly key: LightingKeyframe;
  readonly sun: Rgb;
  readonly ambient: Rgb;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function lerpRgb(out: MutableRgb, a: Rgb, b: Rgb, t: number): void {
  out[0] = lerp(a[0], b[0], t);
  out[1] = lerp(a[1], b[1], t);
  out[2] = lerp(a[2], b[2], t);
}

/** Pulls `rgb` towards its own luminance by `amount` (0 = unchanged, 1 = grey). */
function desaturate(rgb: MutableRgb, amount: number): void {
  const luma = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  rgb[0] = lerp(rgb[0], luma, amount);
  rgb[1] = lerp(rgb[1], luma, amount);
  rgb[2] = lerp(rgb[2], luma, amount);
}

export interface DayNight {
  /**
   * Fills `out` for `minute` (minutes after the midnight that opens the game day; values
   * past 1440 wrap, fractions interpolate) and `rain` (0 dry … 1 full rain).
   */
  sample(minute: number, rain: number, out: LightingSample): LightingSample;
}

export function createDayNight(data: LightingData): DayNight {
  const frames: LinearKeyframe[] = data.keyframes.map((key) => ({
    key,
    sun: toLinear(key.sun),
    ambient: toLinear(key.ambient),
  }));
  if (frames.length < 2) throw new Error('lighting needs at least two keyframes');
  const first = frames[0] as LinearKeyframe;
  const last = frames[frames.length - 1] as LinearKeyframe;

  return {
    sample(minute, rain, out) {
      const m = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
      // Default: the wrap segment from the last keyframe round midnight to the first.
      let a = last;
      let b = first;
      let t =
        ((m - last.key.at + DAY_MINUTES) % DAY_MINUTES) /
        (first.key.at + DAY_MINUTES - last.key.at);
      for (let i = 0; i < frames.length - 1; i++) {
        const from = frames[i] as LinearKeyframe;
        const to = frames[i + 1] as LinearKeyframe;
        if (m >= from.key.at && m < to.key.at) {
          a = from;
          b = to;
          t = (m - from.key.at) / (to.key.at - from.key.at);
          break;
        }
      }

      const wet = Math.min(1, Math.max(0, rain));
      const dim = lerp(1, data.rain.intensity, wet);
      const grey = data.rain.desaturate * wet;

      lerpRgb(out.sun, a.sun, b.sun, t);
      lerpRgb(out.ambient, a.ambient, b.ambient, t);
      if (grey > 0) {
        desaturate(out.sun, grey);
        desaturate(out.ambient, grey);
      }
      out.sunIntensity = lerp(a.key.sunIntensity, b.key.sunIntensity, t) * dim;
      out.ambientIntensity = lerp(a.key.ambientIntensity, b.key.ambientIntensity, t) * dim;
      out.lamps = lerp(a.key.lamps, b.key.lamps, t);

      const elevation = lerp(a.key.sunElevation, b.key.sunElevation, t) * DEG;
      const azimuth = lerp(a.key.sunAzimuth, b.key.sunAzimuth, t) * DEG;
      out.sunDirection[0] = Math.cos(elevation) * Math.sin(azimuth);
      out.sunDirection[1] = Math.sin(elevation);
      out.sunDirection[2] = -Math.cos(elevation) * Math.cos(azimuth);

      out.fog = lerp(a.key.fog, b.key.fog, t);
      const haze = lerp(a.key.haze, b.key.haze, t);
      lerpRgb(out.haze, out.ambient, out.sun, haze);

      // What a camera-facing surface would receive, in the renderer's Lambert units (a light
      // of intensity π shows full albedo), lifted so sprites never vanish, clamped to ≤ 1
      // by the brightest channel so the hue survives.
      const tint = out.spriteTint;
      for (let c = 0; c < 3; c++) {
        const lit =
          ((out.ambient[c] as number) * out.ambientIntensity +
            (out.sun[c] as number) * out.sunIntensity) /
          Math.PI;
        tint[c] = SPRITE_LIFT + (1 - SPRITE_LIFT) * lit;
      }
      const peak = Math.max(tint[0], tint[1], tint[2]);
      if (peak > 1) {
        tint[0] /= peak;
        tint[1] /= peak;
        tint[2] /= peak;
      }
      return out;
    },
  };
}
