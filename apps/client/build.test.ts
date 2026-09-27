import { describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from './build.ts';

const OUTDIR = join(import.meta.dir, '../../.cache/build-test');

interface Manifest {
  readonly revision: string;
  readonly shell: readonly string[];
}

// One build, several assertions: Bun.build dominates the runtime, so re-running it per test
// would cost seconds for no extra coverage.
const result = await build({ outdir: OUTDIR, minify: false, publicPath: '/' });
const manifest = (await Bun.file(join(OUTDIR, 'precache-manifest.json')).json()) as Manifest;

describe('build', () => {
  test('emits an unhashed index.html — ARCHITECTURE §7 serves it no-cache', () => {
    expect(result.files.map((file) => file.path)).toContain('index.html');
  });

  test('content-hashes the script and the stylesheet', () => {
    const hashed = result.files.filter((file) => /-[0-9a-z]{8,}\.(js|css)$/.test(file.path));
    expect(hashed.length).toBeGreaterThanOrEqual(2);
    expect(hashed.some((file) => file.path.endsWith('.js'))).toBe(true);
    expect(hashed.some((file) => file.path.endsWith('.css'))).toBe(true);
  });

  test('every emitted file is non-empty', () => {
    for (const file of result.files) expect(file.bytes).toBeGreaterThan(0);
  });
});

describe('precache-manifest.json', () => {
  test('lists index.html plus exactly what it links, as root-absolute URLs', () => {
    expect(manifest.shell[0]).toBe('/index.html');
    expect(manifest.shell).toHaveLength(3); // html + entry js + css
    for (const path of manifest.shell) expect(path.startsWith('/')).toBe(true);
  });

  test('leaves lazily loaded locale chunks out of the shell', () => {
    // The regression this file exists for: flat output naming erased the `locales/` prefix
    // a path-pattern check had relied on, so both locale bundles were precached as shell.
    const localeChunks = result.files.filter((file) => /^(ui|glossary)-/.test(file.path));
    expect(localeChunks.length).toBeGreaterThan(0);
    for (const chunk of localeChunks) expect(manifest.shell).not.toContain(`/${chunk.path}`);
  });

  test('never lists a file the build did not emit', () => {
    const emitted = new Set(result.files.map((file) => `/${file.path}`));
    for (const path of manifest.shell) expect(emitted.has(path)).toBe(true);
  });

  test('has a revision derived from the shell', () => {
    expect(manifest.revision).toMatch(/^[0-9a-f]+$/);
  });
});

await rm(OUTDIR, { recursive: true, force: true });
