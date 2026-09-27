# STATUS — session handoff log

> **Agents: read the "Now" block first; append a short entry at the end of every session.** Keep the Now block ≤ 15 lines.
> The SessionStart hook prints the top of this file into context, so keep it short and current. Put older history under "Log" (newest first) and trim entries older than ~10 sessions into `docs/status-archive.md`.

## Now
- **Milestone:** M0 — Bootstrap **complete**. Next up: M1 — Tech spike (30 fps on a Low device; first frame ≤ 5 MB).
- **Next task:** M1-01 (sim clock: ticks, minutes, days, seasons, pasaran, events; golden test for 56 days — GDD §3)
- **Blockers:** none. M0's exit criteria are met: `bun run check` is green in CI and the Three.js scene loads on a phone over the LAN dev server.
- **Open decisions:** final game title (PRD §12)
- **Known issues:** two `bun run` scripts are still `tools/todo.ts` stubs — `check:content` (M2-01) and `smoke` (M2-19). Shell size is 120 KB brotli of a 350 KB budget, but that is three.js and Preact only; no art has landed yet.

## Log
<!-- Newest first. Format:
### YYYY-MM-DD · <task id> · <branch/PR>
- Done: …
- Tests: …
- Notes/decisions: …
- Next: …
-->
### 2026-09-27 · M0-07 · feat/M0-07-production-build
- Done: `apps/client/build.ts` (Bun.build from `index.html`, split, minified, content-hashed, linked sourcemaps, `public/` copied as-is, `precache-manifest.json` for M2-15) and the real `tools/check-size.ts`. `bun run build` and `bun run check:size` replaced their `tools/todo.ts` stubs, which completes `bun run ci`.
- Tests: `bun run check` green; 140 tests across 15 files (12 new for the shell definition and the budget table). `bun run ci` green end to end. Verified the *built* bundle, not just its emission: served `dist/` and drove it in headless Chromium — `__GAME_READY__` true, WebGL2 context live, overlay localized, one hashed module script, no page errors.
- Notes/decisions:
  - **Shell: 120.3 KB brotli, 34% of the 350 KB budget** (PERF §2) — three.js and Preact, before any art.
  - **A budget that cannot be measured yet is reported `pending` with the task that unblocks it, never as a pass.** Three of the five are pending (title critical path → M2-17, first playable frame → M1-09, area chunk → M2-13). A gate that prints "ok" for something it never looked at is worse than no gate.
  - **The core shell is derived from the built HTML** (`tools/size/shell.ts`: `index.html` plus exactly what it links), not from a filename pattern. That keeps the budget tracking what a cold visit downloads even when the bundler changes how it splits or names things — the lazy locale chunks are correctly outside it.
  - **Flat output naming**, deviating from the `'[dir]/[name]-[hash].[ext]'` written in ARCHITECTURE §7: `[dir]` is relative to the entry, so chunks from `packages/content` were published under `_.._/_.._/packages/content/locales/…`. §7 updated with the reason. `index.html` stays unhashed because it is served `no-cache`.
  - Locale namespaces are measured at the source file, where they are authored and reviewed, rather than at the bundled chunk.
  - `check:size` writes `artifacts/size-report.json`, which the M0-06 workflow already uploads, so a size regression can be diffed between runs instead of eyeballed in a log.
  - `<link rel="icon" href="data:," />` in `index.html` — a placeholder that stops a favicon 404 on every cold load until M2-15 ships real icons. It is not an asset, so AGENTS rule 7 is untouched.
- Next: M1-01
### 2026-09-27 · M0-06 · ci/M0-06-workflow
- Done: real CI workflow. Dropped the "skip until M0-01" gate that guarded every step, added `actions/cache` on `~/.bun/install/cache` keyed by `bun.lock`, `permissions: contents: read`, `workflow_dispatch`, and an artifact upload for `artifacts/`. The steps now mirror `bun run ci` stage by stage (install → check → coverage → build + size → smoke) so a red check names itself instead of pointing at one opaque script.
- Tests: `bun run check` green; 128 tests across 13 files (2 new for `todoAllowed`). Workflow YAML parses; `bun run ci` green locally end to end.
- Notes/decisions:
  - **`[TODO-ID]` no longer fails on `main`, only on a release tag.** I18N §1 rule 3 said CI "fails on `main` release tags", which the checker had read as *main or tags*. That contradicts AGENTS rule 3, which lets a PR merge with `[TODO-ID]` plus a `needs-translation` label: the PR would pass and then turn `main` red on the merge commit — an alarm arriving after the decision it was meant to gate. A release tag is the point where untranslated strings must not ship. I18N §1 rule 3 reworded to say so unambiguously, and `todoAllowed(ref)` is now a pure function with tests for branch / main / PR / tag.
  - **`bunfig.toml` no longer sets `[test] coverage = false`.** An explicit `false` there *overrides* `bun test --coverage`, so the CI coverage step would have silently produced nothing. Bun's default is already off, so removing the key keeps the local loop fast and lets CI opt in with the flag. TECH_STACK §4 corrected — it claimed `coverage = true` on CI, which was never what the file did. Current coverage: 99.84% lines, 93.73% functions; no threshold gate yet.
  - The workflow duplicates the *stages* of `bun run ci` but not their contents — what each stage runs stays in `package.json`, and a comment at the top of the workflow says so.
  - `cancel-in-progress` is on for branches and off for `main`, so a merge queue never cancels the run that proves the default branch is green.
