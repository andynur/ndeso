# Device test checklist (M1-10)

> **Human task.** An agent cannot hold a phone. This page is the script; the results go
> in [`perf-log.md`](perf-log.md), one row per device × browser. M1's exit criterion is
> **30 fps on a Low device** with the **first frame ≤ 5 MB** ([ROADMAP](ROADMAP.md) M1).

## 0. What you need

- One **Low-tier** Android phone from [PERFORMANCE_BUDGET §1](PERFORMANCE_BUDGET.md#1-reference-devices)
  (Galaxy A05/A15, Redmi 12C/13C, Infinix Hot 30/40, Tecno Spark). Note the exact model,
  chipset and RAM. A Mid phone or an iPhone is a bonus row, not a substitute.
- WhatsApp installed on it, and a second phone or WhatsApp Web to send yourself a link.
- The build under test: the Pages deploy of `main` if it is enabled (`DEPLOY_PAGES`, see
  `.github/workflows/ci.yml`), or `bun run dev` on a laptop on the **same Wi-Fi** — it
  prints a network URL for the phone. Write the commit hash down (`git rev-parse --short HEAD`).
- Charge the phone above 50 %, close other apps, and let it cool: a warm phone throttles.

## 1. First run (Chrome Android)

1. Clear the site's data (Chrome → site settings → *Clear & reset*) so the first-run
   quality benchmark runs.
2. Open the URL with **`?debug=perf`** appended. Keep the stopwatch running from tap to
   the first frame with the joglo and the field on screen: that is *Load (first frame)*.
3. Wait 3 s for the benchmark. Note the preset it settled on (overlay: `preset@DPR`).
4. For the transferred size, use desktop Chrome → `chrome://inspect` over USB → Network
   tab, reload with *Disable cache*, read the bottom bar's *transferred*. Budget: ≤ 5 MB for
   M1 (≤ 10 MB at launch, PERFORMANCE_BUDGET §2).

## 2. Frame rate (Low preset)

Reload with `?debug=perf&quality=low`, then for about **60 s each**:

| Scene | How | Read off the overlay |
|---|---|---|
| Standing | Don't touch anything at the spawn | typical fps, lowest fps seen, frame ms, calls, tris |
| Walking | Hold the stick: across the plank into the field and back | same |
| Turning | Tap the turn button ~10 times while walking | any visible hitch? |
| Maghrib | Reload with `&clock=17:25` and watch 17:30 arrive | fps, and does it *look* warm and readable? |
| Night | `&clock=20:00` | lamps lit, sprites readable? |

Record *typical* as fps p50 and *lowest seen* as p95 in the log (the overlay shows live
fps, not percentiles; say so in *Notes*). **Pass: ≥ 30 fps, draw calls ≤ 60, tris ≤ 60k.**
Then repeat *Standing* and *Walking* without `&quality=` to test the preset the benchmark chose.

## 3. Controls and feel (M1-04…M1-06)

- [ ] The floating stick appears where the thumb lands and walks in the direction pushed, relative to the camera, also after a turn
- [ ] A half-pushed stick walks slower
- [ ] Walking into the joglo platform stops you flush; holding a diagonal slides along it
- [ ] The kalen blocks you except on the plank; the plank is easy to line up with
- [ ] The walk animation faces the way you walk, from all four camera angles
- [ ] Walk speed (`content/data/player.json5`, 4 tiles/s): a field row should take a breath, not a trudge. Too fast / right / too slow?
- [ ] Pinch zooms; the camera never clips the joglo roof badly
- [ ] No page scroll, pull-to-refresh or double-tap zoom while playing

## 4. Mobile-web gotchas (PERFORMANCE_BUDGET §5)

- [ ] Switch to WhatsApp for 30 s and back: the game resumes, no black canvas (`webglcontextlost` / `restored`)
- [ ] Lock the screen for a minute and unlock: the clock did not race ahead
- [ ] Rotate to portrait and back: the view resizes, the HUD stays inside the safe area (notch)
- [ ] Items not built yet (audio unlock, autosave, in-app banner, `storage.persist`): note "n/a (M2)" rather than fail

## 5. WhatsApp in-app browser

1. Send the URL (with `?debug=perf`) to yourself on WhatsApp and tap it, so it opens in
   WhatsApp's built-in browser, not Chrome.
2. Repeat §2 *Standing* and *Walking*, and §4's backgrounding test (switch to a chat and back).
3. Note anything that differs from Chrome: missing fullscreen, a toolbar covering the HUD,
   the stick fighting the browser's swipe-back, a lower fps.

If you have time, the same for Instagram's in-app browser and Samsung Internet (one row each).

## 6. Record

Add one row per device × browser to [`perf-log.md`](perf-log.md):

```
| 2026-10-05 | abc1234 | Redmi 12C (G85, 4 GB) | Chrome 129 | Low (bench: Low) | Balé | 38 / 31 | — | 4.1 s, 0.2 MB | walking: 36; maghrib ok; plank hard to line up |
```

Memory: `performance.memory` only exists in Chrome; the overlay's `heap` row is enough, or
`—`. Anything that fails a budget or feels wrong gets its own GitHub issue, linked in *Notes*.
When the Low row passes, tick **M1-10** in the ROADMAP.
