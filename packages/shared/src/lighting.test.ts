import { describe, expect, test } from 'bun:test';
import { parseHexColor, validateLighting } from './lighting.ts';

function frame(at: string, id: string, overrides: Record<string, unknown> = {}) {
  return {
    at,
    id,
    sun: '#FFF4E0',
    sunIntensity: 2.5,
    sunElevation: 60,
    sunAzimuth: 0,
    ambient: '#A8C4E0',
    ambientIntensity: 0.7,
    haze: 0.2,
    fog: 3,
    lamps: 0,
    ...overrides,
  };
}

const valid = () => ({
  keyframes: [frame('06:00', 'dawn'), frame('12:00', 'noon')],
  rain: { intensity: 0.6, desaturate: 0.3 },
});

const errorsOf = (raw: unknown): readonly string[] => {
  const result = validateLighting(raw);
  return result.ok ? [] : result.errors;
};

describe('parseHexColor', () => {
  test('reads #RRGGBB into 0–1 channels', () => {
    expect(parseHexColor('#FF0080')).toEqual([1, 0, 128 / 255]);
  });

  test('rejects short, named, or non-string colours', () => {
    expect(parseHexColor('#FFF')).toBeUndefined();
    expect(parseHexColor('orange')).toBeUndefined();
    expect(parseHexColor(0xffffff)).toBeUndefined();
  });
});

describe('validateLighting', () => {
  test('accepts a valid file and converts times to minutes', () => {
    const result = validateLighting(valid());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.keyframes.map((k) => k.at)).toEqual([360, 720]);
  });

  test('rejects keyframes out of order', () => {
    const raw = valid();
    raw.keyframes.reverse();
    expect(errorsOf(raw)).toEqual([
      "lighting.json5: dawn: keyframes must be strictly increasing by 'at'",
    ]);
  });

  test('names each bad field', () => {
    const raw = valid();
    raw.keyframes[1] = frame('25:00', 'noon', { sun: 'red', haze: 2 });
    expect(errorsOf(raw)).toEqual([
      "lighting.json5: noon: at must be an 'HH:MM' time",
      "lighting.json5: noon: sun must be '#RRGGBB'",
      'lighting.json5: noon: haze must be a number in 0…1',
    ]);
  });

  test('needs a rain modifier and at least two keyframes', () => {
    expect(errorsOf({ keyframes: [frame('06:00', 'dawn')] })).toEqual([
      'lighting.json5: keyframes must be an array of at least two',
      'lighting.json5: rain must be { intensity: 0…1, desaturate: 0…1 }',
    ]);
  });
});
