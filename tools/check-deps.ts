#!/usr/bin/env bun
/**
 * `bun run check:deps` — the import boundary gate of ARCHITECTURE §2 (TESTING §1).
 *
 * Walks every source file in `packages/` and `apps/` and applies the zone table in
 * `tools/deps/rules.ts`: which region may import which, which npm packages each zone is
 * allowed, and the `packages/sim` purity rules. The same `checkSource` runs in the
 * PostToolUse edit hook, so an agent gets the failure while editing, not in CI.
 */

import { join } from 'node:path';
import { checkSource, regionOf } from './deps/rules.ts';

const REPO_ROOT = join(import.meta.dir, '..');

const SOURCE_GLOBS = [
  'packages/*/src/**/*.ts',
  'packages/*/src/**/*.tsx',
  'apps/*/src/**/*.ts',
  'apps/*/src/**/*.tsx',
  'apps/*/*.ts',
];

async function sourceFiles(): Promise<string[]> {
  const found = new Set<string>();
  for (const pattern of SOURCE_GLOBS) {
    for await (const file of new Bun.Glob(pattern).scan({ cwd: REPO_ROOT })) {
      found.add(file.replaceAll('\\', '/'));
    }
  }
  return [...found].sort();
}

async function main(): Promise<number> {
  const files = await sourceFiles();
  let failures = 0;
  const regions = new Set<string>();

  for (const file of files) {
    const region = regionOf(file);
    if (region !== undefined) regions.add(region);
    const source = await Bun.file(`${REPO_ROOT}/${file}`).text();
    for (const violation of checkSource(file, source)) {
      console.error(`  error  ${file}:${violation.line}: ${violation.message}`);
      failures += 1;
    }
  }

  const scope = `${files.length} files across ${regions.size} regions`;
  if (failures > 0) {
    console.error(`check:deps failed — ${failures} boundary violation(s) in ${scope}.`);
    console.error('The rules are the table in docs/ARCHITECTURE.md §2.');
    return 1;
  }
  console.log(`check:deps ok — ${scope}.`);
  return 0;
}

if (import.meta.main) process.exit(await main());
