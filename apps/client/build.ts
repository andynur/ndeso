#!/usr/bin/env bun
/**
 * Production build for `apps/client` (ARCHITECTURE §7).
 *
 * `Bun.build` from `index.html`: Bun follows the `<script>` and `<link rel="stylesheet">`
 * tags itself, so there is no separate bundler config. Output is content-hashed, minified
 * and split, and `index.html` is rewritten to point at the hashed files.
 *
 * Afterwards it writes `precache-manifest.json` — the core shell only, never the area
 * chunks — which the service worker of M2-15 will read.
 *
 *   bun run build
 *   bun apps/client/build.ts --outdir dist/preview --no-minify
 */

import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { shellFiles } from '../../tools/size/shell.ts';

const CLIENT_DIR = import.meta.dir;
const REPO_ROOT = join(CLIENT_DIR, '../..');
const DEFAULT_OUTDIR = join(REPO_ROOT, 'dist');
const PUBLIC_DIR = join(CLIENT_DIR, 'public');

export interface BuildOptions {
  readonly outdir: string;
  readonly minify: boolean;
  /** Hosting serves hashed files from the site root (ARCHITECTURE §7). */
  readonly publicPath: string;
}

export interface BuiltFile {
  /** Path relative to `outdir`, as the browser will request it. */
  readonly path: string;
  readonly bytes: number;
  readonly kind: string;
}

export interface BuildResult {
  readonly outdir: string;
  readonly files: readonly BuiltFile[];
  readonly durationMs: number;
}

function parseArgs(argv: readonly string[]): BuildOptions {
  const outdirIndex = argv.indexOf('--outdir');
  const requested = outdirIndex === -1 ? undefined : (argv[outdirIndex + 1] as string);
  return {
    outdir:
      requested === undefined
        ? DEFAULT_OUTDIR
        : isAbsolute(requested)
          ? requested
          : join(REPO_ROOT, requested),
    minify: !argv.includes('--no-minify'),
    publicPath: '/',
  };
}

export async function build(options: BuildOptions): Promise<BuildResult> {
  const started = Bun.nanoseconds();
  await rm(options.outdir, { recursive: true, force: true });
  await mkdir(options.outdir, { recursive: true });

  const result = await Bun.build({
    entrypoints: [join(CLIENT_DIR, 'index.html')],
    outdir: options.outdir,
    target: 'browser',
    format: 'esm',
    splitting: true,
    minify: options.minify,
    sourcemap: 'linked',
    publicPath: options.publicPath,
    // Flat, content-hashed output. `[dir]` would echo the source tree's `../../packages/…`
    // into the URL; nothing downstream cares where a chunk came from. `index.html` stays
    // unhashed because ARCHITECTURE §7 serves it `no-cache`.
    naming: {
      entry: '[name].[ext]',
      chunk: '[name]-[hash].[ext]',
      asset: '[name]-[hash].[ext]',
    },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log.message);
    throw new AggregateError(result.logs, 'Bun.build failed');
  }

  // `public/` ships as-is: manifest.webmanifest, icons (M2-15). A static file must never
  // silently overwrite a bundler output — the hash in the name would then be a lie.
  if (existsSync(PUBLIC_DIR)) {
    const emitted = new Set(
      result.outputs.map((output) => relative(options.outdir, output.path).replaceAll('\\', '/')),
    );
    const collisions: string[] = [];
    for await (const path of new Bun.Glob('**/*').scan({ cwd: PUBLIC_DIR })) {
      if (emitted.has(path.replaceAll('\\', '/'))) collisions.push(path);
    }
    if (collisions.length > 0) {
      throw new Error(
        `public/ would overwrite build output: ${collisions.join(', ')}. Rename the static file.`,
      );
    }
    await cp(PUBLIC_DIR, options.outdir, { recursive: true });
  }

  const files: BuiltFile[] = [];
  for await (const path of new Bun.Glob('**/*').scan({ cwd: options.outdir })) {
    const normalized = path.replaceAll('\\', '/');
    files.push({
      path: normalized,
      bytes: (await Bun.file(join(options.outdir, path)).stat()).size,
      kind: normalized.slice(normalized.lastIndexOf('.') + 1),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));

  // The core shell only, never the area chunks (ARCHITECTURE §7). One definition of "shell"
  // for the whole repo: index.html plus exactly what it links, shared with `check:size`.
  const shell = shellFiles(await Bun.file(join(options.outdir, 'index.html')).text());
  const shellFingerprint = shell.map((path) => {
    const file = files.find((entry) => entry.path === path);
    if (file === undefined) throw new Error(`index.html references a missing file: ${path}`);
    return `${file.path}:${file.bytes}`;
  });
  await Bun.write(
    join(options.outdir, 'precache-manifest.json'),
    `${JSON.stringify(
      {
        // The SW of M2-15 compares this to decide what to precache on install.
        revision: Bun.hash(shellFingerprint.join('\n')).toString(16),
        shell: shell.map((path) => `/${path}`),
      },
      null,
      2,
    )}\n`,
  );

  return {
    outdir: options.outdir,
    files,
    durationMs: (Bun.nanoseconds() - started) / 1e6,
  };
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const result = await build(options);

  const hashed = result.files.filter((file) => /-[0-9a-z]{8,}\.\w+$/.test(file.path));
  const total = result.files.reduce((sum, file) => sum + file.bytes, 0);

  console.log(
    `\n  build → ${relative(REPO_ROOT, result.outdir)}/  (${result.durationMs.toFixed(0)} ms)\n`,
  );
  for (const file of result.files) {
    if (file.path.endsWith('.map')) continue;
    console.log(`    ${file.path.padEnd(40)} ${(file.bytes / 1024).toFixed(1).padStart(8)} KB`);
  }
  console.log(
    `\n  ${result.files.length} files, ${hashed.length} content-hashed, ${(total / 1024).toFixed(1)} KB on disk.`,
  );
  console.log(`  Run \`bun run check:size\` for the budget report (PERFORMANCE_BUDGET §2).\n`);
  return 0;
}

if (import.meta.main) process.exit(await main());
