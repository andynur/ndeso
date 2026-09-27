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
import { join, relative } from 'node:path';

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

/**
 * The core shell: what a cold visit needs before anything can be shown. Area chunks and
 * locale bundles beyond the source locale load on demand, so they stay out of the manifest
 * and out of the shell budget (PERFORMANCE_BUDGET §2).
 */
export function isShellFile(path: string): boolean {
  if (path.endsWith('.map')) return false;
  if (/^locales\//.test(path)) return false;
  return /\.(html|js|css)$/.test(path);
}

function parseArgs(argv: readonly string[]): BuildOptions {
  const outdirIndex = argv.indexOf('--outdir');
  return {
    outdir: outdirIndex === -1 ? DEFAULT_OUTDIR : join(REPO_ROOT, argv[outdirIndex + 1] as string),
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

  // `public/` ships as-is: manifest.webmanifest, icons (M2-15).
  if (existsSync(PUBLIC_DIR)) {
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

  await Bun.write(
    join(options.outdir, 'precache-manifest.json'),
    `${JSON.stringify(
      {
        // The SW of M2-15 compares this to decide what to precache on install.
        revision: Bun.hash(files.map((file) => `${file.path}:${file.bytes}`).join('\n')).toString(
          16,
        ),
        shell: files.filter((file) => isShellFile(file.path)).map((file) => `/${file.path}`),
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
