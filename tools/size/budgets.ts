/**
 * PERFORMANCE_BUDGET §2 as data, plus the pure arithmetic behind `bun run check:size`.
 *
 * A budget we cannot measure yet is listed as `pending` rather than quietly passing:
 * a gate that reports "ok" for something it never looked at is worse than no gate.
 */

export const KB = 1024;
export const MB = 1024 * KB;

export interface Budget {
  readonly id: string;
  readonly label: string;
  /** Bytes. */
  readonly limit: number;
  /** True when the number is measured after brotli, as the budget table says. */
  readonly compressed: boolean;
  /** The ROADMAP task that makes this measurable, when it is not yet. */
  readonly pendingUntil?: string;
}

export const BUDGETS: readonly Budget[] = [
  {
    id: 'shell',
    label: 'Initial HTML + JS (core shell, brotli)',
    limit: 350 * KB,
    compressed: true,
  },
  {
    id: 'locale-namespace',
    label: 'Locale namespace file',
    limit: 30 * KB,
    compressed: false,
  },
  {
    id: 'title-critical-path',
    label: 'Critical path to title screen interactive',
    limit: 1.5 * MB,
    compressed: true,
    pendingUntil: 'M2-17',
  },
  {
    id: 'first-playable-frame',
    label: 'First playable frame (farm area)',
    limit: 10 * MB,
    compressed: true,
  },
  {
    id: 'music-track',
    label: 'Music track (Opus ~64 kbps, streamed)',
    limit: 1.5 * MB,
    compressed: false,
    pendingUntil: 'M2-14',
  },
  {
    id: 'area-chunk',
    label: 'Per additional area chunk',
    limit: 3 * MB,
    compressed: true,
  },
];

export type Status = 'ok' | 'over' | 'pending';

export interface Measurement {
  readonly budget: Budget;
  readonly status: Status;
  /** Bytes measured, or undefined while the budget is pending. */
  readonly actual?: number;
  /** What was measured, e.g. the three shell files. */
  readonly detail?: string;
}

export function measure(budget: Budget, actual: number | undefined, detail?: string): Measurement {
  if (actual === undefined)
    return { budget, status: 'pending', ...(detail === undefined ? {} : { detail }) };
  return {
    budget,
    status: actual > budget.limit ? 'over' : 'ok',
    actual,
    ...(detail === undefined ? {} : { detail }),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
  return `${(bytes / KB).toFixed(1)} KB`;
}

/** How much of a budget is spent, as a whole percentage. */
export function percentOf(actual: number, limit: number): number {
  return Math.round((actual / limit) * 100);
}
