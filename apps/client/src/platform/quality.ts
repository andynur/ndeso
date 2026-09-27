/**
 * Quality presets and the device-pixel-ratio cap (PERFORMANCE_BUDGET §4).
 *
 * Pure on purpose: the real capability probe lives in `platform/device.ts` (M1-08),
 * this module only turns already-measured numbers into a preset so it stays testable.
 */

export const QUALITY_PRESETS = ['low', 'medium', 'high'] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

/** PERFORMANCE_BUDGET §4: render resolution cap per preset. */
export const MAX_DPR: Record<QualityPreset, number> = {
  low: 1,
  medium: 1.5,
  high: 2,
};

export function isQualityPreset(value: string): value is QualityPreset {
  return (QUALITY_PRESETS as readonly string[]).includes(value);
}

/** Never render above the preset cap, and never below 1 even on odd DPR reports. */
export function clampPixelRatio(preset: QualityPreset, devicePixelRatio: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.max(1, Math.min(dpr, MAX_DPR[preset]));
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
 * First-run guess only. M1-08 replaces it with the 3-second benchmark from
 * PERFORMANCE_BUDGET §4; until then we err towards Low, our primary target.
 */
export function guessPreset(hints: HardwareHints): QualityPreset {
  const memory = hints.deviceMemoryGb;
  const cores = hints.cores;

  if (memory !== undefined && memory <= 4) return 'low';
  if (hints.touch) return memory !== undefined && memory >= 8 ? 'medium' : 'low';
  if (cores !== undefined && cores <= 4) return 'medium';
  return 'high';
}