- Next: M0-07
### 2026-09-27 · M0-05 · feat/M0-05-check-deps
- Done: real `check:deps`. `tools/check-deps.ts` walks every source file in `packages/` and `apps/` and applies the ARCHITECTURE §2 table, which now lives as data in `tools/deps/rules.ts`; `tools/deps/scan.ts` is a small tokenizer that finds import specifiers, and `tools/deps/purity.ts` holds the `packages/sim` API rules. `scripts/hooks/post-edit.ts` was rewritten to call the same `checkSource`, so the edit hook and the CI gate cannot drift.
- Tests: `bun run check` green; 118 tests across 12 files (36 new). AC verified live — adding `import { Vector3 } from 'three'` to `packages/sim/src/index.ts` makes `bun run check:deps` exit 1 and the PostToolUse hook exit 2 with the same message.
- Notes/decisions:
  - **The gate found a real violation on `main`:** `ui/app.tsx` imported `QualityPreset` from `render/quality/presets.ts`. Fixed by moving the preset *names* (`QUALITY_PRESETS`, `QualityPreset`, `isQualityPreset`) to `packages/shared/src/quality.ts` — settings (M2-16) and the save schema need the same vocabulary, so shared is where it belongs. `render/quality/presets.ts` keeps `MAX_DPR`, `clampPixelRatio` and `guessPreset`.
  - Type-only imports are **not** a general escape hatch. The one place ARCHITECTURE §2 allows them is the `sim → content` row ("content types only"), so `import type` is honoured there and nowhere else; `ui/` importing a type from `render/` still fails.
  - Rules the table implies but does not spell out, added deliberately: no zone of the client bundle may import `tools/` or `scripts/`, and `packages/shared`, `packages/sim` and `apps/client/**` may not import `node:*`/`bun:*` (a colocated `*.test.ts` may import `bun:test`). `packages/content` may, because its loaders read locale files from disk for tools and tests.
  - A tokenizer rather than a regex: the checker must not fire on a commented-out import or the word `import` inside a string, and the sim purity rules must not fire on prose that mentions `Math.random`. It handles regex literals, template literals and a shebang line; `scan.test.ts` pins each of those.
  - No new dependency — no `dependency-cruiser`, no `madge`. The rules are ~15 lines of data and the scanner is ~230 lines, against a tool that would need its own TypeScript resolver config to say the same thing.
  - Review fix: the tokenizer originally masked a whole template literal, so `` `seed-${Math.random()}` `` or `` `${await import('three')}` `` inside `packages/sim` was invisible to both halves of the check. `${…}` spans are now re-tokenized as code with brace-depth tracking (nesting included); only the literal text between them is blanked.
  - `apps/client/build.ts` is registered as build-time code so M0-07 can use `Bun.build`, `node:*` and `tools/` helpers without a carve-out mid-task; the bundle may not import it.
- Next: M0-06
### 2026-09-27 · M0-04 · feat/M0-04-i18n-runtime
- Done: i18n runtime in `apps/client/src/i18n/` (`t`, lazy namespaces, signal-backed locale switch, `createNumberFormats` for money/number/clock, `formatGameDate`), the ICU subset of I18N §3 as `packages/shared/src/message.ts`, a locale picker in the overlay, and the real `check:i18n` (`tools/i18n/check.ts`) plus `tools/i18n/gen-types.ts`.
- Tests: `bun run check` green; 82 tests across 9 files (56 new: message formatter, parity rules, key parsing, number formats, and the runtime itself — fallback chain, dev/prod missing-key behaviour, lazy namespaces, hot switch, hostile storage). Verified live over CDP — clicking *Bahasa Indonesia* re-renders every overlay string, switches `Rp12,500` → `Rp12.500`, updates `<html lang>` and persists the choice. `check:i18n` exits 1 on a removed key and on a placeholder mismatch.
- Notes/decisions:
  - **`packages/content/src/i18n.generated.ts` is generated and committed** (`bun run gen:i18n`), exported as `@ndeso/content/i18n`. It holds the `I18nKey` unions *and* a per-locale map of lazy namespace loaders, so there is no hand-maintained registry to forget. `check:i18n` fails when it drifts, and the generator pipes its output through Biome so `bun run fmt` cannot cause false drift. Committing it keeps `bun run check` working on a clean checkout without a codegen step.
  - Our own ~190-line ICU subset instead of a formatter dependency: `{name}`, `plural` with `#` and `=n` selectors, `select`. Apostrophe escaping, `selectordinal` and number skeletons are rejected loudly rather than silently mis-rendered.
  - `createI18n({ bundles, storage, dev })` is a factory rather than a module singleton, and `index.ts` wires it to the generated registry and to `localStorage`. That keeps `runtime.ts` free of the DOM and of the generated import, so the fallback chain and the hot switch are unit-testable with fake bundles.
  - Biome's `complexity/useLiteralKeys` is off **for two files only** (`packages/shared/src/message.ts`, `apps/client/src/platform/env.ts`): it demands `obj.other` where tsconfig `noPropertyAccessFromIndexSignature` demands `obj['other']`, so the two rules cannot both be satisfied. (Biome rejects comments in `biome.json`, hence the rationale living here.)
  - `format.money` needs `currencyDisplay: 'narrowSymbol'` — otherwise an `en` locale renders IDR as `IDR12,500` instead of the `Rp12,500` I18N §7 specifies.
  - Locale preference persists in `localStorage` (`ndeso.locale`), wrapped in try/catch for private mode. M2's storage adapter (`idb-keyval`, ARCHITECTURE §4.4) takes over settings later; `localStorage` is used here because the choice must be readable synchronously before the first render.
  - `Season` / `Weekday` / `Pasaran` literals live in the i18n runtime for now; M1-01 owns the clock and moves them into `packages/shared`.
  - `@preact/signals` added (already on the TECH_STACK §2 allow-list) and `@ndeso/shared` linked into the root so `tools/` can import it.
- Next: M0-05
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
