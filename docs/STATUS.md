# STATUS — session handoff log

> **Agents: read the "Now" block first; append a short entry at the end of every session.** Keep the Now block ≤ 15 lines.
> The SessionStart hook prints the top of this file into context, so keep it short and current. Put older history under "Log" (newest first) and trim entries older than ~10 sessions into `docs/status-archive.md`.

## Now
- **Milestone:** M1 — Tech spike (30 fps on a Low device; first frame ≤ 5 MB). M1-01…M1-04 done.
- **The game:** *Balé* — farming sim set in **Baledono, Purworejo**, a real place. You take over Mbah Hita's ground (he is alive, elderly) and make it *asri, nyaman, tenang*. Read `docs/PLACES.md` before naming any location.
- **Next task:** M1-05 (input abstraction → `Command`s, GDD §12). It must take over the stopgap `bindCameraKeys` in `main.ts` (Q/E turn, wheel/± zoom) and add touch rotate/zoom; the camera is view state, so it stays a direct `scene.camera` call, not a sim `Command`. Sprite facing is picked per frame from a world heading via `CameraRig.screenFacing`.
- **Blockers:** none.
- **Harness:** no MCP servers ([ADR-0008](adr/0008-drop-serena-context-mode.md)). Locate with `Grep output_mode:"count"` then read only the hit; `Edit`/`Write` for source files, never `sed -i`; never chain a denied path (`dist/`, `assets/`, `bun.lock`) into a compound command. GitHub work goes through `bun tools/gh.ts`.
- **Open decisions:** permission to use the real name "Balé Al Jannah" (PRD §12.2) · mangsa day-lengths and the prayer-time table are `verified: false` (§12.6).
- **Known issues:** two `bun run` scripts are still `tools/todo.ts` stubs — `check:content` (M2-01) and `smoke` (M2-19). Sim events are drained and dropped each frame until the HUD clock (M1-08) consumes them. Shell size is 127 KB brotli of a 350 KB budget.

## Log
<!-- Newest first. Format:
### YYYY-MM-DD · <task id> · <branch/PR>
- Done: …
- Tests: …
- Notes/decisions: …
- Next: …
-->
### 2026-09-27 · M1-04 · claude/friendly-curie-r6bxqk
- Done: `render/camera/camera-rig.ts` — pure (no `three`) rig: critically damped follow (0.15 s) with a 0.5-unit dead zone, 4 yaw angles eased over 250 ms (mid-turn presses continue from the current angle), zoom clamped 10–18 and eased, `pose()` into a scratch object, `screenFacing()` maps world heading → down/up/side for the current yaw. Loop hands `frame()` a clamped real dt; the camera runs on real time. Scene follows the walker; all placeholder sprites pick their tag from a world heading.
- Tests: `bun run check` green (254 tests); build + `check:size` ok (shell 127 KB). No headless screenshot this session (Playwright not installed).
- Notes/decisions: fog near/far track zoom distance. Desktop-only Q/E + wheel bindings until M1-05.
- Next: M1-05.

