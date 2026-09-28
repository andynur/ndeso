import { describe, expect, test } from 'bun:test';
import { LIGHTING_DATA } from '@bale/content/lighting';
import type { LightingData, LightingKeyframe } from '@bale/shared';
import { createDayNight, createLightingSample, SPRITE_LIFT, srgbToLinear } from './day-night.ts';

function key(at: number, id: string, overrides: Partial<LightingKeyframe> = {}): LightingKeyframe {
  return {
    at,
    id,
    sun: [1, 1, 1],
    sunIntensity: 2,
    sunElevation: 90,
    sunAzimuth: 0,
    ambient: [1, 1, 1],
    ambientIntensity: 1,
    haze: 0,
    fog: 3,
    lamps: 0,
    ...overrides,
  };
}

/** Two keyframes: 06:00 black and dim, 18:00 white and bright. */
const TWO: LightingData = {
  keyframes: [
    key(360, 'a', { sun: [0, 0, 0], sunIntensity: 0, ambient: [0, 0, 0], lamps: 1 }),
    key(1080, 'b', { sunIntensity: 2 }),
  ],
  rain: { intensity: 0.5, desaturate: 1 },
};

describe('createDayNight', () => {
  test('hits a keyframe exactly on its minute', () => {
    const out = createDayNight(TWO).sample(1080, 0, createLightingSample());
    expect(out.sun).toEqual([1, 1, 1]);
    expect(out.sunIntensity).toBe(2);
    expect(out.lamps).toBe(0);
  });

  test('interpolates linearly between keyframes', () => {
    const out = createDayNight(TWO).sample(720, 0, createLightingSample());
    expect(out.sun).toEqual([0.5, 0.5, 0.5]);
    expect(out.sunIntensity).toBe(1);
    expect(out.lamps).toBe(0.5);
  });

  test('wraps from the last keyframe past midnight to the first', () => {
    const dayNight = createDayNight(TWO);
    // 18:00 → 06:00 is 720 minutes; 00:00 is halfway, and minute 1440 is the same instant.
    const midnight = dayNight.sample(0, 0, createLightingSample());
    expect(midnight.sunIntensity).toBe(1);
    expect(dayNight.sample(1440, 0, createLightingSample())).toEqual(midnight);
    expect(dayNight.sample(1440 + 360, 0, createLightingSample()).sunIntensity).toBe(0);
  });

  test('converts sRGB keyframes to linear before blending', () => {
    const data: LightingData = {
      keyframes: [key(0, 'a', { sun: [0.5, 0.5, 0.5] }), key(60, 'b')],
      rain: TWO.rain,
    };
    expect(createDayNight(data).sample(0, 0, createLightingSample()).sun[0]).toBeCloseTo(
      srgbToLinear(0.5),
      6,
    );
  });

  test('turns elevation and azimuth into a unit direction towards the sun', () => {
    const data: LightingData = {
      keyframes: [key(0, 'a', { sunElevation: 0, sunAzimuth: 90 }), key(60, 'b')],
      rain: TWO.rain,
    };
    const [x, y, z] = createDayNight(data).sample(0, 0, createLightingSample()).sunDirection;
    // Azimuth 90 is east, which is +x.
    expect(x).toBeCloseTo(1, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  test('rain dims both lights and pulls colour towards grey', () => {
    const data: LightingData = {
      keyframes: [key(0, 'a', { sun: [1, 0, 0] }), key(60, 'b', { sun: [1, 0, 0] })],
      rain: { intensity: 0.6, desaturate: 0.3 },
    };
    const dry = createDayNight(data).sample(30, 0, createLightingSample());
    const wet = createDayNight(data).sample(30, 1, createLightingSample());
    expect(wet.sunIntensity).toBeCloseTo(dry.sunIntensity * 0.6, 6);
    expect(wet.ambientIntensity).toBeCloseTo(dry.ambientIntensity * 0.6, 6);
    expect(wet.sun[0]).toBeLessThan(1);
    expect(wet.sun[1]).toBeGreaterThan(0);
  });

  test('sprite tint never exceeds 1 and never drops below the lift', () => {
    const dayNight = createDayNight(LIGHTING_DATA);
    const out = createLightingSample();
    for (let minute = 0; minute < 1440; minute += 5) {
      dayNight.sample(minute, 0, out);
      for (const channel of out.spriteTint) {
        expect(channel).toBeLessThanOrEqual(1);
        expect(channel).toBeGreaterThanOrEqual(SPRITE_LIFT);
      }
    }
  });
});

describe('the shipped keyframes', () => {
  const dayNight = createDayNight(LIGHTING_DATA);
  const at = (minute: number) => dayNight.sample(minute, 0, createLightingSample());

  test('maghrib is warm: the sun is redder than it is blue, and low', () => {
    const maghrib = at(17 * 60 + 30);
    expect(maghrib.sun[0]).toBeGreaterThan(maghrib.sun[2] * 4);
    // Below 15°: long light, long shadows.
    expect(maghrib.sunDirection[1]).toBeLessThan(Math.sin((15 * Math.PI) / 180));
    // The haze leans warm too, which the noon haze does not.
    expect(maghrib.haze[0]).toBeGreaterThan(maghrib.haze[2]);
    expect(at(12 * 60).haze[0]).toBeLessThan(at(12 * 60).haze[2]);
  });

  test('flat ground is brightest at noon and darkest at night', () => {
    // What a field receives: the sun scaled by its height, plus ambient.
    const ground = (minute: number) => {
      const sample = at(minute);
      return sample.sunIntensity * sample.sunDirection[1] + sample.ambientIntensity;
    };
    const noon = ground(12 * 60);
    const night = ground(22 * 60);
    for (let minute = 300; minute < 1500; minute += 10) {
      expect(ground(minute)).toBeLessThanOrEqual(noon + 1e-9);
      expect(ground(minute)).toBeGreaterThanOrEqual(night - 1e-9);
    }
  });

  test('lamps are off at midday and on at night', () => {
    expect(at(12 * 60).lamps).toBe(0);
    expect(at(21 * 60).lamps).toBe(1);
  });

  test('the sun is above the horizon through the whole game day', () => {
    for (let minute = 300; minute < 1500; minute += 10) {
      expect(at(minute).sunDirection[1]).toBeGreaterThan(0);
    }
  });
});
