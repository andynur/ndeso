# STATUS — session handoff log

> **Agents: read the "Now" block first; append a short entry at the end of every session.** Keep the Now block ≤ 15 lines.
> The SessionStart hook prints the top of this file into context, so keep it short and current. Put older history under "Log" (newest first) and trim entries older than ~10 sessions into `docs/status-archive.md`.

## Now
- **Milestone:** M2 — Vertical slice. M2-09 done. M1-10 device test is still the human's; the human culture round + photo trip remain deferred to M4.
- **The game:** *Balé* — farming sim set in **Baledono, Purworejo**, a real place. You take over Mbah Hita's ground (he is alive, elderly) and make it *asri, nyaman, tenang*. Read `docs/PLACES.md` before naming any location.
- **Next task:** M2-10 (Ink dialog runtime, DialogBox UI, localized scripts, and `check-ink`). Human: M1-10 device test ([`device-test.md`](device-test.md)). Read [round 00](culture-review/round-00-desk-2026-09-28.md) before writing any M2 content.
- **Blockers:** none.
- **Harness:** no MCP servers ([ADR-0008](adr/0008-drop-serena-context-mode.md)). Locate with `Grep output_mode:"count"` then read only the hit; `Edit`/`Write` for source files, never `sed -i`; never chain a denied path (`dist/`, `assets/`, `bun.lock`) into a compound command. GitHub work goes through `bun tools/gh.ts`.
- **Open decisions:** the Javanese year anchor and the per-month prayer-time table are `verified: false` (PRD §12.6) · maghrib look needs a phone check (`?clock=17:30`) · `manggis`/`vanili` crop numbers are starting values, untested by `balance` (M3).
- **Known issues:** `smoke` (M2-19) is still a `tools/todo.ts` stub. NPC schedules contain Balé visits only until M2-13 authors the `kampung` and `pasar` areas. The market panel opens from a temporary HUD button until then; haggling/friendship modifiers remain deferred to the social slice. Storm crop damage, overflowing *kalen* and debris are not implemented. Inventory-full and setoran deposits emit events without toasts until the UI feedback pass. Walk speed 4 tiles/s and NPC speed 2 tiles/s are untuned. Villagers have no collision. No blob shadows on Low yet. The M0 placeholder panel still covers the top-left of the view. Shell is 167.3 KB brotli of 350 KB.

## Log
<!-- Newest first. Format:
### YYYY-MM-DD · <task id> · <branch/PR>
- Done: …
- Tests: …
- Notes/decisions: …
- Next: …
-->
### 2026-10-01 · M2-09 · feat/M2-09-npc-schedules
- Done: authored localized profiles and Balé visit schedules for Mbah Hita, Pak Harjo, and Bu Ratna; added deterministic first-match schedule resolution and shortest-path movement over a collision-derived nav grid. The renderer now projects their interpolated sim state through one distinct-palette placeholder sprite batch.
- Tests: `bun run check` green (469 tests); build + `check:size` green (shell 167.3 KB brotli, first frame 176.5 KB). Browser visual QA could not run because no in-app or connected browser was available.
- Notes/decisions: only Balé visits are authored because M2-13 owns `kampung`/`pasar` areas and streaming. Routes are derived rather than saved and rebuild from serializable mid-walk state. Mbah Hita's larger writing budget remains with M2-10 dialog.
- Next: M2-10.

### 2026-10-01 · M2-08 · feat/M2-08-pasar-baledono
- Done: added sim-authoritative seed buying and produce selling with atomic money/inventory updates; deterministic per-item daily prices use the save seed and pay 110–140% of base on Legi/Kliwon. Authored Bu Ratna's fresh-produce hours as 04:30–11:30 and added a responsive EN/ID market panel.
- Tests: `bun run check` green (456 tests); build + `check:size` green (shell 165.7 KB brotli, first frame 174.9 KB). Browser visual QA could not run because no browser was connected to the session.
- Notes/decisions: the real market building remains open later; only Bu Ratna's fresh-produce trade closes at 11:30. A temporary HUD launcher exposes the feature until M2-13 adds the `pasar` area; market state remains authoritative in the sim.
- Next: M2-09.

