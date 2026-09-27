---
paths:
  - "**/*.test.ts"
  - "packages/sim/test/**"
---
# Rules: tests
- Deterministic: fixed seeds, no wall-clock, no network.
- Name tests by behavior: `it('withers cabai after 3 dry days')`.
- Golden snapshots change only intentionally (`bun test -u`), with the reason in the PR.
- Don't weaken or delete a failing test to get green. Fix the code, or explain in the PR why the test was wrong.
