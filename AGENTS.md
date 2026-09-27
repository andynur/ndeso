# AGENTS.md — rules for every AI coding agent

Ndeso: open-source HD-2D farming sim (Harvest Moon-like, Indonesian culture) for web + mobile browsers.
Stack: **Bun 1.4 (pinned) · TypeScript strict · Three.js (WebGL2) · Preact · Zod · inkjs**. Monorepo with Bun workspaces.

## Read on demand (don't preload everything)
| When you… | Read |
|---|---|
| start any session | `docs/STATUS.md` (Now block) → the task in `docs/ROADMAP.md` |
| touch game rules/numbers | `docs/GDD.md` (relevant section only) |
| touch structure/imports/loop/save | `docs/ARCHITECTURE.md` |
| add UI, art, audio, colors | `docs/DESIGN.md` |
| add text, dialog, content | `docs/I18N.md` + `docs/CULTURE_GUIDE.md` |
| add deps or tools | `docs/TECH_STACK.md` |
| worry about fps/size | `docs/PERFORMANCE_BUDGET.md` |
| finish a task | `docs/TESTING.md` §3 (Definition of Done) |

## Hard rules
1. **One task per session/PR.** Take the next unchecked task in ROADMAP (or the one assigned). Don't start a second one.
2. **`packages/sim` stays pure:** no `three`, `preact`, DOM, `Date.now`, `Math.random`, or timers. Use the seeded RNG in state.
3. **No hardcoded player-facing text.** Add keys to **both** `locales/en` and `locales/id` (or `[TODO-ID] ` prefix + `needs-translation` label).
4. **No new dependency** unless TECH_STACK.md allows it; otherwise stop and propose it in the PR description.
5. **Don't change Accepted ADRs or GDD numbers silently.** Propose the change in the PR (and a new ADR for architecture).
6. **Run `bun run check` before every commit.** Fix failures; never skip or disable checks/tests to pass.
7. **Placeholders, not final art.** Never fetch copyrighted or unclear-license assets. Open an `art-needed` issue instead.
8. **Culture:** follow CULTURE_GUIDE. No sacred items as loot, no stereotypes.
9. **Never commit secrets**, `.env*`, build outputs, or generated assets.
10. Update `docs/STATUS.md` (Now + Log entry) at the end of the session.

## Commands
```bash
bun install                 # deps (workspace)
bun run dev                 # dev server + HMR (client), LAN-accessible for phone testing
bun run check               # types + lint + deps + i18n + content + tests  ← required before commit
bun test packages/sim       # fast sim tests;  bun test -u  to update snapshots (explain why in PR)
bun run build && bun run check:size
bun run ci                  # everything CI runs
```

## Conventions
- TypeScript strict, no `any`, no default exports (except Preact route components if needed), named exports only.
- Files `kebab-case.ts`; types `PascalCase`; functions/vars `camelCase`; content ids `snake_case`.
- Tests colocated `*.test.ts`. Sim changes need unit tests; balance changes update golden snapshots.
- Commits: Conventional Commits with task id, e.g. `feat(sim): M1-01 game clock and pasaran cycle`.
- Branch: `<type>/<task-id>-<slug>`, e.g. `feat/M1-03-billboard-sprites`.
- PR description: what/why, task id, screenshots or a GIF for visual changes, budget impact, checklist from the template.

## Output style
Be terse in chat: no preamble, no restating the task, no summaries of what the diff already shows. Put detail in code, tests, and docs, not in chat.