### 2026-10-01 · M2-07 · feat/M2-07-setoran-payout
- Done: authored and rendered the Balé setoran box; interacting while facing it deposits the selected produce stack into serializable sim state. `dayStarted` pays the shipment once at each item's base price, emits economy events and updates the sim-authoritative wallet. The top-right HUD now formats the live balance with `format.money`.
- Tests: `bun run check` green (448 tests); build + `check:size` green (shell 163.7 KB brotli, first frame 172.5 KB). Browser visual QA could not run because no browser was connected to the session.
- Notes/decisions: setoran accepts produce only, moves the whole selected stack, and pays exactly 100% of authored base price per GDD §7. The box tile is authored in the area file so sim interaction and placeholder art share one location.
- Next: M2-08.

### 2026-10-01 · M2-06 · feat/M2-06-stamina-sleep
- Done: added sim-authoritative 100-point stamina, content-driven tool costs, voluntary sleep, exhaustion and 01:00 pass-out paths, capped 10% fainting penalty, and a frozen day-end summary that must be acknowledged before `dayStarted`. Added responsive EN/ID stamina HUD, sleep action and summary modal.
- Tests: `bun run check` green (444 tests); build + `check:size` green (shell 163.4 KB brotli, first frame 172.0 KB). Browser visual QA was not completed because Chrome automation was blocked by an open extension panel and the in-app browser was unavailable.
- Notes/decisions: rejected/no-op tool actions cost no stamina. Money exists in sim at zero so the GDD fainting penalty is deterministic; M2-07 owns earning, payout and the wallet HUD. Day-end state stays in sim rather than a browser-only modal model.
- Next: M2-07.

### 2026-09-29 · M2-05 · feat/M2-05-weather
- Done: validated per-month clear/cloudy/rain/storm weights with January's heavy-rain override; deterministic today/tomorrow forecasts from the save seed and absolute day; weather runs after time and before farming. Rain advances tegalan crops without manual watering and prevents sawah drying. The renderer dims/desaturates the scene and draws one deterministic GPU rain batch capped at 300/800/2000 particles by quality preset; `?weather=` supports visual QA.
- Tests: `bun run check` green (438 tests); build + `check:size` green (shell 162.4 KB brotli, first frame 170.7 KB). Browser visual QA was not completed because Chrome automation was blocked by an open extension panel and no in-app browser was connected.
- Notes/decisions: weather tuning is content data and its Zod schema stays out of the browser bundle. Ordinary rain uses 75% of the preset particle cap; storms use the full cap. Storm damage, *kalen* overflow and debris remain future work.
- Next: M2-06.

### 2026-09-29 · M2-04 · feat/M2-04-inventory-hotbar
- Done: serializable nine-slot inventory with content-driven starting loadout; direct and occupied-slot cycling; contextual front-tile hoe, water, seed and harvest actions; seeds consume only on accepted planting, harvests stack without deleting a crop when its full yield cannot fit. Added validated item/tool content and EN/ID names. The responsive hotbar projects sim state, supports touch, 1–9 and wheel selection, and uses generated placeholder icons.
- Tests: `bun run check` green (430 tests); build + `check:size` green (shell 161.4 KB brotli, first frame 169.8 KB). Browser visual QA was not completed because Chrome automation was blocked by an open extension panel.
- Notes/decisions: seed and produce definitions link to crops explicitly; `check:content` enforces one seed and product per crop plus price parity. Starting quantities are vertical-slice placeholders for M2-18, not balance decisions. Inventory-full emits no player-facing toast yet.
- Next: M2-05.

### 2026-09-29 · M2-03 · feat/M2-03-crop-rendering
- Done: procedural placeholder crop atlas for all crop definitions with four growth stages and distinct withered art; one instanced sprite batch per crop/stage; patterned instanced watered-soil decals; event-gated farm sync including every `dayStarted`; crop tint follows the day/night light.
- Tests: `bun run check` green (420 tests); build + `check:size` green (shell 159.6 KB brotli, first frame 167.9 KB). Browser visual QA was not completed because Chrome automation was blocked by an open extension panel and the in-app browser was unavailable.
- Notes/decisions: stages are a render projection of `growthDays` at thirds, with mature as stage 3; no balance/content values changed. The shipped art remains generated placeholder art, not a final asset.
- Next: M2-04.

