# ARCHITECTURE

> How the code is organized and the **boundaries that must not be crossed**. Decisions and their reasons are in [adr/](adr/).

## 1. Monorepo layout (Bun workspaces)

```
bale/
├── apps/
│   ├── client/            # Browser game: Three.js render + Preact UI + platform adapters
│   │   ├── index.html     # Entry (Bun HTML import); dev server + bundler both start here
│   │   ├── build.ts       # Production build via Bun.build + precache manifest
│   │   ├── public/        # Static files copied as-is (manifest.webmanifest, icons)
│   │   └── src/
│   │       ├── main.ts            # Boot: detect caps → load locale → create Game
│   │       ├── game/              # Glue: owns Sim instance, fixed-step loop, input→commands
│   │       ├── render/            # Three.js only. Reads sim state, never writes it
│   │       │   ├── scene/         # Area scenes, streaming, lighting
│   │       │   ├── sprites/       # Billboard sprite system, atlases, animation
│   │       │   └── quality/       # Presets, dynamic resolution, benchmark
│   │       ├── ui/                # Preact overlay: HUD, menus, dialog; tokens.ts
│   │       ├── platform/          # input, audio (Web Audio), storage (idb-keyval), pwa, device
│   │       └── i18n/              # Runtime: t(), format, locale loading
│   │   └── sw.ts          # Service worker (own entry)
│   └── server/            # Optional (M4+): Bun.serve API, cloud save, validation
├── packages/
│   ├── sim/               # PURE game logic. No DOM, no Three, no timers, no Math.random
│   ├── shared/            # Types, Zod schemas (save format, content schemas), constants
│   └── content/           # Data: JSON5 (crops, items, npcs, lighting), Ink dialog, locales
├── tools/                 # Asset pipeline, i18n checker, size budget, balance report, smoke test
├── assets-src/            # Source art (.aseprite, .blend) — tracked with Git LFS
└── docs/
```

## 2. Dependency rules (enforced by `bun run check:deps`)

```
apps/client ──▶ packages/sim ──▶ packages/shared
      │                                 ▲
      └──────▶ packages/content ────────┘
apps/server ──▶ packages/sim, packages/shared, packages/content
```

| Package | May import | Must NOT import |
|---|---|---|
| `packages/shared` | `zod` | anything else in the repo |
| `packages/sim` | `shared`, content **types** only | `three`, `preact`, DOM globals (`window`, `document`), `Date.now`, `Math.random`, `setTimeout` |
| `packages/content` | `shared` (schemas) | runtime code |
| `apps/client/src/render` | `three`, `sim` (read-only views) | `preact`, `ui/` |
| `apps/client/src/ui` | `preact`, `i18n`, sim **views** | `three`, `render/` |

`import type` is not a general escape hatch: it only relaxes the `packages/sim` → `packages/content` row, which is types-only by design. Three rules the table implies are enforced too: nothing in the client bundle may import `tools/` or `scripts/`; `packages/shared`, `packages/sim` and `apps/client/**` may not import `node:*` or `bun:*` (a colocated `*.test.ts` may import `bun:test`); and `packages/sim` may not touch a DOM global (`window`, `document`, `localStorage`, `sessionStorage`, `navigator`), read wall-clock time (`Date.now`, `performance.now`, `new Date`), call `Math.random`, or use a timer (`setTimeout`, `setInterval`, `requestAnimationFrame`, `queueMicrotask`).

The table lives as data in `tools/deps/rules.ts`. A PostToolUse hook (`scripts/hooks/post-edit.ts`) runs the same check on every edit, so the agent gets the failure before CI does.

## 3. Simulation (`packages/sim`)

### 3.1 Principles
- **Deterministic:** `state_{n+1} = step(state_n, commands_n, dtFixed)`. Randomness comes only from a seeded PRNG (`sfc32` or `mulberry32`) stored **in state**.
- **Fixed timestep:** 10 ticks per real second (`dt = 100 ms`). Game-minute accumulation is derived from ticks. Render interpolates between ticks.
- **Plain data state:** the state is serializable JSON-compatible objects (no classes, no Maps in the state root; use records). Save = state snapshot + version.
- **Systems are functions:** `(state, ctx) => void`, run in a fixed order. Each system owns its slice of state.
- **Commands in, events out:** input becomes `Command`s (`{ type: 'useTool', tool: 'hoe', target: {x,z} }`). Systems emit `Event`s (`cropHarvested`, `dayStarted`, `moneyChanged`) that render, UI, and audio subscribe to.

