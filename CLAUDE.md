@AGENTS.md

# Claude Code specifics

## Token discipline (this project runs mostly in cloud sessions)
- **Explore with symbols, not files.** Prefer Serena (`find_symbol`, `get_symbols_overview`, `find_referencing_symbols`, `replace_symbol_body`) over reading whole files. Read a file fully only if it is small (< 150 lines) or you must edit most of it.
- **Keep big output out of context.** For test logs, build output, large JSON, and web docs, use context-mode tools (`ctx_execute`, `ctx_batch_execute`, `ctx_fetch_and_index` + `ctx_search`) and print only what you need. Otherwise pipe through `| tail -n 40` / `grep`.
- **Delegate wide searches** to the `Explore` agent or `.claude/agents/scout`, which return conclusions rather than file dumps.
- **Don't re-read** files you just wrote or edited. Don't paste code back into chat.
- **Never open**: `bun.lock`, `dist/`, `assets/`, `assets-src/`, `*.glb`, `*.ktx2`, images, `node_modules/` (denied in settings anyway).
- Before a long task, check `/context`. Compact proactively with a focus: `/compact keep task M1-03 decisions and failing tests`.

## Skills (load on demand)
- `next-task` — pick up the next ROADMAP task end-to-end (plan → implement → check → handoff).
- `add-game-content` — add a crop, item, NPC, or festival via data + locales + tests.
- `i18n-string` — add or rename UI strings in EN + ID correctly.
- `session-handoff` — update STATUS.md and prepare the commit/PR text.
- `terse` — ultra-brief chat mode when the user asks for it or the context is tight.

## Subagents (`.claude/agents/`)
- `scout` (Haiku) — read-only codebase questions; returns file:line references + a 5-line answer.
- `reviewer` (Sonnet) — reviews the diff against AGENTS rules, ARCH boundaries, i18n, and budgets before the PR.
- `i18n-translator` (Sonnet) — fills `[TODO-ID]` strings using the DESIGN §9 voice and the glossary.
- `perf-auditor` (Sonnet) — reads the size report and render code for budget risks.

## Hooks (already configured in `.claude/settings.json`)
- SessionStart: cloud bootstrap (pinned Bun, deps) + prints the STATUS "Now" block.
- PostToolUse(Edit|Write): Biome format on the edited file + **blocks** forbidden imports in `packages/sim`.
- Serena reminder hooks (no-op when Serena isn't installed).

## Git in cloud sessions
Work on the session branch, commit with the task id, and push. Open a PR only when the user asks or the task says so.