### 2026-09-28 · M2-02 · feat/M2-02-farming-system
- Done: serializable farm tiles with exclusive untilled/tilled/seeded/mature/withered phases; sanitized hoe, seed, water and harvest commands; `dayStarted` growth, daily water reset, sawah levels, musim/drought withering and regrowth. Added the three vertical-slice crop definitions and EN/ID text; the Balé field starts as 96 tegalan tiles.
- Tests: `bun run check` green (414 tests); build + `check:size` green (shell 158.3 KB brotli). The 14-day golden records three cabai harvests plus one singkong harvest.
- Notes/decisions: crop events carry yield for M2-04 inventory; inventory consumption, stamina and rain stay with M2-04/05/06. Padi mechanics are covered on sawah tiles, but the playable Balé plot remains tegalan until its authored sawah layout lands.
- Next: M2-03.

### 2026-09-28 · M2-01 · feat/M2-01-content-schemas
- Done: Zod schemas for crops, items, tools, NPC schedules and all calendar files under `@bale/shared/content`; real `check:content` validates every JSON5 file, rejects unregistered files, and checks locale keys, area references and duplicate ids. Zod stays out of the browser-facing shared root.
- Tests: `bun run check` green (399 tests); build + `check:size` green (shell 157.0 KB brotli).
- Notes/decisions: crop prices remain on crop entries as GDD §4.3 and I18N §5 specify; schemas require cultural origin. M2 data files land with their owning system tasks, rather than inventing content here.
- Next: M2-02.

### 2026-09-28 · calendar: Masehi first, Jawa + Hijri subtitle (ADR-0009) · claude/charming-keller-syx5d4
- Done (owner decision after playing the demo): the pranata-mangsa year is replaced by a **scaled Masehi calendar** — 12 months × 10 game days, the date scaled from the real month (1, 4, 7 … 28) — with the **Javanese** (Sultan Agungan, Hijri + 512, windu year name) and **tabular Hijri** dates of that real date as a HUD subtitle: `Rabu Wage, 1 Juli 2026` / `15 Sura 1960 Dal · 15 Muharam 1448 H`. Arrival moved to 1 Juli 2026 (kemarau); day 0's weekday and pasaran are the real ones, then advance per game day. Musim from the month (hujan Nov–Mar, pancaroba Apr/Okt, kemarau Mei–Sep: 50/20/50). `mangsa.json5` → `months.json5`; prayer times re-keyed per month; `mangsaChanged` → `monthChanged`. ADR-0007 superseded by ADR-0009; GDD §3 rewritten, weather "Kapitu" row → Januari; PRD/GLOSSARY/ARCHITECTURE/I18N/ROADMAP M2-01, M2-05 follow.
- Tests: `bun run check` green (392). Golden calendar snapshot regenerated on purpose (the whole projection changed). Anchors checked: 17 Agustus 1945 Jumat Legi, 1 Sura 1959 = Jumat Kliwon 27 Juni 2025, Idul Adha 2026 = 27 Mei. Headless Chromium: HUD in EN and ID, no console errors.
- Notes/decisions: GDD numbers changed with the owner's approval (rule 5): musim lengths 54/50/16 → 50/20/50, the Kapitu weather row. Accepted cost: about two in three dates never show, so a festival can land on a day whose subtitle reads "2 Ramadan" — the festival task must make the HUD name the festival that day. Mangsa names/pertanda locale keys removed; the pranata mangsa stays as lore for dialog.
- Next: M2-01.

### 2026-09-28 · round-00 decisions applied · claude/charming-keller-syx5d4
- Done (owner decisions): the in-game place is just **Balé** (fictional; PRD §12.2 resolved; README/GDD/PLACES/review pack updated, no locale used the old name). Flagship festival **Merti Desa** (wayang kulit night), kept after the harvest. GDD §4.3 gains `manggis` and `vanili`; Dolalak guidance (CULTURE_GUIDE §3.4, GDD §10); pranata mangsa "who uses it" (GDD §3.1). New principle: everyday culture may be general Central Javanese, not Baledono-verified (CULTURE_GUIDE §1.1, PLACES §1); dialect = general Mataraman, no invented local words. Reader questions updated for round 01.
- Tests: `bun run check` green.
- Notes/decisions: crop numbers are starting values (rule 5: stated here and in the commit). Calendar data untouched — no festival ids exist in content yet.
- Next: M2-01.

