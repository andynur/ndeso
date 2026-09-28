# Architecture Decision Records

Short records of decisions that are expensive to reverse. Format: [MADR-lite](https://adr.github.io/madr/).
New ADR: copy `0000-template.md`, take the next number, and set status `Proposed` → `Accepted` when merged.
Agents: **never change an Accepted ADR's decision silently.** Write a new ADR that supersedes it.

| # | Title | Status |
|---|---|---|
| 0001 | Bun-first toolchain | Accepted |
| 0002 | HD-2D rendering with Three.js on WebGL2 | Accepted |
| 0003 | Deterministic sim separated from rendering | Accepted |
| 0004 | Custom lightweight i18n, EN source + ID | Accepted |
| 0005 | Licensing: MIT code, CC BY-SA 4.0 assets | Accepted |
| 0006 | AI agent harness & token strategy | Accepted (items 5, 7 superseded by 0008) |
| 0007 | Three overlapping calendars from one day counter | Superseded by 0009 (the single `day` counter stays) |
| 0008 | Drop the Serena and context-mode MCP servers | Accepted |
| 0009 | Masehi calendar first, Javanese and Hijri as a subtitle | Accepted |
