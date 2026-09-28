import { expect, test } from 'bun:test';
import { LIGHTING_DATA } from './lighting-bundle.ts';

test('the lighting file has every DESIGN §1.3 keyframe', () => {
  expect(LIGHTING_DATA.keyframes.map((k) => k.id)).toEqual([
    'night_hold',
    'subuh',
    'dawn',
    'noon',
    'maghrib',
    'night',
  ]);
});

test('maghrib is at 17:30 with the DESIGN colours', () => {
  const maghrib = LIGHTING_DATA.keyframes.find((k) => k.id === 'maghrib');
  expect(maghrib?.at).toBe(17 * 60 + 30);
  expect(maghrib?.sun).toEqual([1, 0x9a / 255, 0x4d / 255]);
  expect(maghrib?.ambient).toEqual([0x8a / 255, 0x6f / 255, 0xa0 / 255]);
  expect(maghrib?.ambientIntensity).toBe(0.55);
});
