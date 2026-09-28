#!/usr/bin/env bun
/**
 * `bun run assets` — the asset pipeline minimum (ASSET_PIPELINE §3).
 *
 * Sources today are the generated placeholders (`tools/placeholders/`); a Blender export at
 * `assets-src/models/<area>/<id>.glb` takes precedence over the placeholder with the same
 * id, which is how final art swaps in without a code change (ASSET_PIPELINE §4). Each model
 * goes through `gltf-transform optimize` — dedup, weld, prune, and meshopt compression —
 * and lands content-hashed in `assets/`, listed in `assets/manifest.json`.
 *
 * Incremental: `.cache/assets.json` remembers each source's hash, so an unchanged model is
 * not re-optimised. `assets/` and `.cache/` are git-ignored; nothing here is committed.
 *
 *   bun run assets
 *   bun run assets --force     # ignore the cache
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import type { AssetManifest } from '@bale/shared';
import { BALE_AREA } from '../../packages/content/src/areas-bundle.ts';
import { balePlaceholders } from '../placeholders/bale.ts';
import { writeGlb } from './glb.ts';

const REPO_ROOT = join(import.meta.dir, '../..');
export const ASSETS_DIR = join(REPO_ROOT, 'assets');
const SOURCE_DIR = join(REPO_ROOT, 'assets-src', 'models');
const CACHE_DIR = join(REPO_ROOT, '.cache');
const CACHE_FILE = join(CACHE_DIR, 'assets.json');
const CLI = join(REPO_ROOT, 'node_modules', '.bin', 'gltf-transform');
const GLB_TYPE = 'model/gltf-binary';

/** Everything `optimize` would do that placeholders and low-poly art do not want is off. */
const OPTIMIZE_FLAGS = [
  '--compress',
  'meshopt',
  '--texture-compress',
  'false',
  '--simplify',
  'false',
  '--instance',
  'false',
  '--flatten',
  'false',
  '--join',
  'false',
  '--palette',
  'false',
];

export interface ModelSource {
  readonly id: string;
  /** `<area>` from the id: the manifest groups by it and the output folder is named after it. */
  readonly area: string;
  readonly bytes: Uint8Array;
  readonly origin: 'placeholder' | 'assets-src';
}

interface CacheEntry {
  readonly sourceHash: string;
  readonly url: string;
  readonly bytes: number;
}

/** `bale_joglo_lvl0` → `bale`. DESIGN §11: `<area|category>_<name>_<variant>`. */
export function areaOf(id: string): string {
  const area = id.split('_')[0];
  if (!area || !/^[a-z][a-z0-9_]*$/.test(id)) throw new Error(`bad asset id '${id}'`);
  return area;
}

/** `models/bale/bale_joglo_lvl0-1a2b3c4d.glb`, relative to `assets/`. */
export function hashedUrl(id: string, bytes: Uint8Array): string {
  const hash = Bun.hash(bytes).toString(16).padStart(16, '0').slice(0, 8);
  return `models/${areaOf(id)}/${id}-${hash}.glb`;
}

export function placeholderSources(): ModelSource[] {
  return Object.entries(balePlaceholders(BALE_AREA)).map(([id, meshes]) => ({
    id,
    area: areaOf(id),
    bytes: writeGlb(meshes, 'bale placeholder (tools/placeholders)'),
    origin: 'placeholder',
  }));
}

async function exportedSources(): Promise<ModelSource[]> {
  if (!existsSync(SOURCE_DIR)) return [];
  const found: ModelSource[] = [];
  for await (const path of new Bun.Glob('*/*.glb').scan({ cwd: SOURCE_DIR })) {
    const id = path.split('/')[1]?.replace(/\.glb$/, '') ?? '';
    found.push({
      id,
      area: areaOf(id),
      bytes: new Uint8Array(await Bun.file(join(SOURCE_DIR, path)).arrayBuffer()),
      origin: 'assets-src',
    });
  }
  return found;
}