### 3.2 System order (per tick)
1. `time` → advances the tick and `day` counter; emits `hourChanged`, `prayerTimeChanged`, `dayStarted`, `monthChanged`, `musimChanged`, `pasaranChanged`, `hijriMonthChanged`. All of those are **projections of `day`** ([ADR-0007](adr/0007-three-calendars.md)), not stored fields — the system compares yesterday's projection with today's to decide what to emit
2. `weather` → on `dayStarted`, roll the day's weather from seed + day index
3. `commands` → validate and apply player commands (movement intent, tool use, interact)
4. `farming` → on `dayStarted`: growth, watering reset, withering; rain auto-waters
5. `irrigation` (P1) → water levels for sawah, gate states
6. `animals` → hunger, affection, production
7. `npc` → schedule resolution (target position per time), simple path following on nav grid
8. `economy` → shipping payout at `dayStarted`, market prices on `pasaranChanged`
9. `social` → friendship decay, event triggers
10. `stamina` / `player`

### 3.3 State shape (sketch)
```ts
interface GameState {
  version: number;           // save schema version
  seed: number; rng: RngState;
  clock: { tick: number; day: number; minute: number };   // day is absolute; masehi/jawa/hijri/musim/pasaran are derived (ADR-0009)
  weather: { today: Weather; tomorrow: Weather };
  player: { area: AreaId; pos: Vec2; facing: Dir; stamina: number; money: number; inventory: Slot[] };
  farm: { tiles: Record<TileKey, Tile> };           // TileKey = `${area}:${x},${z}`
  animals: Record<AnimalId, Animal>;
  npcs: Record<NpcId, NpcState>;
  flags: Record<string, boolean | number>;          // story/quest flags
  stats: Record<string, number>;
}
```
The authoritative types and Zod schema live in `packages/shared/src/save.ts`.

### 3.4 Testing
- Unit tests per system (`bun test packages/sim`).
- **Golden tests:** run N days with a fixed seed + scripted commands, then snapshot the state hash. Any balance change is visible in review.
- Property tests for invariants (money never negative, stamina ∈ [0, max]).

## 4. Client runtime

### 4.1 Game loop
```
requestAnimationFrame(frame):
  accumulator += min(realDt, 250ms)
  while accumulator >= dt: sim.step(commands.drain()); accumulator -= dt
  alpha = accumulator / dt
  render.draw(sim.views, alpha)       // interpolate positions
  ui.sync(sim.events.drain())         // batched, max once per frame
```
- Pause the loop on `visibilitychange: hidden`; save first.
- Handle `webglcontextlost`/`restored`: rebuild GPU resources from the asset cache; the sim is unaffected.

### 4.2 Rendering (Three.js, WebGL2)
- One `WebGLRenderer`, `powerPreference: 'default'`, `antialias: false` (FXAA on High only). `setPixelRatio(min(devicePixelRatio, preset.maxDpr))`.
- **Areas as scenes**, streamed: `areaLoader.load(areaId)` → fetch `.glb` + atlas → build → swap. Keep the previous area in memory only on High.
- **Sprites:** one `InstancedMesh` per atlas; per-instance UV offset and frame via instanced attributes; billboard in the vertex shader (cylindrical, Y-up).
- **Crops and grass:** instanced per crop type/stage. Crop tiles update on `dayStarted`, not every frame.
- **Shadows:** High = one directional shadow map 1024², tight frustum around the player. Medium = 512². Low = blob decals only.
- Target ≤ 60 draw calls on Low, ≤ 120 on High (see PERFORMANCE_BUDGET).

### 4.3 UI (Preact)
- DOM overlay above the canvas. Components read from a small signal store (`@preact/signals`) updated by `ui.sync(events)`.
- UI sends intents back as `Command`s. It never mutates sim state.

