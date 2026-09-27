# TESTING & DEFINITION OF DONE

## 1. `bun run check` (must be green before every commit an agent makes)

| Script | What it does |
|---|---|
| `check:types` | `tsc -b --noEmit` across workspaces |
| `check:lint` | `biome check .` |
| `check:deps` | Enforces the import boundaries from ARCHITECTURE §2 |
| `check:i18n` | Key parity en↔id, placeholder parity, Ink structure parity |
| `check:content` | Zod-validates all content JSON5 and cross-references keys |
| `check:links` | Every relative markdown link and `#anchor` resolves. External URLs are not fetched — a gate that needs the network fails for reasons unrelated to the commit |
| `test` | `bun test` (unit + golden) |
| `check:size` | Build output vs PERFORMANCE_BUDGET (runs after `build`) |

`bun run check` runs everything except `check:size`. `bun run ci` = `check` + `build` + `check:size` + `smoke`.

**Seeing it run.** A merge to `main` publishes the built client to <https://andynur.github.io/ndeso/> (the `deploy` job in `.github/workflows/ci.yml`, gated on `check`). Cloud agent sessions are disposable and their dev server is unreachable, so that URL is how a change gets looked at on a real phone — and it is what makes M1-10's device test cheap. A project site is served from `/<repo>/`, so that build passes `--public-path`; see `apps/client/build.ts`.

⚠️ **One-time setup, by a repository admin.** Until both are done the `deploy` job is **skipped**, not failed:

1. Settings → Pages → Source: **GitHub Actions**
2. Settings → Secrets and variables → Actions → Variables → `DEPLOY_PAGES` = `true`

Step 1 cannot be automated: `actions/configure-pages` has an `enablement` option, but turning Pages on needs repository-administration rights that a `permissions:` block cannot grant to `GITHUB_TOKEN`. The variable gate exists so the job states its prerequisite instead of failing every push until someone notices — a permanently red `main` teaches everyone to ignore the colour. Once the variable is set, a failure there means a real deploy failure again.

## 2. Test types

| Type | Where | Tool | Notes |
|---|---|---|---|
| Unit | `packages/**/src/**/*.test.ts` | `bun test` | Colocated, fast, no I/O |
| Golden sim | `packages/sim/test/golden/*.test.ts` | `bun test` + snapshots | Seeded N-day runs; snapshot the state hash + key metrics. Update intentionally with `bun test -u` and explain why in the PR |
| Property | `packages/sim/test/props/` | `bun test` (hand-rolled generators) | Invariants: money ≥ 0, stamina bounds, no tile in two states |
| Content | `tools/check-content.ts` | Zod | Schema + referential integrity |
| Smoke | `tools/smoke.ts` | `Bun.WebView` | Load prod build, wait for `window.__GAME_READY__`, assert no console errors, screenshot to `artifacts/` |
| Manual device | Checklist below | Real phones | Each milestone and before any release |

## 3. Definition of Done (per task)

- [ ] Acceptance criteria of the task met (from ROADMAP or the issue)
- [ ] `bun run check` green
- [ ] New logic has tests. Sim changes include or update golden tests if balance changed
- [ ] No new player-facing string without EN + ID keys
- [ ] No budget regression (or it is justified in the PR)
- [ ] Docs updated if behavior, data format, or architecture changed (GDD numbers, ADR for decisions)
- [ ] `docs/STATUS.md` updated (what changed, what's next)
- [ ] Conventional commit message

## 4. Manual device checklist (milestone gates)

- [ ] Cold load on 4G (throttled "Fast 4G" is not enough; use a real SIM) → title interactive time
- [ ] 10 minutes of play: fps overlay p95, no thermal throttling crash
- [ ] Background → WhatsApp → return: game resumes, audio OK, no context loss or it recovers
- [ ] Airplane mode reload: game loads offline, save intact
- [ ] Switch EN ↔ ID mid-game: every visible string updates, no layout overflow at 150% text size
- [ ] Open the link from a WhatsApp chat (in-app browser): loads, banner shows, save works
