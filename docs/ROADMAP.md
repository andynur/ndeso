# ROADMAP & TASK BREAKDOWN

> Each task is sized for **one agent session / one PR** (≈ 1–4 h of human-equivalent work).
> Pick the first unchecked task whose dependencies are done. Mark `[x]` in the same PR that completes it.
> Task IDs are stable: reference them in branch names (`feat/M1-03-billboard-sprites`) and commits.

## M0 — Bootstrap (exit: `bun run check` green in CI; Three.js scene visible on a phone)

- [x] **M0-01** Root workspace: `package.json` (workspaces, scripts from TESTING §1 as stubs), `.bun-version`, `bunfig.toml`, `tsconfig.base.json`, `biome.json`, `.editorconfig`. *AC:* `bun install` and `bun run check:lint` pass.
- [x] **M0-02** Create `packages/shared` and `packages/sim` with a `hello` system plus a test; `packages/content` with the locale seed files already in the repo. *AC:* `bun test` passes.
- [x] **M0-03** `apps/client`: `index.html` + `main.ts`, Bun dev server with HMR (`tools/dev.ts`), Three.js renderer showing a rotating low-poly placeholder on a ground plane, Preact overlay "Hello / Halo". *AC:* `bun run dev` serves on LAN; loads on a phone.
- [x] **M0-04** i18n runtime skeleton (`t`, `format.money`, locale detect/switch) plus `tools/i18n/check.ts` (parity) and `gen-types.ts`. *AC:* switching locale updates the overlay; `check:i18n` catches a removed key.
- [x] **M0-05** `tools/check-deps.ts` enforcing ARCHITECTURE §2. *AC:* importing `three` inside `packages/sim` fails the check.
- [x] **M0-06** CI workflow green (install, check, build). *AC:* PR shows passing checks.
- [x] **M0-07** Production build `apps/client/build.ts` + `tools/check-size.ts`. *AC:* `bun run build` outputs hashed files; the size report prints.

## M1 — Tech spike (exit: 30 fps on a Low device; first frame ≤ 5 MB)

- [x] **M1-01** Sim clock: ticks, minutes, days, and **all three calendars** projected from one day counter — pranata mangsa (12 mangsa, 120-day year, lengths from `content/data/calendar/mangsa.json5`), pasaran, and the tabular Hijri calendar. Golden test snapshotting **3 full years** of mangsa boundaries, pasaran and festival dates. (GDD §3, [ADR-0007](adr/0007-three-calendars.md)) Also in scope, decided before the task began:
  - **Prayer-time bands come from a fixed table**, varying only by mangsa — not computed from latitude and date. Astronomy would break sim purity and determinism to buy an accuracy the game cannot use, exactly as ADR-0007 argued for the Hijri calendar.
  - **A narrow validator for the calendar data** (`gameDays` sums to `gameYearDays`, ids unique, musim tags known). Not the full `check:content`, which stays M2-01 — but the task that consumes a data file is the task that validates it, and M2-01 is 20+ tasks away.
  - **Locale keys for the mangsa names and pertanda** in **both** `en` and `id` (`calendar:mangsa.<id>.name` / `.sign`), from the GDD §3.1 table. Unused until M1-08 shows them; they ship here because AGENTS rule 3 binds the task that introduces the vocabulary.
- [x] **M1-02** Fixed-step game loop with render interpolation and pause on hide. (ARCH §4.1)
- [x] **M1-03** Billboard sprite system (instanced, atlas UV, animation by tag) with a placeholder character atlas. (DESIGN §1.2)
- [x] **M1-04** Camera rig: follow, 4-angle rotation, zoom limits. (DESIGN §1.1)
- [x] **M1-05** Input abstraction: keyboard + virtual joystick + context button → `Command`s. (GDD §12)
- [ ] **M1-06** Player movement in sim with a tile collision grid; render follows. Walk anim by direction.
- [x] **M1-07** Day/night lighting from `lighting.json5` keyframes driven by the clock. Maghrib is the signature hour — get it right first. (DESIGN §1.3)
- [x] **M1-08** Quality presets + DPR cap + perf overlay (`?debug=perf`), plus the **HUD clock** from GDD §3.2 — `15:40 · Ashar · Mangsa Kapat hari 3/8 · Kliwon`, consuming the locale keys M1-01 landed. It rides here because this is the first task that owns a persistent on-screen readout. (PERF §4, §6, GDD §3.2)
- [x] **M1-09** Placeholder **Balé** terrain — the field, the half-built joglo, the dry *kalen* — with the asset pipeline minimum: gltf-transform meshopt + manifest. (ASSET_PIPELINE, [PLACES](PLACES.md))
- [ ] **M1-10** Device test on a Low phone plus WhatsApp in-app browser; record in `docs/perf-log.md`. **Human task**, agent prepares the checklist.
- [ ] **M1-11** **Community cultural review round, before any M2 dialog is written** (CULTURE_GUIDE §1.5). The setting is a real kelurahan, so this cannot wait for M4. **The pack and the questions are written** — [`docs/culture-review/`](culture-review/README.md) — so what remains is the part only a human can do: find two or three readers from Purworejo, send it, and record the answers as `round-01-<date>.md`. Includes seeking the owners' position on the name "Balé Al Jannah" (PRD §12.2). **Start now, in parallel** — a review round takes weeks and it blocks all M2 writing.
- [ ] **M1-12** **Reference photography trip** ([PLACES §5](PLACES.md)): Pasar Baledono at 06:00, the main road after rain and at night, the climb up Geger Menjangan and the view, Balé Al Jannah from several angles, and ordinary textures (warung fronts, kalen, pagar, paving). Almost none of this exists online at usable quality and the art direction is blocked on it. **Human task**, agent prepares the shot list.

