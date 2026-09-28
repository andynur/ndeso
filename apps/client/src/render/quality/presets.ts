/**
 * What a quality preset means for the renderer (PERFORMANCE_BUDGET §4), how the first run
 * picks one, and the dynamic-resolution controller that defends its frame rate.
 *
 * The preset *names* are in `@bale/shared` because settings and the save file use them too;
 * the numbers below are render's business alone.
 *
 * Pure on purpose: `main.ts` reads `navigator` and times the frames; this module only turns
 * already-measured numbers into decisions, so it stays testable without a DOM.
 */

import { QUALITY_PRESETS, type QualityPreset } from '@bale/shared';

/** One row of the PERFORMANCE_BUDGET §4 table, as the renderer needs it. */
export interface QualitySettings {
  /** Render resolution cap. */
  readonly maxDpr: number;
  /** Sun shadow map edge in texels; 0 = no real shadows (Low uses blob decals). */
  readonly shadowMapSize: number;
  /** PCF soft shadows (High only). */
  readonly softShadows: boolean;
  /** Point lights; Low gets none, so lamps glow unlit there. */
  readonly lamps: number;
  /** Frame-rate cap. Medium's "30/60" runs at 60 and lets dynamic resolution hold it. */
  readonly fpsCap: number;
}

export const QUALITY: Record<QualityPreset, QualitySettings> = {
  low: { maxDpr: 1, shadowMapSize: 0, softShadows: false, lamps: 0, fpsCap: 30 },
  medium: { maxDpr: 1.5, shadowMapSize: 512, softShadows: false, lamps: 2, fpsCap: 60 },
  high: { maxDpr: 2, shadowMapSize: 1024, softShadows: true, lamps: 4, fpsCap: 60 },
};

/** PERFORMANCE_BUDGET §4: render resolution cap per preset. */
export const MAX_DPR: Record<QualityPreset, number> = {
  low: QUALITY.low.maxDpr,
  medium: QUALITY.medium.maxDpr,
  high: QUALITY.high.maxDpr,
};

/** Never render above the preset cap, and never below 1 even on odd DPR reports. */
export function clampPixelRatio(preset: QualityPreset, devicePixelRatio: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.max(1, Math.min(dpr, QUALITY[preset].maxDpr));
}

export interface HardwareHints {
  /** `navigator.deviceMemory`, in GB. Absent on iOS and Firefox. */
  readonly deviceMemoryGb?: number | undefined;
  /** `navigator.hardwareConcurrency`. */
  readonly cores?: number | undefined;
  /** True when the primary pointer is a finger, i.e. almost certainly a phone. */
  readonly touch: boolean;
}

/**
 * The preset to start the first run on, before the 3-second benchmark has measured
 * anything. It errs towards Low, our primary target; `benchmarkVerdict` corrects it.
 */
export function guessPreset(hints: HardwareHints): QualityPreset {
  const memory = hints.deviceMemoryGb;
  const cores = hints.cores;

  if (memory !== undefined && memory <= 4) return 'low';
  if (hints.touch) return memory !== undefined && memory >= 8 ? 'medium' : 'low';
  if (cores !== undefined && cores <= 4) return 'medium';
  return 'high';
}

/** Benchmark length and the warm-up skipped before it (shader compiles, first uploads). */
export const BENCHMARK_MS = 3000;
export const BENCHMARK_WARMUP_MS = 1000;

/**
 * PERFORMANCE_BUDGET §4 auto-select. The benchmark runs uncapped on the guessed preset;
 * this moves at most one step: down when it cannot hold 30 fps less the 5 fps margin, up
 * when it holds a full 60 with room to spare. One step, because a guess is rarely off by
 * two and a wrong jump to High is worse on a phone than staying a notch low.
 */
export function benchmarkVerdict(current: QualityPreset, averageFrameMs: number): QualityPreset {
  // QUALITY_PRESETS is ordered low → high.
  const index = QUALITY_PRESETS.indexOf(current);
  const fps = averageFrameMs > 0 ? 1000 / averageFrameMs : 0;
  if (fps < 25) return QUALITY_PRESETS[Math.max(0, index - 1)] as QualityPreset;
  if (fps >= 55)
    return QUALITY_PRESETS[Math.min(QUALITY_PRESETS.length - 1, index + 1)] as QualityPreset;
  return current;
}

/** PERFORMANCE_BUDGET §4 dynamic resolution. */
export const RENDER_SCALE_MIN = 0.6;
export const RENDER_SCALE_STEP = 0.1;
/** The window the fps average is taken over before scaling down. */
export const SCALE_DOWN_WINDOW_MS = 2000;
/** How long the fps must hold the target before scaling back up. */
export const SCALE_UP_AFTER_MS = 10_000;

/**
 * "If the fps average over 2 s drops below target − 5, lower the render scale in 0.1 steps
 * (min 0.6). Raise it again after 10 s above target." A vsync-capped frame rate never
 * goes *above* the target, so "above" is read as within 1 fps of it.
 */
export class DynamicResolution {
  /** Multiplies the preset's pixel ratio, RENDER_SCALE_MIN…1. */
  scale = 1;
  private windowMs = 0;
  private windowFrames = 0;
  private goodMs = 0;

  constructor(public targetFps: number) {}

  /** Feeds one frame's wall-clock duration; returns true when `scale` changed. */
  update(frameMs: number): boolean {
    if (!(frameMs > 0)) return false;
    this.windowMs += frameMs;
    this.windowFrames++;
    const instantFps = 1000 / frameMs;
    this.goodMs = instantFps >= this.targetFps - 1 ? this.goodMs + frameMs : 0;

    if (this.goodMs >= SCALE_UP_AFTER_MS && this.scale < 1) {
      this.scale = round1(Math.min(1, this.scale + RENDER_SCALE_STEP));
      this.goodMs = 0;
      this.resetWindow();
      return true;
    }
    if (this.windowMs < SCALE_DOWN_WINDOW_MS) return false;
    const averageFps = (this.windowFrames * 1000) / this.windowMs;
    this.resetWindow();
    if (averageFps < this.targetFps - 5 && this.scale > RENDER_SCALE_MIN) {
      this.scale = round1(Math.max(RENDER_SCALE_MIN, this.scale - RENDER_SCALE_STEP));
      this.goodMs = 0;
      return true;
    }
    return false;
  }

  /** Starts over, e.g. after a preset change or a hidden tab. */
  reset(targetFps = this.targetFps): void {
    this.targetFps = targetFps;
    this.scale = 1;
    this.goodMs = 0;
    this.resetWindow();
  }

  private resetWindow(): void {
    this.windowMs = 0;
    this.windowFrames = 0;
  }
}

/** Keeps 0.1 steps exact, so 0.6 + 0.1 + 0.1 … lands back on 1 rather than 0.9999. */
const round1 = (value: number): number => Math.round(value * 10) / 10;