### 2026-09-27 · M1-03 · claude/friendly-curie-r6bxqk
- Done: `render/sprites/` — `atlas.ts` (Aseprite json-array-shaped descriptor, `frameUv` with flipX), `animation.ts` (`frameAt` by tag, per-frame durations), `placeholder-atlas.ts` (32×48 villager drawn in code at boot: idle 4 / walk 6 × down/up/side, 1 px ink outline), `sprite-batch.ts` (one `InstancedMesh`, translation in `instanceMatrix`, `aUvRect` per instance, cylindrical billboard + alpha cutout + fog in a `ShaderMaterial`, zero per-frame allocation). Scene shows one walker circling the house and four idle facings.
- Tests: `bun run check` green (239 tests); build + `check:size` ok (shell 126 KB); Chromium screenshots render the sprites with no console errors.
- Notes/decisions: the placeholder atlas is generated at runtime, so nothing generated is committed; idle speed 4 fps (DESIGN gives only walk's 10 fps). Sprites are unlit apart from `SpriteBatch.tint`, which M1-07 should drive.
- Next: M1-04.

### 2026-09-27 · M1-02 · claude/friendly-curie-r6bxqk
- Done: `game/loop.ts` fixed-step loop (pure `advance()`, 250 ms clamp, `alpha`, injected frame scheduler); `game/game.ts` owns the sim state and runs `createTimeSystem`, buffering events; `scene.ts` no longer schedules itself (`draw(simSeconds)`, skips frames while the GL context is lost); `main.ts` pauses the loop on `visibilitychange`. New `@bale/content/calendar` imports the calendar JSON5 statically for the browser.
- Tests: `bun run check` green (221 tests); build + `check:size` ok; Chromium renders with no console errors.
- Notes/decisions: hidden time is not billed to the sim on resume (the game clock stops in a background tab). The placeholder spin is now driven by interpolated sim time.
- Next: M1-03.

### 2026-09-27 · M1-01 follow-up · claude/cool-albattani-s1w499
- Done: settled the open GDD §10 question. The owner chose **proportional** Hijri months, so Ramadan stays 9–10 game days (30 in life), as the build already does. There is no Ramadan-specific rule. GDD §10 is updated.
- Notes: this branch had a second, independent M1-01 implementation. It was dropped in favour of the one merged in PR #14, and only this decision was carried over.

### 2026-09-27 · M1-01 · claude/brave-ramanujan-rkivah
- Done: `time` system + pure calendar projections in `packages/sim` (mangsa, musim, pasaran, weekday, tabular Hijri, prayer band); calendar schema/validator in `packages/shared`; `clock.json5` + `prayer-times.json5`; `calendar` locale namespace with the 12 mangsa names and pertanda in EN + ID. `hello` system deleted.
- Tests: `bun run check` green — **211 pass**, incl. a 3-year golden (mangsa boundaries, Ramadan/Lebaran/Idul Adha dates) and a check that the system's events agree with the projections over all 360 days. Hijri arithmetic cross-checked ad hoc against ICU `islamic-civil` over ~1,400 years.
- Notes/decisions:
  - **Hijri = real tabular calendar sampled at 365/120 real days per game day**, so months are 9–10 game days and Ramadan drifts 3–4 days earlier per year (76 → 73 → 69 in-year). Festivals are real tabular dates mapped to the first game day on/after them, so 10 Dzulhijah shows as game day 4 of that month.
  - **Schema in `shared`, file reading in `content`.** That let sim tests validate the real JSON5 (via `src/testing/calendar-data.ts`, test-only) without breaking the types-only sim → content rule. `ClockState` lives in `sim` until `save.ts` exists.
  - Day 0 anchors: Senin, Legi, 6 Muharram 1448 (= real 22 June 2026, ~start of Kasa). Clock: 7 ticks/min, day 05:00 → 01:00.
- Next: M1-02.

### 2026-09-27 · scope · docs/m1-scope-and-review-pack
- Done: the decisions M1-01 needed before a line of it was written, plus the M1-11 review pack (`docs/culture-review/`), plus two real bugs found on the way.
- Notes/decisions:
  - **Prayer-time bands are a fixed table varying by mangsa, not computed.** Real prayer times need latitude, longitude and a date — astronomy, which would cost `packages/sim` its purity and determinism to buy precision the game never uses. Identical reasoning to ADR-0007's tabular Hijri choice. Recorded in GDD §3.2 so it does not get "improved" mid-task.
  - **M1-01 also validates the calendar data it reads.** `check:content` is a stub until M2-01, 20+ tasks away, so without this M1-01 consumes `mangsa.json5` with nothing checking that `gameDays` still sums to 120 — and a golden test would happily snapshot the wrong answer as correct. A narrow validator, not the full M2-01 schema: the task that consumes a data file validates it.
  - **The calendar locale keys had no home.** GDD said they land "in the task that first surfaces them (M1-01)", but M1-01 is pure sim and *no M1 task owned the HUD clock* that GDD §3.2 specifies — so they would have landed nowhere. Keys ship in M1-01 (AGENTS rule 3 binds whoever introduces the vocabulary); the HUD rides on **M1-08**, the first task with a persistent on-screen readout.
  - **`package.json` declared `AGPL-3.0-or-later` while LICENSE, README and Accepted ADR-0005 all say MIT.** Three sources against one. Fixed to MIT. Not cosmetic — the obligations differ completely, and a public repo publishing builds makes it concrete.
  - **`.claude/agents/reviewer.md` still told the reviewer to check "season change"**, which stopped existing at ADR-0007. Now mangsa and pasaran boundaries.
  - **M1-11 is unblocked and should start in parallel.** The pack is written and aimed at four kinds of reader (Baledono resident, NU/pesantren background, Bagelen speaker, farmer). 25 questions, front-loaded with the one that matters most: whether using the real name "Balé Al Jannah" is appropriate at all, and who to ask. A review round takes weeks and blocks every line of M2 dialog.
- Next: M1-01.

### 2026-09-27 · ci · ci/pages-deploy
- Done: every merge to `main` now publishes the built client to <https://andynur.github.io/ndeso/>. `apps/client/build.ts` gained `--public-path`; `shellFiles`, the precache manifest and `check:size` learned about it.
- Tests: `bun run check` green — **173 pass** (9 new). Verified the real artefact, not just the flags: built with `--public-path /ndeso/` and confirmed the emitted HTML references `/ndeso/index-<hash>.js` and the manifest lists prefixed URLs; then confirmed `check:size` still measures correctly for both a root build and a project-site build.
- Notes/decisions:
  - **Without this there was no way to look at anything.** Cloud sessions are disposable and their dev server is unreachable from a phone. M1-09 would have landed the Balé terrain with the owner unable to see it. This also makes M1-10's device test nearly free.
  - **A real bug surfaced during the work, and the M0-07 design caught it.** `shellFiles` assumed `publicPath === '/'`, so the first project-site build threw `index.html references a missing file: ndeso/index-…js` instead of writing a silently wrong precache manifest. Fixed by threading the prefix through; pinned with four tests including the exact failing case.
  - **The build records its own `publicPath` in `precache-manifest.json`** so `check:size` reads it back rather than being told out of band. Otherwise running `check:size` after a project-site build would look for files that do not exist — a footgun left for whoever hit it next.
  - ~~**`configure-pages` runs with `enablement: true`**, so no manual repo setting is needed.~~ **Wrong — this failed on the first run on `main` and turned it red.** Enabling Pages needs repository-administration rights that a `permissions:` block cannot grant to `GITHUB_TOKEN`. Corrected in `fix/pages-gate`: `enablement` removed, and the job is gated on a `DEPLOY_PAGES` repo variable so it **skips** rather than fails until an admin does the one-time setup (Settings → Pages → Source: GitHub Actions, then set the variable). A permanently red `main` teaches everyone to ignore the colour; skipping states the prerequisite instead. Both the Pages and the Actions-variables REST endpoints are blocked by this environment's proxy, so neither could be done from the session.
  - Deploy is a **second job in `ci.yml`, `needs: check`**, not a separate workflow: nothing broken can reach the URL, and the build command lives in one place. `pages: write` / `id-token: write` are scoped to that job so `check` stays read-only.
- Next: M1 scope decisions + the cultural review pack, then M1-01.

### 2026-09-27 · harness · chore/trust-workspace
- Done: `scripts/cloud-env-setup.sh` now marks the workspace trusted, so the permission allow-list added in the previous PR is actually honoured. Documented in AI_WORKFLOW §3 and SETUP_AI_AGENT.
- Tests: verified end to end — before, `claude -p` printed `Ignoring 34 permissions.allow entries … this workspace has not been trusted`; after, the warning is gone. The Python block was separately tested for merging into an existing config without clobbering it, and for refusing (exit 1, file untouched) on a corrupt `~/.claude.json`.
- Notes/decisions:
  - **The allow-list was decorative.** All 34 entries added in `chore/harness-slim` were being ignored. Worth remembering: adding permissions to `.claude/settings.json` does nothing until the workspace is trusted.
  - **Deliberately NOT shipped: removing the `session-start-hook` user skill.** I offered it and it was approved, but it does not survive contact with reality — the setup script runs *before* Claude Code creates `~/.claude/skills/`, so an `rm` there is a no-op, and the alternative (the SessionStart hook) would only take effect from the following session. It saves ~5 KB. Shipping a line I cannot demonstrate working is exactly what ADR-0008 was written about, so it was left out rather than added on faith.
  - **The larger prize remains out of repo reach.** Roughly 30 skills load per turn (`docx`, `pptx`, `xlsx`, `google-workspace`, `morning`, `computer-use`, two browser skills …) and none are relevant here. Investigated properly: `claude plugin list` reports none installed, `claude plugin marketplace list` reports none configured, and `anthropic-skills:` is hardcoded in the binary as the namespace for *synced* skills pushed from the claude.ai account. `claude plugin disable <name>@builtin` prints "Successfully disabled" **and has no effect** — verified by listing skills in a fresh session afterwards. Neither `@builtin` nor `@claude-code-plugins` ids worked from `/etc/claude-code/managed-settings.json` either. The lever is account settings on claude.ai, not anything in this repo.
- Next: M1-01.

### 2026-09-27 · harness · chore/harness-slim
- Done: removed the Serena and context-mode MCP servers and everything that referenced them; added `tools/gh.ts` and `tools/check-links.ts` (wired into `bun run check`); rewrote the CLAUDE.md token-discipline and shell-safety sections; widened the permission allow-list; made the cloud setup script fail loudly. [ADR-0008](adr/0008-drop-serena-context-mode.md) supersedes ADR-0006 items 5 and 7.
- Tests: `bun run check` green — **164 pass** (17 new for the link checker). `check:links` verified to actually fail on a missing file and a bad anchor before being trusted.
- Notes/decisions:
  - **Neither MCP server was ever installed.** Measured in a live cloud session: `serena`, `context-mode` and `serena-hooks` all absent from `PATH`; the launchers fell back to `uvx`/`npx`, producing four connect/disconnect cycles. The real damage was not latency — it was that CLAUDE.md told agents to prefer symbol tools that did not exist, so the project's stated token strategy had not been running since M0.
  - **Root cause worth keeping: `scripts/cloud-env-setup.sh` swallowed every error** (`>/dev/null 2>&1 || true`). It now verifies each install and exits non-zero with what failed. A setup step that can fail silently will.
  - **One assumption of mine was wrong and I checked it before reporting it.** I expected the no-op Serena `PreToolUse` hook (matching `Grep|Glob|Read|Bash`) to be a meaningful cost; measured at **~5 ms per call**. It was removed for being dead code, not for being slow.
  - **`curl` deliberately stays out of the allow-list.** Permission patterns match a command prefix and the URL comes after the flags, so `Bash(curl:*)` would permit requests to any host. `tools/gh.ts` is allow-listed instead via `Bash(bun tools/:*)`, and it takes PR bodies from a file so markdown is not mangled by the shell.
  - **Reviewer subagent priced:** one pass on the 16-file docs PR cost **90 555 tokens** because it re-derives context cold. CLAUDE.md now makes it *required* above 5 files or in `packages/sim`, and *skipped* for one-file PRs, instead of a vague "use proactively".
  - **Shell-safety rules are written down now** because each already cost something: a denied path inside an `&&` chain kills the whole command (that is how stale `build.ts` reached `main` in M0-07), and `sed -i` fails silently where `Edit` fails loudly.
  - **`slugify` bug caught by testing the gate itself.** The first version collapsed whitespace runs with `\s+`, but GitHub emits one hyphen per space — so a dropped em dash yields `--`. It would have rejected working links. Pinned by a named regression test.
- Next: M1-01.

### 2026-09-27 · concept · docs/konsep-bale
- Done: the concept rewrite. `docs/PLACES.md` (new), `ADR-0007` (new), `packages/content/data/calendar/mangsa.json5` (new), and rewrites of GDD, PRD, CULTURE_GUIDE, ROADMAP M1–M4, both READMEs, AGENTS.
- Notes/decisions:
  - **Real place, not a fictional island.** Baledono, Purworejo. That is the whole source of the game's texture and also its main liability, so `PLACES.md §1` sets a binding three-tier naming policy: public geography real, private businesses fictionalised, the starting venue needs its owners' blessing. No real living person becomes an NPC; no map data or imagery copied from any service.
  - **The goal is the place, not the money.** *Asri / nyaman / tenang* (GDD §5) is computed spatially from what is actually on the ground, so it cannot be topped up like a counter. Farming is the means. This is the one mechanic that makes it not a Stardew reskin, and it came straight out of what `jannah` literally means — a garden.
  - **Three calendars, one integer** (ADR-0007). Pranata mangsa gives twelve flavours of year instead of four invented seasons; the tabular Hijri calendar makes Ramadan and Lebaran drift 4 days per year, which is free long-save variety no farm sim has. Chose **tabular over astronomical** hisab to keep the sim pure and deterministic; ±1 day is inside the spread Indonesia itself sees.
  - **The crop table needed no rebalancing.** Crops stay tagged by `musim`, a derived label over groups of mangsa, and musim hujan is 54 days — longer than the 28-day season the numbers were first tuned against.
  - **Corrected a factual error carried since the first draft:** the irrigation system was modelled on Balinese *subak*. Purworejo is Javanese; the right institution is the **ulu-ulu**. Subak stays in the glossary as a distinct thing, no longer as our model.
  - **`season` removed from the save `meta`.** It is derivable from `day`, and storing it would let a save disagree with itself after a data fix.
  - **Religious depiction is fenced explicitly** (CULTURE_GUIDE §3): the character is Muslim, worship is never scored or gated, prayer times are a *clock display*, Ramadan changes the town and not the player, and `jannah` is framed as one man's aspiration rather than a claim. §3.3 also names the contested Javanese practices (slametan, weton) and says to show them without staging a fiqh debate — objections get answered from the guide, not by quietly editing content.
  - **Mbah Hita is alive and does not die.** Recorded in GDD §2 as non-negotiable so nobody "improves" it later. He is also the *asri* readout before any UI meter exists, which is why he is budgeted three NPCs' worth of writing.
  - **Two tasks moved up into M2:** the *Kamus* glossary (M2-21) because the first Javanese word in dialog needs its gloss shipping with it, and *asri* (M2-22). The kawasan **building** system stays in M3 as a closed ~10-structure list, deliberately not a free-form editor — every public building is a content multiplier, and an empty one is worse than none.
  - **Caught in review, all fixed before merge:** ARCHITECTURE §3.2/§3.3 still emitted `seasonChanged` and stored `clock.season` — exactly the stale shape M1-01 would have implemented; `I18N.md` still passed `season` into `format.gameDate`; `GLOSSARY.md` still defined the 28-day season with pancaroba as a sub-phase; the `sign` prose I put in `mangsa.json5` broke `.claude/rules/content-i18n.md` (content data holds ids and numbers, not prose — the pertanda now lives in GDD §3.1 and becomes `calendar:mangsa.<id>.sign` in both locales at M1-01); and the crop tag `both` became ambiguous once pancaroba was promoted to a first-class musim, so it is now `semua`.
  - **Two human tasks added to M1** (M1-11, M1-12) because CULTURE_GUIDE §1.5 now demands a cultural review *before* M2 writing and the roadmap had no task for it, and because the art direction is blocked on reference photography that does not exist online.
- Next: M1-01, written against ADR-0007 rather than the old two-season model.