### 2026-09-28 · M1-11 + M1-12 (desk substitutes) · claude/charming-keller-syx5d4
- Done: on the owner's instruction, `culture-review/round-00-desk-2026-09-28.md` answers the 25 reader questions from public sources (confidence-rated, 25 citations; no community voice invented) with 5 sourced corrections applied to PLACES — Balle Al Jannah is a live venue with Masjid Ar Royyan; Pasar Baledono open ~04:30–17:00 (SNI, rebuilt); Klenteng Thong Hwie Kiong beside the pasar; Geger Menjangan ~175 m in Trirejo with the Kyai Imam Puro makam; Baledono on the Bogowonto — and R1–R6 recommendations left for the owner. `visual-references.md`: per-area look + links (no images copied).
- Tests: `bun run check` green.
- Notes/decisions: ROADMAP ticks M1-11/12 as desk substitutes; the human round 01 and the photo trip moved to M4 and block public release. No GDD number or locale string changed.
- Next: M2-01.

### 2026-09-28 · M1-06 (+ M1-10/M1-12 prep) · claude/charming-keller-syx5d4
- Done: `packages/sim` `collision.ts` — tile grid built from the area file (joglo platform and kalen solid, off-area solid); `systems/movement.ts` holds the `move` intent in state, walks at `player.json5` speed (4 tiles/s, radius 0.3) with per-axis slide-and-snap, 4-way `facing`. `GameState = TimeState & MovementState`. Area schema gains `kalen.crossings` (plank *wot*, `CROSSING_WIDTH` 2): without one the kalen cut the field off; the placeholder draws two boards at `[5.5, 3]`. Client `createGame(cal, area, player)` keeps the pre-tick position and `playerPose(alpha)` interpolates; the scene draws and follows the player (walk/idle tag by facing through the camera yaw; walk cycle restarts on setting off), walker removed. M1-10 checklist `docs/device-test.md`, M1-12 shot list `docs/photo-shotlist.md`.
- Tests: `bun run check` green (381 tests); build + `check:size` ok. Headless Chromium: walks east over the plank into the field, north to the edge, camera follows, no console errors.
- Notes/decisions: speed/radius are feel numbers in content (GDD has none). The plank crossing is new area data — say so to the culture/art review, it is invented, not surveyed. No `save.ts` yet, so the player slice has no schema; add it with M2 saves.
- Next: human M1 tasks; then M2-01.

### 2026-09-28 · M1-09 · claude/charming-keller-syx5d4
- Done: `areas/bale.json5` (field, joglo, kalen, spawn, lamps, `origin`) + `validateArea`, bundled as `@bale/content/areas`. `tools/placeholders/bale.ts` builds the ground (dry kalen cut in, weedy field) and the half-built joglo from it via a small GLB writer (`tools/assets/glb.ts`, `mesh-builder.ts`); `bun run assets` runs `gltf-transform optimize --compress meshopt` under Bun, writes hashed `assets/models/bale/*.glb` + `assets/manifest.json`, incremental via `.cache/assets.json`. Dev server builds + serves `/assets/*`; `build.ts` ships them in `dist/assets/`. Client loads them with `GLTFLoader` + `MeshoptDecoder`, one shared vertex-colour Lambert material, `ground` receives / rest casts shadows; fallback plane until loaded. `first-playable-frame` budget now measured.
- Tests: `bun run check` green (356 tests); build + `check:size` ok (shell 156 KB, first frame 164 KB). Headless Chromium at noon/maghrib/night on all presets, no console errors.
- Notes/decisions: new devDependency `@gltf-transform/cli` (TECH_STACK-listed). Placeholder models are generated, never committed. Shell +27 KB brotli for GLTFLoader + meshopt decoder.
- Next: M1-06 was skipped (user asked for M1-07…M1-09) — do it next; then M1-10.

