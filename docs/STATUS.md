# STATUS — session handoff log

> **Agents: read the "Now" block first; append a short entry at the end of every session.** Keep the Now block ≤ 15 lines.
> The SessionStart hook prints the top of this file into context, so keep it short and current. Put older history under "Log" (newest first) and trim entries older than ~10 sessions into `docs/status-archive.md`.

## Now
- **Milestone:** M0 — Bootstrap
- **Next task:** M0-04 (i18n runtime: `t`, `format.money`, locale switch + `tools/i18n/check.ts`)
- **Blockers:** none
- **Open decisions:** final game title (PRD §12)
- **Known issues:** unimplemented `bun run` scripts are `tools/todo.ts` stubs that print `TODO <task-id>` and exit 0 (deps M0-05, i18n M0-04, content M2-01, build/size M0-07, smoke M2-19). `check:deps` is still a stub, so ARCHITECTURE §2 import boundaries are only enforced by the PostToolUse hook.

## Log
<!-- Newest first. Format:
### YYYY-MM-DD · <task id> · <branch/PR>
- Done: …
- Tests: …
- Notes/decisions: …
- Next: …
-->
### 2026-09-27 · M0-03 · feat/M0-03-client-bootstrap
- Done: `apps/client` walking skeleton — `index.html` + `src/main.ts`, Three.js scene (ground plane, rotating low-poly house placeholder, camera per DESIGN §1.1: FOV 30 / pitch 38 / distance 14), Preact overlay reading strings from the locale bundles, `src/ui/tokens.ts` mirroring DESIGN §2, `src/render/quality/presets.ts` (preset + DPR cap per PERF §4). `tools/dev.ts` serves it with HMR on `0.0.0.0` and prints the LAN URL.
- Tests: `bun run check` green; 26 tests across 5 files (8 new for `quality.ts`). Verified in headless Chromium: overlay renders over the WebGL canvas, no page console errors, scene draws.
- Notes/decisions:
  - `check:types` is now two programs: `tsc -b --noEmit` for `packages/*` + `tools/*` (bun-types), then `tsc -b apps/client --noEmit` for browser code (`lib: ["DOM","ES2023"]`, `types: []`) as TECH_STACK §4 requires. Build mode accepts `--noEmit` per project; it is only composite *references* that TS 5.9 rejects (TS6310), so no project references were reintroduced.
  - Added dev dep `@types/three` (three ships no declarations), pinned to three's minor and listed in TECH_STACK §2. Types only — never bundled.
  - New strings `boot.hello` / `boot.placeholder` in both `locales/en/ui.json` and `locales/id/ui.json`; no hardcoded player-facing text. `src/i18n/boot.ts` is a ~20-line eager loader (`resolveLocale(navigator.languages)` + JSON imports) so the first frame needs no fetch; M0-04 replaces it with the real runtime.
  - ARCHITECTURE §2 forbids `render/` importing `ui/`, so `main.ts` reads `ui/tokens.ts` and passes a `ScenePalette` down instead of the scene importing the tokens. Lighting uses the DESIGN §1.3 noon keyframe directly (those are lighting values, not §2 palette tokens); M1-07 moves the table into `content/data/lighting.json5`.
  - The scene owns only rendering plumbing (DPR cap, resize observer, `visibilitychange` pause, `webglcontextlost`/`restored`). The fixed-step loop and interpolation are M1-02; sprites M1-03; the full camera rig M1-04.
  - **Not verified on a real phone yet** — the ROADMAP AC "loads on a phone" needs the maintainer to open the printed LAN URL. The device checklist is M1-10.
- Next: M0-04
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
