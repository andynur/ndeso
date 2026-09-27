@AGENTS.md

# Claude Code specifics

## Token discipline (this project runs mostly in cloud sessions)
- **Narrow before you read.** `Grep` with `output_mode: "count"` to find *where*, then `-n` with `-C 3` to read only *that*. `sed -n 'A,Bp'` for a known slice.
- **Read a file whole only if it is small (< 150 lines) or you are rewriting most of it.** Never `cat` a large file to "have a look".
- **Keep big output out of context.** Pipe through `| tail -n 40`, `| grep`, or an `awk` one-liner that prints the number you actually wanted. `BASH_MAX_OUTPUT_LENGTH` is 20 000 — hitting it means you asked the wrong question.
- **Don't re-read** a file you just wrote or edited; Edit and Write fail loudly if they did not apply. Don't paste code back into chat.
- **Never open**: `bun.lock`, `dist/`, `assets/`, `assets-src/`, `*.glb`, `*.ktx2`, images, `node_modules/` (denied in settings anyway).
- Before a long task, check `/context`. Compact proactively with a focus: `/compact keep task M1-03 decisions and failing tests`.

## Shell safety (each of these has already cost us a bug)
- **Never chain a possibly-denied read into a compound command.** A deny-list match kills the *whole* command, so `patch-a-file && cat dist/x.json` silently skips the patch. Denied paths: `dist/`, `assets/`, `assets-src/`, `bun.lock`, `.env*`. Same for `git reset --hard` inside an `&&` chain.
- **Edit source files with `Edit`/`Write`, not `sed -i`.** `Edit` fails loudly when the target text is absent; `sed -i` succeeds having changed nothing. `sed`/`awk` are for *reading*. Bulk renames across many files are the one exception — verify with `grep` straight after.
- **Verify before committing anything patched through the shell.** The one bug that reached `main` in this repo was an edit that never applied.

## Subagents (`.claude/agents/`) — they start cold, so spend them deliberately
| Agent | Model | Use when |
|---|---|---|
| `scout` | Haiku | "where is X / what calls Y" that would otherwise need many file reads |
| `reviewer` | Sonnet | **Required** before a PR that touches > 5 files or anything in `packages/sim`. **Skip** for a one-file or docs-typo PR — a review costs ~90k tokens because it re-derives context from scratch |
| `i18n-translator` | Sonnet | Filling `[TODO-ID]` strings in the DESIGN §9 voice |
| `perf-auditor` | Sonnet | After render changes, new assets, or a dependency addition |

## Repo tools instead of hand-rolled shell
- `bun tools/gh.ts pr-create|pr-status|pr-merge|checks|wait` — GitHub REST. Use it rather than `curl`: `curl` cannot be safely allow-listed (permission patterns match a command prefix, and the URL comes after the flags), and PR bodies full of backticks and newlines get mangled by a shell. Bodies are passed as a **file**.
- `bun run check:links` — part of `bun run check`.

## Skills (load on demand)
- `next-task` — pick up the next ROADMAP task end-to-end (plan → implement → check → handoff).
- `add-game-content` — add a crop, item, NPC, or festival via data + locales + tests.
- `i18n-string` — add or rename UI strings in EN + ID correctly.
- `session-handoff` — update STATUS.md and prepare the commit/PR text.
- `terse` — ultra-brief chat mode when the user asks for it or the context is tight.

## Hooks (configured in `.claude/settings.json`)
- **SessionStart:** cloud bootstrap (pinned Bun, deps) + prints the STATUS "Now" block.
- **PostToolUse(Edit|Write):** Biome format on the edited file + **blocks** forbidden imports, sharing `checkSource` with `check:deps` so the hook and the CI gate cannot drift. ~90 ms.

No MCP servers. Serena and context-mode were removed in [ADR-0008](docs/adr/0008-drop-serena-context-mode.md) — they were configured but never installed, so the guidance that depended on them was unfollowable.

## Git in cloud sessions
Work on the session branch, commit with the task id, and push. Open a PR only when the user asks or the task says so.
