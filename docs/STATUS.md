# STATUS — session handoff log

> **Agents: read the "Now" block first; append a short entry at the end of every session.** Keep the Now block ≤ 15 lines.
> The SessionStart hook prints the top of this file into context, so keep it short and current. Put older history under "Log" (newest first) and trim entries older than ~10 sessions into `docs/status-archive.md`.

## Now
- **Milestone:** M0 — Bootstrap
- **Next task:** M0-03 (apps/client: Bun dev server + Three.js placeholder + Preact overlay)
- **Blockers:** none
- **Open decisions:** final game title (PRD §12)
- **Known issues:** unimplemented `bun run` scripts are `tools/todo.ts` stubs that print `TODO <task-id>` and exit 0 (deps M0-05, i18n M0-04, content M2-01, build/size M0-07, dev M0-03, smoke M2-19)

## Log
<!-- Newest first. Format:
### YYYY-MM-DD · <task id> · <branch/PR>
- Done: …
- Tests: …
- Notes/decisions: …
- Next: …
-->
### 2026-09-27 · M0-01 + M0-02 · feat/M0-01-workspace-bootstrap
- Done: Root Bun workspace (`package.json` with every TESTING §1 script, `bunfig.toml` exact installs, `tsconfig.base.json`, `biome.json`); `packages/shared` (constants, `SUPPORTED_LOCALES`/`resolveLocale` per I18N §5), `packages/sim` (`SimContext`/`System` contracts + placeholder `hello` system), `packages/content` (locale seed loader over the existing `locales/`).
- Tests: `bun run check` green; `bun run ci` green (build/size/smoke are stubs); 18 tests across shared, sim, content.
- Notes/decisions:
  - `check:types` stays `tsc -b --noEmit`, but as **one root program** with `incremental` instead of composite project references: TS 5.9 rejects `--noEmit` in build mode against composite references (TS6310). M0-03 adds `apps/client` as a separate project (`lib: ["DOM","ES2023"]`, no bun-types) and can reintroduce references then.
  - Added dev dep `bun-types@1.4.1` (needed by the `types: ["bun-types"]` convention in TECH_STACK §4) and listed it in TECH_STACK §2.
  - `allowImportingTsExtensions` is on so source-to-source workspace imports (`./foo.ts`) type-check; Bun resolves them natively.
  - Biome 2.3.14 with `recommended` + `noExplicitAny: error` + `noConsole: warn` (off in `tools/`, `scripts/`) + `noDefaultExport: error`. Its first run reformatted the pre-existing `.claude/settings.json`.
  - `hello` is a walking skeleton (ticks → `helloSecond` events); M1-01 replaces it with the real `time` system.
- Next: M0-03
### 2026-09-27 · README · docs
- Done: Reworked the English README for GitHub onboarding, project status, repository structure, contribution flow, security, and licensing.
- Tests: Documentation-only change; runtime checks are not available before M0-01.
- Notes/decisions: Kept the README explicit that the project is not playable yet and linked the Indonesian README.
- Next: M0-01
### 2026-09-26 · setup · docs
- Done: PRD, GDD, DESIGN, architecture docs, AI harness (CLAUDE.md, AGENTS.md, .claude/, .mcp.json)
- Next: M0-01