## M2 — Vertical slice (exit: GDD §13 "Done when")

- [ ] **M2-01** Content schemas (crops, items, tools, npcs, **calendar**) in `shared` + `check:content`. Must assert that `mangsa[].gameDays` sums to exactly `gameYearDays`.
- [ ] **M2-02** Farming system: tile states, hoe, seed, water, growth on `dayStarted`, harvest. Unit + golden tests.
- [ ] **M2-03** Crop rendering: instanced per stage, watered-soil decals, updates on day change.
- [ ] **M2-04** Inventory + hotbar (sim + UI), tool switching.
- [ ] **M2-05** Weather (clear/rain) seeded per mangsa; rain particles; rain auto-waters. Kapitu is the heavy one.
- [ ] **M2-06** Stamina + sleep + passing out at 01:00; day-end summary screen.
- [ ] **M2-07** Setoran box + money + overnight payout; `format.money` in HUD.
- [ ] **M2-08** **Pasar Baledono**: buy seeds and sell produce, prices better on the *pasaran* day, **closes late morning**. (Bu Ratna)
- [ ] **M2-09** NPC schedules + nav grid + **3 NPCs (Mbah Hita, Pak Harjo, Bu Ratna)** with placeholder sprites. Mbah Hita gets the writing budget of three.
- [ ] **M2-10** Ink dialog runtime + DialogBox UI + 3 scripts per NPC in EN and ID + `check-ink`.
- [ ] **M2-11** Chicken: coop, feed, egg production, affection.
- [ ] **M2-12** Save/load: 3 slots, Zod validation, backup, migrations scaffold, autosave on day end and on hide.
- [ ] **M2-13** `pasar` area + area transitions (streaming load, fade), plus a `kampung` façade.
- [ ] **M2-14** Audio platform: unlock, music stream (day/night), SFX for hoe, water, and coin; volume settings. Adzan ambience **off by default outside `id`** (CULTURE_GUIDE §3.1).
- [ ] **M2-15** PWA: `sw.ts` precache shell, runtime cache for areas and locales, update prompt, manifest + icons.
- [ ] **M2-16** Settings menu: language, graphics preset, text size, reduce motion, volume.
- [ ] **M2-17** Title screen, new game / continue, first-run benchmark → preset.
- [ ] **M2-18** The **first ten minutes** (GDD §14): train window → Kutoarjo → the gate → Mbah Hita's note → one patch, one seed, the well → maghrib. No tutorial pop-ups. Fully localized.
- [ ] **M2-19** Smoke test with `Bun.WebView` in CI.
- [ ] **M2-20** Playtest round (human) + fix list → new tasks M2-2x.
- [ ] **M2-21** ***Kamus*** (in-game glossary) UI, **moved up from M4**: the first Javanese word in dialog needs its gloss shipping alongside it, not two milestones later. (I18N, CULTURE_GUIDE §5)
- [ ] **M2-22** ***Asri*** computed spatially over the `bale` area (canopy, water, bare ground) and **read out by Mbah Hita in dialog**. No UI meter, no building system — those are M3. (GDD §5)

## M3 — Alpha (coarse; break down when M2 is done)
Town areas (jalan raya, alun-alun, Geger Menjangan, kolam) · 10 crops · kambing Etawa and chickens · price variance on pasaran days · swalayan vs pasar economy · 6 NPCs with friendship and gifts · **kawasan building from Mbah Hita's closed list (~10 structures)** · *nyaman* and *tenang* alongside *asri* · **Sedekah Bumi** · calendar UI with mangsa, pasaran and weton · tool upgrades at the pandai besi · Pak Darma's standing offer · export/import save · telemetry opt-in · `balance` report script.

## M4 — Beta
The **kalen** water system + ulu-ulu schedule + gotong royong repair arc · **Ramadan** (30 days of a changed town) and **Lebaran** (mudik) · Festival Durian · Dolalak · Kaligesing and the outer ring · marriage candidates + heart events · **Act 3: Mbah Hita moves back** · accessibility pass · optional cloud save server (`apps/server`) · **second** community cultural review round (the first is M1-11, before M2 writing).

## v1.0
Polish, performance on all reference devices, full EN/ID review by native speakers, press kit, launch.
