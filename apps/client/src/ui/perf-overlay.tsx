import type { QualityPreset } from '@bale/shared';
import { signal } from '@preact/signals';

/** One reading for the `?debug=perf` overlay (PERFORMANCE_BUDGET §6), refreshed twice a second. */
export interface PerfView {
  readonly preset: QualityPreset;
  readonly pixelRatio: number;
  readonly fps: number;
  readonly frameMs: number;
  readonly cpuMs: number;
  readonly cpuMaxMs: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly textures: number;
  readonly geometries: number;
  /** `performance.memory` where the browser has it (Chromium), else undefined. */
  readonly heapMb: number | undefined;
  /** True while the first-run benchmark is still measuring. */
  readonly benchmarking: boolean;
}

export const perfView = signal<PerfView | null>(null);

const fixed = (value: number, digits: number): string => value.toFixed(digits);

/**
 * Developer telemetry, not player-facing: the labels are units and counter names, the same
 * in every locale, so they bypass `t()` on purpose. Hidden unless `?debug=perf`.
 */
export function PerfOverlay() {
  const view = perfView.value;
  if (!view) return null;
  const rows: [string, string][] = [
    ['fps', fixed(view.fps, 0)],
    ['frame', `${fixed(view.frameMs, 1)} ms`],
    ['cpu', `${fixed(view.cpuMs, 1)} / ${fixed(view.cpuMaxMs, 1)} ms`],
    ['calls', String(view.drawCalls)],
    ['tris', String(view.triangles)],
    ['tex', String(view.textures)],
    ['geo', String(view.geometries)],
    ['heap', view.heapMb === undefined ? '—' : `${fixed(view.heapMb, 0)} MB`],
    ['preset', `${view.preset}${view.benchmarking ? ' …' : ''} @ ${fixed(view.pixelRatio, 2)}x`],
  ];
  return (
    <dl class="perf">
      {rows.map(([label, value]) => (
        <div key={label} class="perf__row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
