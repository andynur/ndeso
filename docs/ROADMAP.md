# ROADMAP & TASK BREAKDOWN

> Each task is sized for **one agent session / one PR** (≈ 1–4 h of human-equivalent work).
> Pick the first unchecked task whose dependencies are done. Mark `[x]` in the same PR that completes it.
> Task IDs are stable: reference them in branch names (`feat/M1-03-billboard-sprites`) and commits.

## M0 — Bootstrap (exit: `bun run check` green in CI; Three.js scene visible on a phone)

- [ ] **M0-01** Root workspace: `package.json` (workspaces, scripts from TESTING §1 as stubs), `.bun-version`, `bunfig.toml`, `tsconfig.base.json`, `biome.json`, `.editorconfig`. *AC:* `bun install` and `bun run check:lint` pass.
- [ ] **M0-02** Create `packages/shared` and `packages/sim` with a `hello` system plus a test; `packages/content` with the locale seed files already in the repo. *AC:* `bun test` passes.
- [ ] **M0-03** `apps/client`: `index.html` + `main.ts`, Bun dev server with HMR (`tools/dev.ts`), Three.js renderer showing a rotating low-poly placeholder on a ground plane, Preact overlay "Hello / Halo". *AC:* `bun run dev` serves on LAN; loads on a phone.
- [ ] **M0-04** i18n runtime skeleton (`t`, `format.money`, locale detect/switch) plus `tools/i18n/check.ts` (parity) and `gen-types.ts`. *AC:* switching locale updates the overlay; `check:i18n` catches a removed key.
- [ ] **M0-05** `tools/check-deps.ts` enforcing ARCHITECTURE §2. *AC:* importing `three` inside `packages/sim` fails the check.
- [ ] **M0-06** CI workflow green (install, check, build). *AC:* PR shows passing checks.
- [ ] **M0-07** Production build `apps/client/build.ts` + `tools/check-size.ts`. *AC:* `bun run build` outputs hashed files; the size report prints.

## M1 — Tech spike (exit: 30 fps on a Low device; first frame ≤ 5 MB)

- [ ] **M1-01** Sim clock: ticks, minutes, days, seasons, pasaran, events. Golden test for 56 days. (GDD §3)
- [ ] **M1-02** Fixed-step game loop with render interpolation and pause on hide. (ARCH §4.1)
- [ ] **M1-03** Billboard sprite system (instanced, atlas UV, animation by tag) with a placeholder character atlas. (DESIGN §1.2)
- [ ] **M1-04** Camera rig: follow, 4-angle rotation, zoom limits. (DESIGN §1.1)
- [ ] **M1-05** Input abstraction: keyboard + virtual joystick + context button → `Command`s. (GDD §11)
- [ ] **M1-06** Player movement in sim with a tile collision grid; render follows. Walk anim by direction.
- [ ] **M1-07** Day/night lighting from `lighting.json5` keyframes driven by the clock. (DESIGN §1.3)
- [ ] **M1-08** Quality presets + DPR cap + perf overlay (`?debug=perf`). (PERF §4, §6)
- [ ] **M1-09** Placeholder farm terrain (glb from simple generator or Blender) with the asset pipeline minimum: gltf-transform meshopt + manifest. (ASSET_PIPELINE)
- [ ] **M1-10** Device test on a Low phone plus WhatsApp in-app browser; record in `docs/perf-log.md`. **Human task**, agent prepares the checklist.

## M2 — Vertical slice (exit: GDD §12 "Done when")

- [ ] **M2-01** Content schemas (crops, items, tools, npcs) in `shared` + `check:content`.
- [ ] **M2-02** Farming system: tile states, hoe, seed, water, growth on `dayStarted`, harvest. Unit + golden tests.
- [ ] **M2-03** Crop rendering: instanced per stage, watered-soil decals, updates on day change.
- [ ] **M2-04** Inventory + hotbar (sim + UI), tool switching.
- [ ] **M2-05** Weather (clear/rain) seeded; rain particles; rain auto-waters.
- [ ] **M2-06** Stamina + sleep + passing out at 02:00; day-end summary screen.
- [ ] **M2-07** Shipping box + money + overnight payout; `format.money` in HUD.
- [ ] **M2-08** Seed shop UI (Bu Ratna) with buy flow.
- [ ] **M2-09** NPC schedules + nav grid + 2 NPCs (Pak Harjo, Bu Ratna) with placeholder sprites.
- [ ] **M2-10** Ink dialog runtime + DialogBox UI + 3 scripts per NPC in EN and ID + `check-ink`.
- [ ] **M2-11** Chicken: coop, feed, egg production, affection.
- [ ] **M2-12** Save/load: 3 slots, Zod validation, backup, migrations scaffold, autosave on day end and on hide.
- [ ] **M2-13** Village area + area transitions (streaming load, fade).
- [ ] **M2-14** Audio platform: unlock, music stream (day/night), SFX for hoe, water, and coin; volume settings.
- [ ] **M2-15** PWA: `sw.ts` precache shell, runtime cache for areas and locales, update prompt, manifest + icons.
- [ ] **M2-16** Settings menu: language, graphics preset, text size, reduce motion, volume.
- [ ] **M2-17** Title screen, new game / continue, first-run benchmark → preset.
- [ ] **M2-18** Tutorial (first day guided by Pak Harjo), fully localized.
- [ ] **M2-19** Smoke test with `Bun.WebView` in CI.
- [ ] **M2-20** Playtest round (human) + fix list → new tasks M2-2x.

## M3 — Alpha (coarse; break down when M2 is done)
Full farm + village + market maps · 10 crops · cows/kerbau · market on pasaran days with price variance · 6 NPCs with friendship and gifts · Pasar Malam festival · calendar UI · tool upgrades · export/import save · telemetry opt-in · `balance` report script.

## M4 — Beta
Subak irrigation system + dam repair arc · 4 festivals with minigames · marriage candidates + heart events · glossary (*Kamus*) · accessibility pass · optional cloud save server (`apps/server`) · community cultural review round.

## v1.0
Polish, performance on all reference devices, full EN/ID review by native speakers, press kit, launch.
