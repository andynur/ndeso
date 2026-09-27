import { describe, expect, test } from 'bun:test';
import { BUDGETS, formatBytes, KB, MB, measure, percentOf } from './budgets.ts';

const shell = BUDGETS.find((entry) => entry.id === 'shell') as (typeof BUDGETS)[number];

describe('BUDGETS', () => {
  test('mirrors the numbers in PERFORMANCE_BUDGET §2', () => {
    expect(shell.limit).toBe(350 * KB);
    expect(BUDGETS.find((entry) => entry.id === 'first-playable-frame')?.limit).toBe(10 * MB);
    expect(BUDGETS.find((entry) => entry.id === 'locale-namespace')?.limit).toBe(30 * KB);
  });

  test('every id is unique', () => {
    expect(new Set(BUDGETS.map((entry) => entry.id)).size).toBe(BUDGETS.length);
  });

  test('a budget we cannot measure yet names the task that unblocks it', () => {
    for (const entry of BUDGETS) {
      if (entry.pendingUntil !== undefined) expect(entry.pendingUntil).toMatch(/^M\d-\d\d$/);
    }
  });
});

describe('measure', () => {
  test('passes under the limit and fails over it', () => {
    expect(measure(shell, 349 * KB).status).toBe('ok');
    expect(measure(shell, 350 * KB).status).toBe('ok');
    expect(measure(shell, 350 * KB + 1).status).toBe('over');
  });

  test('an unmeasured budget is pending, never a pass', () => {
    expect(measure(shell, undefined).status).toBe('pending');
    expect(measure(shell, undefined).actual).toBeUndefined();
  });
});

describe('formatting', () => {
  test('switches to MB at the megabyte', () => {
    expect(formatBytes(120 * KB)).toBe('120.0 KB');
    expect(formatBytes(1.5 * MB)).toBe('1.50 MB');
  });

  test('reports the share of a budget spent', () => {
    expect(percentOf(35 * KB, 350 * KB)).toBe(10);
    expect(percentOf(700 * KB, 350 * KB)).toBe(200);
  });
});
