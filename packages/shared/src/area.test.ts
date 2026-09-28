import { describe, expect, test } from 'bun:test';
import { AREA_ORIGIN, parseAssetManifest, validateArea } from './area.ts';

const valid = () => ({
  id: 'bale',
  origin: AREA_ORIGIN,
  size: [32, 24],
  models: ['bale_ground_lvl0'],
  spawn: [0, 2],
  field: { x: 7, z: -6, w: 8, d: 12 },
  joglo: { x: -4, z: -10, w: 8, d: 8 },
  kalen: {
    points: [
      [5.5, -12],
      [5.5, 12],
    ],
    width: 1,
  },
  lamps: [[0, 2, 0]],
});

const errorsOf = (raw: unknown) => {
  const result = validateArea(raw, 'a.json5');
  return result.ok ? [] : result.errors;
};

describe('validateArea', () => {
  test('accepts a valid area', () => {
    expect(errorsOf(valid())).toEqual([]);
  });

  test('requires the PLACES §1 origin', () => {
    expect(errorsOf({ ...valid(), origin: 'somewhere' })).toEqual([
      `a.json5: origin must be '${AREA_ORIGIN}' (PLACES §1)`,
    ]);
  });

  test('keeps the field inside the area', () => {
    expect(errorsOf({ ...valid(), field: { x: 12, z: 0, w: 8, d: 2 } })).toEqual([
      'a.json5: field lies outside the area',
    ]);
  });

  test('kalen segments run along an axis', () => {
    const raw = valid();
    raw.kalen.points = [
      [0, 0],
      [3, 4],
    ];
    expect(errorsOf(raw)).toEqual(['a.json5: kalen segment 1 must run along x or z']);
  });

  test('no more lamps than any preset can light', () => {
    const lamp = [0, 2, 0];
    expect(errorsOf({ ...valid(), lamps: [lamp, lamp, lamp, lamp, lamp] })).toEqual([
      'a.json5: lamps must be at most 4 [x, y, z] points',
    ]);
  });
});

describe('parseAssetManifest', () => {
  test('accepts id → { url, bytes, type }', () => {
    const raw = { a: { url: 'models/a-1.glb', bytes: 10, type: 'model/gltf-binary' } };
    expect(parseAssetManifest(raw)).toEqual(raw);
  });

  test('rejects anything else', () => {
    expect(parseAssetManifest([])).toBeUndefined();
    expect(parseAssetManifest({ a: { url: 1 } })).toBeUndefined();
  });
});
