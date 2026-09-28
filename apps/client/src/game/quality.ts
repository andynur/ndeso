import { isQualityPreset, type QualityPreset } from '@bale/shared';
import type { SettingsStore } from '../i18n/runtime.ts';
import {
  BENCHMARK_MS,
  BENCHMARK_WARMUP_MS,
  benchmarkVerdict,
  DynamicResolution,
  QUALITY,
} from '../render/quality/presets.ts';
import { Benchmark } from './benchmark.ts';

/** Where the chosen preset is remembered, so the benchmark runs on the first boot only. */
export const QUALITY_STORAGE_KEY = 'bale.quality';

/** What quality control drives: the scene's preset and render scale, and the loop's cap. */
export interface QualityTargets {
  readonly preset: QualityPreset;
  setPreset(preset: QualityPreset): void;
  setRenderScale(scale: number): void;
  setFpsCap(fps: number): void;
}

export interface QualityControl {
  /** True while the first-run benchmark is measuring (uncapped, full scale). */
  readonly benchmarking: boolean;
  /** Feeds one drawn frame's wall-clock duration. */
  frame(frameMs: number): void;
  /** Starts dynamic resolution over, e.g. after the tab was hidden. */
  reset(): void;
}

/**
 * The preset to boot on (PERFORMANCE_BUDGET §4): `?quality=` wins for testing and is not
 * remembered; then the stored choice; then the hardware guess, which the benchmark checks.
 */
export function initialPreset(
  override: string | null,
  storage: SettingsStore,
  guess: () => QualityPreset,
): { preset: QualityPreset; benchmark: boolean } {
  if (override !== null && isQualityPreset(override)) return { preset: override, benchmark: false };
  const stored = storage.read(QUALITY_STORAGE_KEY);
  if (stored !== null && isQualityPreset(stored)) return { preset: stored, benchmark: false };
  return { preset: guess(), benchmark: true };
}

/**
 * Runs the first-run benchmark when asked, then holds the preset's frame rate with
 * dynamic resolution. The benchmark runs uncapped so it can see headroom above 30 fps.
 */
export function createQualityControl(
  targets: QualityTargets,
  storage: SettingsStore,
  runBenchmark: boolean,
): QualityControl {
  const dynamic = new DynamicResolution(QUALITY[targets.preset].fpsCap);
  let bench = runBenchmark ? new Benchmark(BENCHMARK_WARMUP_MS, BENCHMARK_MS) : undefined;

  function settle(preset: QualityPreset): void {
    targets.setPreset(preset);
    targets.setFpsCap(QUALITY[preset].fpsCap);
    targets.setRenderScale(1);
    dynamic.reset(QUALITY[preset].fpsCap);
  }

  targets.setFpsCap(bench ? 0 : QUALITY[targets.preset].fpsCap);

  return {
    get benchmarking() {
      return bench !== undefined;
    },
    frame(frameMs) {
      if (bench) {
        const average = bench.record(frameMs);
        if (average === undefined) return;
        bench = undefined;
        const verdict = benchmarkVerdict(targets.preset, average);
        storage.write(QUALITY_STORAGE_KEY, verdict);
        settle(verdict);
        return;
      }
      if (dynamic.update(frameMs)) targets.setRenderScale(dynamic.scale);
    },
    reset() {
      if (bench) return;
      dynamic.reset();
      targets.setRenderScale(1);
    },
  };
}
