# ADR-0001: Bun-first toolchain
- Status: Accepted
- Date: 2026-09-26

## Context
A small team and AI agents benefit from few tools and one runtime. Bun 1.4 (Rust rewrite, Aug 2026) bundles a package manager, bundler with HTML imports/HMR, test runner, shell, image processing (`Bun.Image`), headless WebView, SQLite/Postgres, S3, and cron.

## Decision
Use Bun 1.4.x for install, dev server, bundling, tests, scripts, and the optional server. Pin the version in `.bun-version`. Add libraries only per TECH_STACK §2.

## Consequences
- + One tool to learn, fast CI, shared TS across client, server, and tools.
- − Smaller plugin ecosystem than Vite. We hand-write the service worker and precache manifest (~150 LOC).
- − Bun-specific APIs (`bun:sqlite`, `Bun.S3Client`) are wrapped in adapters to limit lock-in.
- − The 1.4 rewrite is new. Mitigate by pinning and upgrading only through PRs with green CI.
- Player-facing performance is unaffected: the game runs in the browser (V8/JSC), not in Bun.

## Alternatives considered
- Vite + Node/pnpm: mature plugins (vite-plugin-pwa), but more moving parts.
- Vite running on Bun: a valid fallback if the Bun bundler blocks us (e.g. shader or asset plugins).