### 4.4 Platform adapters (`platform/`)
| Adapter | Implementation |
|---|---|
| `storage` | `idb-keyval`; keys `save:<slot>`, `save:<slot>:backup`, `settings`. Call `navigator.storage.persist()` after the first save |
| `audio` | Web Audio: one `AudioContext` unlocked on first gesture; music via `<audio>` element streaming → `MediaElementSource`; SFX buffers per area |
| `input` | Unified `InputState` from keyboard, pointer (virtual joystick), gamepad |
| `device` | Capability detection (WebGL2, max texture size, memory hint `navigator.deviceMemory`), in-app-browser detection (UA contains `FBAN`, `Instagram`, `WhatsApp`, `TikTok`/`musical_ly`, `Line`) |
| `pwa` | SW registration, update prompt ("New version, reload?"), install prompt |

## 5. Save format
- `SaveFile = { format: 'bale-save', version, createdAt, updatedAt, meta: { day, money, playTime }, state: GameState }`.
- **`day` is the only time stored.** The Masehi, Javanese and Hijri dates, musim, pasaran and weton are all pure projections of it ([ADR-0009](adr/0009-masehi-jawa-hijri.md)), so storing them would let the save disagree with itself after a data fix.
- Validated with Zod on load. `migrations[version] = (old) => new` chain in `packages/shared/src/migrations.ts`.
- Before overwriting a slot, copy the previous save to `:backup`. On validation failure, offer to restore the backup.
- Export: JSON → gzip (`CompressionStream`) → base64url file download.

## 6. Content pipeline
- JSON5 in `packages/content/data/**` is validated at **build time** by Zod schemas (`bun run check:content`), then emitted as compact JSON chunks per area and loaded lazily.
- Ink dialogs: `packages/content/dialog/<locale>/<npc>.ink` compiled to JSON at build time (inkjs compiler). Knot names must match across locales (checked).
- Locales: see [I18N](I18N.md).

## 7. Build & delivery
- `bun apps/client/build.ts`: `Bun.build` from `index.html` (Bun follows the `<script>` and `<link>` tags itself), `splitting: true`, `minify: true`, `sourcemap: 'linked'`, then generate `precache-manifest.json` (core shell only, not all areas). `sw.ts` joins the entrypoints in M2-15.
- Output naming is flat and content-hashed — `chunk`/`asset` as `[name]-[hash].[ext]`, `index.html` left unhashed because it is served `no-cache`. Not `[dir]/…`: `[dir]` is relative to the entry, so a chunk from `packages/content` would be published under `_.._/_.._/packages/…`.
- The **core shell** is `index.html` plus exactly the files it links (`tools/size/shell.ts`). Everything else — lazy locale chunks now, area chunks and atlases later — is on-demand and budgeted separately. Both `precache-manifest.json` and `bun run check:size` use that one definition, so the service worker and the budget can never disagree.
- **Sourcemaps ship.** `sourcemap: 'linked'` publishes `.map` files next to the hashed bundles. Deliberate: the project is MIT and a stack trace from a player's phone is worth more than obscurity. Browsers fetch a map only when devtools is open, so it costs a visitor nothing and stays outside the shell budget.
- Assets: `tools/assets/build.ts` → KTX2 (UASTC for UI/sprites where quality matters; ETC1S for world), Meshopt-compressed glb, Opus audio, hashed names.
- Hosting: static files on Cloudflare Pages (or any CDN). `Cache-Control: public, max-age=31536000, immutable` for hashed files; `no-cache` for `index.html` and `sw.js`.

## 8. Server (M4+, optional)
- `apps/server`: `Bun.serve({ routes })`, `bun:sqlite` (WAL mode) at first and `Bun.sql` Postgres later.
- Endpoints: `POST /api/save` (validate schema + **replay sanity** via `packages/sim` invariants), `GET /api/save/:slot`, `POST /api/auth/guest`, `GET /api/health`.
- Built as one binary: `bun build --compile`. Deploy to a VPS in Jakarta or Singapore behind Caddy.

## 9. Observability
- Client error reporting: tiny wrapper → `POST /api/telemetry` (own server) or Sentry browser SDK (decide in M3). Opt-in analytics: load time, fps buckets, device tier, crashes. No PII.
