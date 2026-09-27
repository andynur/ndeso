#!/usr/bin/env bun
/**
 * `bun run check:size` — the size gate of PERFORMANCE_BUDGET §2 (TESTING §1).
 *
 * Reads the output of `bun run build`, measures it the way the budget table does
 * (brotli for anything served over the wire), and fails when a budget is exceeded.
 * Budgets whose inputs do not exist yet are reported as pending with the task that
 * unblocks them, never as a pass.
 *
 * It also writes `artifacts/size-report.json`, which CI uploads, so a regression can be
 * diffed against an earlier run rather than eyeballed in a log.
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
import { LOCALE_NAMESPACES, SUPPORTED_LOCALES } from '@bale/shared';
import {
  BUDGETS,
  type Budget,
  formatBytes,
  type Measurement,
  measure,
  percentOf,
} from './size/budgets.ts';
import { shellFiles } from './size/shell.ts';

const REPO_ROOT = join(import.meta.dir, '..');
const DIST = join(REPO_ROOT, 'dist');
const ARTIFACTS = join(REPO_ROOT, 'artifacts');

/** The budget table's sizes are "brotli", i.e. what a CDN actually sends. */
function brotliSize(bytes: Uint8Array): number {
  return brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).byteLength;
}

function budget(id: string): Budget {
  const found = BUDGETS.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no budget named ${id}`);
  return found;
}

/**
 * A missing `dist/` is a failure, not a pending budget. `pending` means "this budget has
 * nothing to measure until task X ships"; a build that produced no `index.html` is a broken
 * build, and letting it report ok is how a green CI run comes to mean nothing.
 */
async function measureShell(): Promise<Measurement> {
  const html = Bun.file(join(DIST, 'index.html'));
  if (!(await html.exists())) {
    throw new Error('no dist/index.html — run `bun run build` before `bun run check:size`');
  }
  // A build for a project site stamps a URL prefix onto every reference, so the HTML says
  // `/ndeso/index-abc.js` where the file is `index-abc.js`. The build records which prefix
  // it used; without reading it back, this would look for files that do not exist.
  const manifest = Bun.file(join(DIST, 'precache-manifest.json'));
  const publicPath = (await manifest.exists())
    ? (((await manifest.json()) as { publicPath?: string }).publicPath ?? '/')
    : '/';
  const files = shellFiles(await html.text(), 'index.html', publicPath);
  let total = 0;
  for (const path of files) {
    total += brotliSize(new Uint8Array(await Bun.file(join(DIST, path)).arrayBuffer()));
  }
  return measure(budget('shell'), total, `${files.length} files: ${files.join(', ')}`);
}

/** Locale bundles are measured at the source, where they are authored and reviewed. */
async function measureLocales(): Promise<Measurement[]> {
  const entry = budget('locale-namespace');
  const measurements: Measurement[] = [];
  for (const locale of SUPPORTED_LOCALES) {
    for (const namespace of LOCALE_NAMESPACES) {
      const file = Bun.file(
        join(REPO_ROOT, 'packages/content/locales', locale.id, `${namespace}.json`),
      );
      if (!(await file.exists())) continue;
      measurements.push(measure(entry, file.size, `${locale.id}/${namespace}.json`));
    }
  }
  return measurements;
}

function line(measurement: Measurement): string {
  const { budget: entry, status, actual, detail } = measurement;
  const label = (detail ?? entry.label).padEnd(46);
  if (status === 'pending') {
    return `  ⋯  ${label} pending — needs ${entry.pendingUntil ?? 'more of the game'}`;
  }
  const size = formatBytes(actual as number).padStart(9);
  const share = `${percentOf(actual as number, entry.limit)}% of ${formatBytes(entry.limit)}`;
  return `  ${status === 'over' ? '✖' : '✓'}  ${label} ${size}  (${share})`;
}

async function main(): Promise<number> {
  const { GITHUB_SHA } = process.env;
  const shell = await measureShell();
  const locales = await measureLocales();
  const pending = BUDGETS.filter((entry) => entry.pendingUntil !== undefined).map((entry) =>
    measure(entry, undefined),
  );
  const all = [shell, ...locales, ...pending];

  console.log('\n  size budget — PERFORMANCE_BUDGET §2\n');
  console.log(`  ${'shell (brotli)'}`);
  console.log(line(shell));
  console.log('\n  locale namespaces (raw)');
  for (const measurement of locales) console.log(line(measurement));
  console.log('\n  not measurable yet');
  for (const measurement of pending) console.log(line(measurement));

  await mkdir(ARTIFACTS, { recursive: true });
  await Bun.write(
    join(ARTIFACTS, 'size-report.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        commit: GITHUB_SHA ?? null,
        measurements: all.map((measurement) => ({
          id: measurement.budget.id,
          detail: measurement.detail ?? null,
          status: measurement.status,
          bytes: measurement.actual ?? null,
          limit: measurement.budget.limit,
        })),
      },
      null,
      2,
    )}\n`,
  );

  const over = all.filter((measurement) => measurement.status === 'over');
  if (over.length > 0) {
    console.error(`\n  check:size failed — ${over.length} budget(s) exceeded.\n`);
    return 1;
  }
  const measured = all.filter((measurement) => measurement.status === 'ok').length;
  console.log(`\n  check:size ok — ${measured} budget(s) measured, ${pending.length} pending.\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(
    await main().catch((error: unknown) => {
      console.error(`\n  check:size failed — ${(error as Error).message}\n`);
      return 1;
    }),
  );
}
