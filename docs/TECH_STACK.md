# TECH STACK

> Principle: **Bun first.** Add a third-party dependency only when Bun or the web platform does not provide the capability. Every new runtime dependency needs a line in this file and a reason. Dev dependencies need a reason too.

## 1. Runtime & tooling (Bun 1.4.x, pinned in `.bun-version`)

| Need | Use | Instead of |
|---|---|---|
| Package manager, monorepo | `bun install`, workspaces | npm/pnpm |
| Dev server + HMR | Bun HTML imports (`bun --hot ./apps/client/index.html`, or via `Bun.serve` in `tools/dev.ts`) | Vite |
| Bundling | `Bun.build` (splitting, minify, hashed names) | Vite/Rollup/esbuild |
| TS/JSX transpile | Bun built-in (`jsxImportSource: preact`) | tsc emit, Babel |
| Type check | `tsc --noEmit` (typescript dev dep; Bun does not type-check) | — |
| Tests | `bun test` (+ `--parallel`, snapshots, coverage) | Vitest/Jest |
| Scripts | Bun Shell (`import { $ } from 'bun'`) | bash/Make |
| Image processing | `Bun.Image` (resize, WebP, icons) | sharp |
| Smoke test | `Bun.WebView` headless (load build, collect console errors, screenshot) | Playwright |
| HTTP + WS server | `Bun.serve({ routes, websocket })` | Express/Hono |
| DB | `bun:sqlite` → `Bun.sql` (Postgres) | better-sqlite3/pg |
| Crypto/passwords | `Bun.password`, Web Crypto | bcrypt |
| Object storage | `Bun.S3Client` (Cloudflare R2) | AWS SDK |
| Cron | `Bun.cron()` | node-cron |
| Markdown (patch notes) | `Bun.markdown` | marked |
| Deploy server | `bun build --compile` | Docker + node_modules |
| Dependency audit | `bun audit` | npm audit |

## 2. Libraries (the whole allowed list for v1)

| Library | Where | Why it's needed |
|---|---|---|
| `three` | client/render | 3D rendering (no Bun equivalent; runs in the browser) |
| `preact`, `@preact/signals` | client/ui | Tiny UI layer (~4 KB); JSX works with the Bun transpiler with no plugin |
| `zod` (v4) | shared | Schemas for save and content, shared by client and server |
| `inkjs` | client (runtime), tools (compiler) | Branching dialog |
| `idb-keyval` | client/platform | ~1 KB IndexedDB wrapper for saves |
| `json5` | tools | Parse content files at build time (only if Bun's JSON5 import doesn't cover the tool case) |
| `@gltf-transform/cli` | tools (dev) | KTX2/Basis + Meshopt compression; Bun.Image can't produce GPU texture formats |
| `@biomejs/biome` | dev | Lint + format in one fast binary (Bun has neither) |
| `typescript` | dev | Type checking only |
| `bun-types` | dev | Bun runtime + `bun:test` typings for `tsconfig.base.json` `types` (§4); types only, never bundled |
| `@types/three` | dev | Three.js ships no `.d.ts`; DefinitelyTyped pinned to the same minor as `three`. Types only, never bundled |

**Explicitly not used:** Vite, Webpack, React, Redux, Howler (use a Web Audio wrapper), Dexie (idb-keyval is enough), Tailwind (use CSS modules + tokens), lodash, moment/dayjs (`Intl` is enough), i18next (our own ~2 KB runtime, see I18N).

## 3. Browser platform APIs relied on

WebGL2 · Web Audio · IndexedDB · Service Worker + Cache Storage · `CompressionStream` · `Intl` (PluralRules, NumberFormat, DateTimeFormat) · Pointer Events · Gamepad API · Page Visibility · `navigator.storage.persist` · Screen Orientation (best effort) · Fullscreen (best effort, not on iOS).

## 4. Config conventions

- `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, `jsxImportSource: "preact"`, `types: ["bun-types"]` (not for client code, which uses `lib: ["DOM","ES2023"]`).
- Internal package deps use `"workspace:*"`.
- `bunfig.toml`: `[install] exact = true` (reproducible), `[test] coverage = true` on CI only.
- Biome: 2-space indentation, single quotes, trailing commas, line width 100. Lint `recommended` plus `noExplicitAny: error`, `noConsole: warn` (allowed in tools/).

## 5. Versions policy

- Pin Bun in `.bun-version` (currently **1.4.1**). CI uses `oven-sh/setup-bun` with `bun-version-file`.
- Library versions are pinned exactly by `bun.lock`. Upgrade via a dedicated PR (`chore(deps): …`) with green CI plus a manual phone smoke test for `three` upgrades.
- Check the Three.js migration guide on every minor bump (Three.js changes APIs between releases).

## 6. Cloud-session note (Claude Code on the web)

The cloud VM ships an older Bun (1.3.x) and Bun has known proxy quirks there. `scripts/cloud-setup.sh` installs the pinned Bun via npm (`npm i -g bun@<pinned>`), which was verified to work through the proxy together with `bun install`. See [docs/id/SETUP_AI_AGENT.md](id/SETUP_AI_AGENT.md).
