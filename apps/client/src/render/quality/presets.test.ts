import { describe, expect, test } from 'bun:test';
import { clampPixelRatio, guessPreset, isQualityPreset, MAX_DPR } from './presets.ts';

describe('clampPixelRatio', () => {
  test('caps at the preset budget (PERF §4)', () => {
    expect(clampPixelRatio('low', 3)).toBe(1);
    expect(clampPixelRatio('medium', 3)).toBe(1.5);
    expect(clampPixelRatio('high', 3)).toBe(2);
  });

  test('never renders below 1x, even for a nonsense devicePixelRatio', () => {
    expect(clampPixelRatio('high', 0)).toBe(1);
    expect(clampPixelRatio('high', Number.NaN)).toBe(1);
    expect(clampPixelRatio('low', 0.75)).toBe(1);
  });

  test('passes through a ratio below the cap', () => {
    expect(clampPixelRatio('high', 1.25)).toBe(1.25);
  });
});

describe('guessPreset', () => {
  test('a 3-4 GB phone, our reference Low device, gets Low', () => {
    expect(guessPreset({ deviceMemoryGb: 4, cores: 8, touch: true })).toBe('low');
  });

  test('an unknown-memory phone stays on Low', () => {
    expect(guessPreset({ touch: true })).toBe('low');
  });

  test('a high-memory phone gets Medium, never High', () => {
    expect(guessPreset({ deviceMemoryGb: 8, cores: 8, touch: true })).toBe('medium');
  });

  test('a desktop gets High, a weak desktop Medium', () => {
    expect(guessPreset({ deviceMemoryGb: 16, cores: 12, touch: false })).toBe('high');
    expect(guessPreset({ deviceMemoryGb: 8, cores: 4, touch: false })).toBe('medium');
  });
});

describe('preset table', () => {
  test('every preset has a DPR cap and is recognised by the guard', () => {
    for (const [preset, dpr] of Object.entries(MAX_DPR)) {
      expect(isQualityPreset(preset)).toBe(true);
      expect(dpr).toBeGreaterThanOrEqual(1);
    }
    expect(isQualityPreset('ultra')).toBe(false);
  });
});
