#!/usr/bin/env bun
/**
 * PostToolUse hook for Edit|Write|MultiEdit.
 * 1. Blocks (exit 2 → feedback to Claude) edits that break an ARCHITECTURE §2 boundary,
 *    using the very rules `bun run check:deps` runs in CI — so the hook can never drift
 *    from the gate.
 * 2. Formats the edited file with Biome when it is installed (keeps diffs clean, saves review tokens).
 * Must stay fast (< 300 ms) and silent on success.
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { checkSource } from '../../tools/deps/rules.ts';

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

// ── 1. Boundary guard ─────────────────────────────────────────────────
if (/\.(ts|tsx)$/.test(rel)) {
  const violations = checkSource(rel, readFileSync(file, 'utf8'));
  if (violations.length > 0) {
    const lines = violations.map((v) => `  ${rel}:${v.line}: ${v.message}`).join('\n');
    console.error(
      `✖ ${rel} breaks an import boundary:\n${lines}\n` +
        'The rules are the table in docs/ARCHITECTURE.md §2; `bun run check:deps` runs the same check.',
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
