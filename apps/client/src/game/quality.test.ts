import { describe, expect, test } from 'bun:test';
import type { QualityPreset } from '@bale/shared';
import type { SettingsStore } from '../i18n/runtime.ts';
import { BENCHMARK_MS, BENCHMARK_WARMUP_MS } from '../render/quality/presets.ts';
import { createQualityControl, initialPreset, QUALITY_STORAGE_KEY } from './quality.ts';

function memoryStore(initial: Record<string, string> = {}): SettingsStore & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    read: (key) => data[key] ?? null,
    write: (key, value) => {
      data[key] = value;
    },
  };
}

function fakeTargets(preset: QualityPreset) {
  const log = { preset, scale: 1, cap: -1 };
  return {
    log,
    targets: {
      get preset() {
        return log.preset;
      },
      setPreset: (next: QualityPreset) => {
        log.preset = next;
      },
      setRenderScale: (scale: number) => {
        log.scale = scale;
      },
      setFpsCap: (fps: number) => {
        log.cap = fps;
      },
    },
  };
}

describe('initialPreset', () => {
  const guess = () => 'low' as const;

  test('a valid ?quality= wins and skips the benchmark', () => {
    const store = memoryStore({ [QUALITY_STORAGE_KEY]: 'low' });
    expect(initialPreset('high', store, guess)).toEqual({ preset: 'high', benchmark: false });
  });

  test('a stored choice skips the benchmark', () => {
    const store = memoryStore({ [QUALITY_STORAGE_KEY]: 'medium' });
    expect(initialPreset(null, store, guess)).toEqual({ preset: 'medium', benchmark: false });
  });

  test('first boot guesses and benchmarks; junk is ignored', () => {
    const store = memoryStore({ [QUALITY_STORAGE_KEY]: 'ultra' });
    expect(initialPreset('ultra', store, guess)).toEqual({ preset: 'low', benchmark: true });
  });
});

describe('createQualityControl', () => {
  test('benchmarks uncapped, then stores and applies the verdict', () => {
    const { log, targets } = fakeTargets('low');
    const store = memoryStore();
    const control = createQualityControl(targets, store, true);
    expect(log.cap).toBe(0);
    expect(control.benchmarking).toBe(true);
    // A steady 60 fps on Low is headroom: one step up.
    for (let t = 0; t <= BENCHMARK_WARMUP_MS + BENCHMARK_MS + 20; t += 1000 / 60) {
      control.frame(1000 / 60);
    }
    expect(control.benchmarking).toBe(false);
    expect(log.preset).toBe('medium');
    expect(log.cap).toBe(60);
    expect(store.data[QUALITY_STORAGE_KEY]).toBe('medium');
  });

  test('without a benchmark, caps at once and scales down under load', () => {
    const { log, targets } = fakeTargets('low');
    const control = createQualityControl(targets, memoryStore(), false);
    expect(log.cap).toBe(30);
    for (let t = 0; t < 2100; t += 50) control.frame(50);
    expect(log.scale).toBe(0.9);
    control.reset();
    expect(log.scale).toBe(1);
  });
});
