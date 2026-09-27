# ADR-0003: Deterministic simulation separated from rendering
- Status: Accepted
- Date: 2026-09-26

## Context
Farming sims are state-heavy and long-running. We need reliable saves, testable balance, optional server validation, and freedom to change rendering.

## Decision
`packages/sim` is pure TypeScript: fixed 10 Hz tick, seeded PRNG in state, plain-data state, commands in and events out. No DOM, Three.js, wall-clock time, or `Math.random`. Enforced by `check:deps` plus an edit hook.

## Consequences
- + Golden tests, reproducible bugs (seed + command log), and server-side sanity checks with the same code.
- + The renderer can be swapped or degraded without touching logic.
- − Discipline required: render interpolation, and never reading sim internals mutably from UI.
