#!/usr/bin/env bun
/**
 * PostToolUse hook for Edit|Write|MultiEdit.
 * 1. Blocks (exit 2 → feedback to Claude) forbidden APIs/imports in packages/sim (ADR-0003).
 * 2. Formats the edited file with Biome when it is installed (keeps diffs clean, saves review tokens).
 * Must stay fast (< 300 ms) and silent on success.
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';

type HookInput = { tool_input?: { file_path?: string }; cwd?: string };

const raw = await Bun.stdin.text();
let input: HookInput = {};
try {
  input = JSON.parse(raw) as HookInput;
} catch {
  process.exit(0);
}

const file = input.tool_input?.file_path;
if (!file || !existsSync(file)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const rel = relative(root, file).replaceAll('\\', '/');

// ── 1. Sim purity guard ────────────────────────────────────────────────
if (/^packages\/sim\/.*\.(ts|tsx)$/.test(rel)) {
  const src = readFileSync(file, 'utf8');
  const rules: Array<[RegExp, string]> = [
    [/from\s+['"](three|preact|@preact\/[^'"]+)['"]/, 'imports three/preact'],
    [/\b(window|document|localStorage|navigator)\s*\./, 'uses a DOM/browser global'],
    [/\bMath\.random\s*\(/, 'uses Math.random (use the seeded rng in state)'],
    [/\b(Date\.now|performance\.now)\s*\(/, 'reads wall-clock time (use sim ticks)'],
    [
      /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/,
      'uses timers (sim is stepped externally)',
    ],
  ];
  const hits = rules.filter(([re]) => re.test(src)).map(([, why]) => why);
  if (hits.length > 0) {
    console.error(
      `✖ ${rel} ${hits.join('; ')}.\n` +
        'packages/sim must stay pure and deterministic (docs/adr/0003-deterministic-sim.md). Move this to apps/client or pass it in via commands/ctx.',
    );
    process.exit(2);
  }
}

// ── 2. Format with Biome (only if installed) ──────────────────────────
const biome = `${root}/node_modules/.bin/biome`;
if (/\.(ts|tsx|js|jsx|json|jsonc|css)$/.test(rel) && existsSync(biome)) {
  Bun.spawnSync([biome, 'format', '--write', file], { stdout: 'ignore', stderr: 'ignore' });
}
process.exit(0);
