---
paths:
  - "packages/sim/**"
---
# Rules: packages/sim
- Pure + deterministic (ADR-0003). Forbidden: three, preact, DOM globals, Math.random, Date.now, timers. The edit hook blocks these.
- Randomness: `rng.next(state.rng)` only. Time: ticks/minutes from `state.clock`.
- A system is `(state: GameState, ctx: SimContext) => void`, owns one state slice, and emits events via `ctx.emit`.
- State is plain data (records/arrays), JSON-serializable. No classes, Maps, or Sets in state.
- New state fields → update the Zod schema in `packages/shared/src/save.ts` + bump `SAVE_VERSION` + add a migration.
- Every system change: unit test. Balance/number change: update the golden snapshot and state the reason in the PR.
- Numbers come from content data, not magic constants (GDD is the intent, JSON5 is the value).
