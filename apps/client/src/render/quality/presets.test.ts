import { describe, expect, test } from 'bun:test';
import { QUALITY_PRESETS } from '@bale/shared';
import {
  benchmarkVerdict,
  clampPixelRatio,
  DynamicResolution,
  guessPreset,
  MAX_DPR,
  QUALITY,
  RENDER_SCALE_MIN,
} from './presets.ts';

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
  test('every shared preset has a DPR cap of at least 1', () => {
    for (const preset of QUALITY_PRESETS) {
      expect(MAX_DPR[preset]).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('QUALITY', () => {
  test('matches the PERFORMANCE_BUDGET §4 table', () => {
    expect(QUALITY.low).toEqual({
      maxDpr: 1,
      shadowMapSize: 0,
      softShadows: false,
      lamps: 0,
      fpsCap: 30,
      rainParticles: 300,
    });
    expect(QUALITY.medium.shadowMapSize).toBe(512);
    expect(QUALITY.high.shadowMapSize).toBe(1024);
    expect(QUALITY.high.softShadows).toBe(true);
    expect([QUALITY.medium.lamps, QUALITY.high.lamps]).toEqual([2, 4]);
    expect([QUALITY.medium.rainParticles, QUALITY.high.rainParticles]).toEqual([800, 2000]);
  });
});

describe('benchmarkVerdict', () => {
  test('steps down one preset below 25 fps', () => {
    expect(benchmarkVerdict('high', 50)).toBe('medium');
    expect(benchmarkVerdict('low', 50)).toBe('low');
  });

  test('steps up one preset at a steady 60', () => {
    expect(benchmarkVerdict('low', 16.7)).toBe('medium');
    expect(benchmarkVerdict('high', 16.7)).toBe('high');
  });

  test('keeps the guess in between', () => {
    expect(benchmarkVerdict('medium', 30)).toBe('medium');
  });

  test('treats a nonsense measurement as slow', () => {
    expect(benchmarkVerdict('medium', 0)).toBe('low');
  });
});

describe('DynamicResolution', () => {
  const run = (dr: DynamicResolution, frameMs: number, totalMs: number) => {
    let changes = 0;
    for (let t = 0; t < totalMs; t += frameMs) if (dr.update(frameMs)) changes++;
    return changes;
  };

  test('holds full scale while the target is met', () => {
    const dr = new DynamicResolution(30);
    expect(run(dr, 1000 / 30, 20_000)).toBe(0);
    expect(dr.scale).toBe(1);
  });

  test('drops 0.1 per 2 s window below target − 5, down to 0.6', () => {
    const dr = new DynamicResolution(30);
    run(dr, 1000 / 20, 2000);
    expect(dr.scale).toBe(0.9);
    run(dr, 1000 / 20, 20_000);
    expect(dr.scale).toBe(RENDER_SCALE_MIN);
  });

  test('a dip inside the 5 fps margin does nothing', () => {
    const dr = new DynamicResolution(30);
    run(dr, 1000 / 26, 10_000);
    expect(dr.scale).toBe(1);
  });

  test('climbs back 0.1 after 10 s at target', () => {
    const dr = new DynamicResolution(30);
    run(dr, 1000 / 20, 4000);
    expect(dr.scale).toBe(0.8);
    run(dr, 1000 / 30, 9900);
    expect(dr.scale).toBe(0.8);
    run(dr, 1000 / 30, 200);
    expect(dr.scale).toBe(0.9);
    run(dr, 1000 / 30, 30_000);
    expect(dr.scale).toBe(1);
  });

  test('reset returns to full scale with a new target', () => {
    const dr = new DynamicResolution(60);
    run(dr, 1000 / 40, 4000);
    dr.reset(30);
    expect(dr.scale).toBe(1);
    expect(dr.targetFps).toBe(30);
  });
});