### 2026-09-28 · M1-08 · claude/charming-keller-syx5d4
- Done: `QUALITY` table (PERF §4: DPR, shadow map 0/512/1024+soft, lamps 0/2/4, fps cap 30/60/60); `scene.setPreset` switches live (shadow programs recompiled, lamps added/removed), sun shadow box follows the camera. First-run 3 s benchmark (`game/benchmark.ts` + `benchmarkVerdict`, one step up/down, stored as `bale.quality`; `?quality=` overrides unstored). `DynamicResolution` (−0.1 per 2 s below target−5, min 0.6; +0.1 after 10 s at target). `loop.setFpsCap`. `?debug=perf` overlay: fps, frame/cpu ms, calls, tris, tex, geo, heap, preset@DPR. HUD clock `15:40 · Ashar` / `Mangsa Kapat · hari 3/8 · Kliwon` from `game/clock-view.ts`, updated once per game minute.
- Tests: `bun run check` green (333 tests). Headless Chromium: clock + overlay render, benchmark stepped High → Medium on SwiftShader, maghrib shadows long, no console errors.
- Notes/decisions: the benchmark runs uncapped on the guessed preset (a 30-capped Low could never show headroom). Medium's "30/60" cap runs at 60. Perf labels are units, not `t()` strings (dev telemetry). Sim events are still drained unread — the clock reads `ClockState` because a minute passes without an event. Low has no blob shadows yet (DESIGN §1); add with the character art.
- Next: M1-09.

### 2026-09-28 · M1-07 · claude/charming-keller-syx5d4
- Done: `content/data/lighting.json5` (DESIGN §1.3 keyframes + a `night_hold`, rain modifier) validated by `@bale/shared` `validateLighting`, bundled as `@bale/content/lighting`. `render/lighting/day-night.ts` — pure sampler: linear-space colour blend, wraps past midnight, sun direction from elevation/azimuth, haze (fog + sky) colour and fog distance, lamp level, sprite tint lifted by `SPRITE_LIFT` 0.35 so sprites read at night. Scene drives sun, ambient, fog/sky, sprite tint and a placeholder teras lamp (`MAX_LAMPS` per preset: 0/2/4) from `clockMinute`. `?clock=17:30` opens the day at that hour.
- Tests: `bun run check` green (309 tests). Headless Chromium screenshots at 05:10/06:30/12:00/15:40/17:30/18:15/21:00, no console errors.
- Notes/decisions: sun intensities, elevations, `haze`, `fog` are tuning (DESIGN gives only colours + ambient). Maghrib reads warm (orange west light, mauve-to-orange haze) but a flat green field under a 13° sun stays dark olive — judge on a phone. Rain is wired but always 0 until weather (M2). No shadows yet: they are a preset feature (M1-08).
- Next: M1-08.

### 2026-09-27 · M1-05 · claude/friendly-curie-r6bxqk
- Done: `sim/commands.ts` — `Command` union (`move` world-space held intent, `interact`, `selectSlot`, `cycleSlot`) + `sanitizeCommand`; `SimContext.commands`. `game.submit()` queues sanitized commands for the next tick. `platform/input/` — keyboard by `event.code`, floating stick in the left 40 % (DESIGN §5), two-finger swipe turns / pinch zooms, mouse click = interact; one `InputFrame` per frame. `game/commands.ts` maps it through the camera yaw (`screenToWorld`, the inverse of `screenFacing`). `ui/touch-controls.tsx` — stick ring, Use (72 dp) and turn (48 dp) buttons, hidden where the primary pointer is a mouse.
- Tests: `bun run check` green (288 tests); build + `check:size` ok (shell 129 KB). Headless Chromium: touch stick draws and releases, buttons shown on touch / hidden on desktop, no console errors.
- Notes/decisions: camera turn keys are **Q / R** per GDD §12 (E is interact), replacing the M1-04 Q/E stopgap. Wheel switches tools (GDD); zoom is − / +, Ctrl-wheel (trackpad pinch), and touch pinch. Camera stays view state, never a `Command`.
- Next: M1-06.

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
