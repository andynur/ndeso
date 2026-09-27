/**
 * The non-import half of the `packages/sim` boundary (ARCHITECTURE §2, ADR-0003):
 * APIs that would make the simulation non-deterministic or tie it to a browser.
 *
 * Import rules live in `rules.ts`; these are the ones that are invisible to an import graph
 * because they are globals. Both the `check:deps` run and the PostToolUse edit hook go
 * through here, so the two can never drift.
 */

import { maskLiterals } from './scan.ts';

export interface PurityRule {
  readonly pattern: RegExp;
  readonly message: string;
}

export interface PurityViolation {
  /** 1-based. */
  readonly line: number;
  readonly message: string;
}

export const SIM_PURITY_RULES: readonly PurityRule[] = [
  {
    pattern: /\b(window|document|localStorage|sessionStorage|navigator)\s*[.[]/,
    message: 'uses a DOM/browser global — the sim runs without a document',
  },
  {
    pattern: /\bMath\.random\s*\(/,
    message: 'uses Math.random — use the seeded rng in state (ARCHITECTURE §3.1)',
  },
  {
    pattern: /\b(Date\.now|performance\.now)\s*\(/,
    message: 'reads wall-clock time — derive time from sim ticks (ARCHITECTURE §3.1)',
  },
  {
    pattern: /\bnew\s+Date\s*\(/,
    message: 'constructs a Date — derive time from sim ticks (ARCHITECTURE §3.1)',
  },
  {
    pattern: /\b(setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\s*\(/,
    message: 'uses a timer — the sim is stepped externally (ARCHITECTURE §4.1)',
  },
];

/**
 * Runs the rules over the source with comments and string literals blanked out, so a rule
 * never fires on prose or on a message that happens to mention `Math.random`.
 */
export function purityViolations(source: string): PurityViolation[] {
  const violations: PurityViolation[] = [];
  const lines = maskLiterals(source).split('\n');
  for (const [index, text] of lines.entries()) {
    for (const rule of SIM_PURITY_RULES) {
      if (rule.pattern.test(text)) violations.push({ line: index + 1, message: rule.message });
    }
  }
  return violations;
}
