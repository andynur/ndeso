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
import { BALE_AREA } from '../packages/content/src/area-bale.ts';
import { PASAR_AREA } from '../packages/content/src/area-pasar.ts';
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
  return measure(
    budget('shell'),
    await brotliTotal(files),
    `${files.length} files: ${files.join(', ')}`,
  );
}

async function brotliTotal(paths: readonly string[]): Promise<number> {
  let total = 0;
  for (const path of paths) {
    total += brotliSize(new Uint8Array(await Bun.file(join(DIST, path)).arrayBuffer()));
  }
  return total;
}

/**
 * PERFORMANCE_BUDGET §2 "first playable frame (farm area)": everything a cold visit fetches
 * before the farm is on screen — the shell, the lazily loaded locale chunks (both locales,
 * an upper bound), the asset manifest, and every model the base area lists.
 */
async function measureFirstFrame(shell: Measurement): Promise<Measurement> {
  const manifestPath = join(DIST, 'assets', 'manifest.json');
  if (!(await Bun.file(manifestPath).exists())) {
    throw new Error('no dist/assets/manifest.json — the build did not ship the area models');
  }
  const manifest = (await Bun.file(manifestPath).json()) as Record<string, { url: string }>;
  const models = BALE_AREA.models.map((id) => {
    const entry = manifest[id];
    if (entry === undefined) throw new Error(`dist/assets/manifest.json has no ${id}`);
    return `assets/${entry.url}`;
  });
  const locales: string[] = [];
  for await (const path of new Bun.Glob('{ui,calendar}-*.js').scan({ cwd: DIST })) {
    locales.push(path);
  }
  const areaModules: string[] = [];
  for await (const path of new Bun.Glob('area-bale-*.js').scan({ cwd: DIST })) {
    areaModules.push(path);
  }
  if (areaModules.length !== 1) {
    throw new Error(`expected one lazy bale area module, found ${areaModules.length}`);
  }
  const rest = await brotliTotal(['assets/manifest.json', ...areaModules, ...models, ...locales]);
  return measure(
    budget('first-playable-frame'),
    (shell.actual ?? 0) + rest,
    `shell + ${locales.length} locale chunks + area data + manifest + ${models.length} models`,
  );
}

/** The lazy area module plus every model fetched on first entry to that area. */
async function measureAreaChunk(): Promise<Measurement> {
  const manifest = (await Bun.file(join(DIST, 'assets', 'manifest.json')).json()) as Record<
    string,
    { url: string }
  >;
  const modules: string[] = [];
  for await (const path of new Bun.Glob('area-pasar-*.js').scan({ cwd: DIST })) modules.push(path);
  if (modules.length !== 1) {
    throw new Error(`expected one lazy pasar area module, found ${modules.length}`);
  }
  const models = PASAR_AREA.models.map((id) => {
    const entry = manifest[id];
    if (!entry) throw new Error(`dist/assets/manifest.json has no ${id}`);
    return `assets/${entry.url}`;
  });
  const files = [...modules, ...models];
  return measure(budget('area-chunk'), await brotliTotal(files), files.join(', '));
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
  const firstFrame = await measureFirstFrame(shell);
  const areaChunk = await measureAreaChunk();
  const locales = await measureLocales();
  const pending = BUDGETS.filter((entry) => entry.pendingUntil !== undefined).map((entry) =>
    measure(entry, undefined),
  );
  const all = [shell, firstFrame, areaChunk, ...locales, ...pending];

  console.log('\n  size budget — PERFORMANCE_BUDGET §2\n');
  console.log(`  ${'shell (brotli)'}`);
  console.log(line(shell));
  console.log('\n  first playable frame (brotli)');
  console.log(line(firstFrame));
  console.log('\n  additional area chunks (brotli)');
  console.log(line(areaChunk));
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