/** Exports win over placeholders with the same id. */
export function mergeSources(
  placeholders: readonly ModelSource[],
  exported: readonly ModelSource[],
): ModelSource[] {
  const byId = new Map<string, ModelSource>();
  for (const source of [...placeholders, ...exported]) byId.set(source.id, source);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function optimize(input: Uint8Array): Promise<Uint8Array> {
  if (!existsSync(CLI)) throw new Error('gltf-transform is missing — run `bun install`');
  const work = join(CACHE_DIR, 'work');
  await mkdir(work, { recursive: true });
  const stamp = `${process.pid}-${Bun.hash(input).toString(16)}`;
  const inPath = join(work, `${stamp}.in.glb`);
  const outPath = join(work, `${stamp}.out.glb`);
  await Bun.write(inPath, input);
  // Run the CLI under Bun: no Node needed on the machine or in CI.
  const run = Bun.spawn([process.execPath, CLI, 'optimize', inPath, outPath, ...OPTIMIZE_FLAGS], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [code, stderr] = await Promise.all([run.exited, new Response(run.stderr).text()]);
  if (code !== 0) throw new Error(`gltf-transform optimize failed (${code}):\n${stderr}`);
  const out = new Uint8Array(await Bun.file(outPath).arrayBuffer());
  await rm(inPath, { force: true });
  await rm(outPath, { force: true });
  return out;
}

async function readCache(): Promise<Record<string, CacheEntry>> {
  const file = Bun.file(CACHE_FILE);
  if (!(await file.exists())) return {};
  try {
    return (await file.json()) as Record<string, CacheEntry>;
  } catch {
    return {};
  }
}

export interface AssetsResult {
  readonly manifest: AssetManifest;
  readonly built: readonly string[];
  readonly reused: readonly string[];
}

export async function buildAssets(options: { force?: boolean } = {}): Promise<AssetsResult> {
  const sources = mergeSources(placeholderSources(), await exportedSources());
  const cache = options.force ? {} : await readCache();
  const manifest: Record<string, { url: string; bytes: number; type: string }> = {};
  const nextCache: Record<string, CacheEntry> = {};
  const built: string[] = [];
  const reused: string[] = [];

  for (const source of sources) {
    const sourceHash = Bun.hash(source.bytes).toString(16);
    const cached = cache[source.id];
    let entry: CacheEntry;
    if (cached?.sourceHash === sourceHash && existsSync(join(ASSETS_DIR, cached.url))) {
      entry = cached;
      reused.push(source.id);
    } else {
      const optimized = await optimize(source.bytes);
      const url = hashedUrl(source.id, optimized);
      await mkdir(dirname(join(ASSETS_DIR, url)), { recursive: true });
      await Bun.write(join(ASSETS_DIR, url), optimized);
      entry = { sourceHash, url, bytes: optimized.byteLength };
      built.push(source.id);
    }
    nextCache[source.id] = entry;
    manifest[source.id] = { url: entry.url, bytes: entry.bytes, type: GLB_TYPE };
  }

  // Drop outputs no manifest entry points at any more (old hashes, removed models).
  const live = new Set(Object.values(manifest).map((entry) => entry.url));
  const modelsDir = join(ASSETS_DIR, 'models');
  if (existsSync(modelsDir)) {
    for (const area of await readdir(modelsDir)) {
      for (const file of await readdir(join(modelsDir, area))) {
        const url = `models/${area}/${file}`;
        if (!live.has(url)) await rm(join(modelsDir, area, file), { force: true });
      }
    }
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await Bun.write(CACHE_FILE, `${JSON.stringify(nextCache, null, 2)}\n`);
  await Bun.write(join(ASSETS_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, built, reused };
}

async function main(): Promise<number> {
  const started = Bun.nanoseconds();
  const { manifest, built, reused } = await buildAssets({
    force: process.argv.includes('--force'),
  });
  console.log(
    `\n  assets → ${relative(REPO_ROOT, ASSETS_DIR)}/  (${((Bun.nanoseconds() - started) / 1e6).toFixed(0)} ms)\n`,
  );
  for (const [id, entry] of Object.entries(manifest)) {
    const state = built.includes(id) ? 'built ' : reused.includes(id) ? 'cached' : '      ';
    console.log(
      `    ${state}  ${id.padEnd(24)} ${(entry.bytes / 1024).toFixed(1).padStart(7)} KB  ${entry.url}`,
    );
  }
  console.log('');
  return 0;
}

if (import.meta.main) process.exit(await main());
