#!/usr/bin/env bun
/**
 * `check:links` — every relative markdown link and image in the repo resolves to a file
 * that exists, and every in-page `#anchor` matches a heading in the target document.
 *
 * Docs are the primary interface of this project for both humans and agents: AGENTS.md
 * routes work by pointing at files, and a dead pointer sends an agent to invent what it
 * cannot find. Renames and section renumbering (GDD gained a §5, shifting §5–§12) are
 * exactly when these rot, which is why this is a gate rather than a habit.
 *
 * External links (http/https/mailto) are NOT fetched: a gate that needs the network is a
 * gate that fails for reasons that have nothing to do with the commit.
 */
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

/** `[text](target)` — not `![alt](target)` handled separately, both shapes are caught. */
const LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export interface LinkRef {
  readonly target: string;
  readonly line: number;
}

export function extractLinks(markdown: string): LinkRef[] {
  const refs: LinkRef[] = [];
  const lines = markdown.split('\n');
  let inFence = false;
  for (const [index, line] of lines.entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    // Strip inline code so `[foo](bar)` inside backticks is not treated as a link.
    const bare = line.replace(/`[^`]*`/g, '');
    for (const match of bare.matchAll(LINK)) {
      const target = match[1];
      if (target !== undefined) refs.push({ target, line: index + 1 });
    }
  }
  return refs;
}

/**
 * GitHub's heading-anchor rules, close enough for our own docs.
 *
 * Note the per-character space replacement: GitHub emits one hyphen for *each* space, so
 * "policy — read" (whose em dash is dropped, leaving two spaces) anchors as
 * `policy--read`. Collapsing runs with `\s+` would reject links that actually work.
 */
export function slugify(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s/g, '-');
}

export function headingAnchors(markdown: string): Set<string> {
  const anchors = new Set<string>();
  for (const line of markdown.split('\n')) {
    const match = /^#{1,6}\s+(.*)$/.exec(line);
    if (match?.[1] !== undefined) anchors.add(slugify(match[1]));
  }
  return anchors;
}

export function isExternal(target: string): boolean {
  return /^(https?:|mailto:|tel:|#)/.test(target);
}

async function main(): Promise<number> {
  const proc = Bun.spawn(['git', 'ls-files', '-z', '*.md'], { cwd: ROOT, stdout: 'pipe' });
  const listing = await new Response(proc.stdout).text();
  const files = listing.split('\0').filter((name) => name !== '');

  const anchorCache = new Map<string, Set<string>>();
  const problems: string[] = [];
  let checked = 0;

  for (const file of files) {
    const source = await Bun.file(join(ROOT, file)).text();
    for (const { target, line } of extractLinks(source)) {
      if (target.startsWith('#')) {
        // Same-document anchor.
        let anchors = anchorCache.get(file);
        if (anchors === undefined) {
          anchors = headingAnchors(source);
          anchorCache.set(file, anchors);
        }
        checked += 1;
        if (!anchors.has(target.slice(1))) {
          problems.push(`${file}:${line} → ${target} (no such heading)`);
        }
        continue;
      }
      if (isExternal(target)) continue;

      checked += 1;
      const [path, anchor] = target.split('#');
      if (path === undefined || path === '') continue;
      const resolved = resolve(dirname(join(ROOT, file)), path);
      if (!(await Bun.file(resolved).exists())) {
        // Directories are legitimate link targets and `Bun.file().exists()` says no.
        const dir = Bun.spawnSync(['test', '-d', resolved]);
        if (dir.exitCode !== 0) {
          problems.push(`${file}:${line} → ${target} (missing ${relative(ROOT, resolved)})`);
          continue;
        }
      }
      if (anchor === undefined || !resolved.endsWith('.md')) continue;

      let anchors = anchorCache.get(resolved);
      if (anchors === undefined) {
        anchors = headingAnchors(await Bun.file(resolved).text());
        anchorCache.set(resolved, anchors);
      }
      if (!anchors.has(anchor)) {
        problems.push(`${file}:${line} → ${target} (no such heading in target)`);
      }
    }
  }

  if (problems.length > 0) {
    console.error('check:links failed —');
    for (const problem of problems) console.error(`  ${problem}`);
    return 1;
  }
  console.log(`check:links ok — ${checked} internal link(s) across ${files.length} file(s).`);
  return 0;
}

if (import.meta.main) {
  process.exit(
    await main().catch((error: unknown) => {
      console.error(
        `check:links failed — ${error instanceof Error ? error.message : String(error)}`,
      );
      return 1;
    }),
  );
}
