# PERFORMANCE BUDGET

> Budgets are **CI-enforced where possible** (`bun run check:size`) and **measured on real devices** every milestone. A PR that exceeds a budget must say so in its description and get explicit approval.

## 1. Reference devices

| Tier | Example devices | Notes |
|---|---|---|
| **Low (primary target)** | Samsung Galaxy A05/A15, Redmi 12C/13C, Infinix Hot 30/40, Tecno Spark (Helio G85/G88/G99, Mali-G52/G57, 3–4 GB RAM) | Must hit all "Low" budgets |
| Mid | Redmi Note 12/13, Galaxy A35, Poco X-series | Medium preset |
| Desktop | Integrated GPU laptop (Intel Iris Xe) | High preset |
| iOS | iPhone XR/11 (Safari 16.4+) | Medium preset |

Keep at least one Low-tier phone available to the maintainer for manual tests. Remote debugging: `chrome://inspect` over USB.

## 2. Network & size

| Budget | Limit |
|---|---|
| Initial HTML + JS (core shell, brotli) | ≤ 350 KB |
| Critical path to title screen interactive | ≤ 1.5 MB |
| **First playable frame (farm area)** | **≤ 10 MB total transferred** |
| Per additional area chunk | ≤ 3 MB (≤ 5 MB for hub areas) |
| Music track | ≤ 1.5 MB each (Opus ~64 kbps), streamed, never precached on first visit |
| Locale namespace file | ≤ 30 KB each |

`tools/check-size.ts` reads the build output and fails CI when a budget is exceeded.

## 3. Runtime (Low preset, reference Low device)

| Metric | Budget |
|---|---|
| Frame rate | ≥ 30 fps p95 (farm with 100 crops, 2 NPCs, rain) |
| Frame time CPU (sim + render submit) | ≤ 12 ms |
| Sim tick | ≤ 2 ms per tick (10 Hz) |
| Draw calls | ≤ 60 (Low), ≤ 90 (Medium), ≤ 120 (High) |
| Triangles on screen | ≤ 60k (Low), ≤ 150k (High) |
| Texture memory | ≤ 96 MB (Low), ≤ 192 MB (High) |
| JS heap | ≤ 120 MB |
| Total tab memory | ≤ 350 MB |
| Render resolution | DPR cap 1.0 (Low), 1.5 (Medium), 2.0 (High) |
| Area transition | ≤ 1 s (cached), ≤ 4 s (network, 4G) |
| Save write | ≤ 50 ms, never on the render frame (use `requestIdleCallback`) |

## 4. Quality presets

| Feature | Low | Medium | High |
|---|---|---|---|
| Max DPR | 1.0 | 1.5 | 2.0 |
| Shadows | Blob decals | Shadow map 512² | 1024² + soft |
| Post-processing | None | Color grade LUT | LUT + FXAA + tilt-shift DoF |
| Particles (rain) | 300 | 800 | 2000 |
| Grass instances | 0 | 2k | 6k |
| Point lights | 0 (baked vertex light) | 2 | 4 |
| Fps cap | 30 | 30/60 | 60 |

**Auto-select:** a first-run 3-second benchmark scene measures frame time and picks a preset. The player can override it.

**Dynamic resolution:** if the fps average over 2 s drops below `target − 5`, lower the render scale in 0.1 steps (min 0.6). Raise it again after 10 s above target.

## 5. Mobile-web gotchas checklist

- [ ] Audio unlocks on the first `pointerdown`
- [ ] `webglcontextlost` / `restored` handled (test by backgrounding the tab while switching to WhatsApp)
- [ ] Autosave on `visibilitychange: hidden` and `pagehide`
- [ ] `touch-action: none` on the canvas; prevent pull-to-refresh (`overscroll-behavior: none`)
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, no zoom on double tap
- [ ] Safe-area insets respected
- [ ] In-app browser detection → "Open in Chrome for the best experience" banner (dismissible)
- [ ] `navigator.storage.persist()` requested after the first save
- [ ] Tested on: Chrome Android, Samsung Internet, WhatsApp in-app, Instagram in-app, Safari iOS

## 6. How to measure

- **In-game perf overlay** (`?debug=perf` or triple-tap the clock in dev builds): fps, frame ms, draw calls, triangles, textures, heap.
- `renderer.info` for draw calls and memory. `performance.memory` where available.
- Record results per milestone in `docs/perf-log.md` (device, preset, area, fps p50/p95, memory).
