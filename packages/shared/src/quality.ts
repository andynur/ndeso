/**
 * Graphics quality preset (PERFORMANCE_BUDGET §4).
 *
 * It lives here rather than in `apps/client/src/render/quality` because three parts of the
 * repo need the name and only one of them is the renderer: the settings menu shows it, the
 * save/settings schema stores it, and `render/` maps it to actual numbers. ARCHITECTURE §2
 * forbids `ui/` from importing `render/`, so the shared vocabulary belongs in shared.
 */

export const QUALITY_PRESETS = ['low', 'medium', 'high'] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

export function isQualityPreset(value: string): value is QualityPreset {
  return (QUALITY_PRESETS as readonly string[]).includes(value);
}
