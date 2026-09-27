import { describe, expect, test } from 'bun:test';
import { isQualityPreset, QUALITY_PRESETS } from './quality.ts';

describe('isQualityPreset', () => {
  test('accepts every declared preset', () => {
    for (const preset of QUALITY_PRESETS) {
      expect(isQualityPreset(preset)).toBe(true);
    }
  });

  test('rejects anything else', () => {
    expect(isQualityPreset('ultra')).toBe(false);
    expect(isQualityPreset('')).toBe(false);
    expect(isQualityPreset('Low')).toBe(false);
  });
});
