# GLOSSARY — project & code terms

> Cultural terms for players are in [CULTURE_GUIDE §2](CULTURE_GUIDE.md#2-glossary-seeds-keep-terms-consistent-also-used-by-the-in-game-kamus) and `locales/*/glossary.json`.
> This file defines **code vocabulary** so humans and agents name things the same way.

| Term | Meaning in code |
|---|---|
| **Area** | A streamed world region/scene (`farm`, `village`, …). `AreaId` type |
| **Tile** | 1×1 world-unit cell. `TileKey = "area:x,z"` |
| **Plot type** | `tegalan` (dry), `sawah` (wet paddy), `kebun` (orchard) |
| **Tick** | One fixed sim step (100 ms real time) |
| **Game minute** | Derived from ticks via `time.minutesPerTick`; day = 06:00→02:00 |
| **Season** | `'hujan' \| 'kemarau'`; `pancaroba` is a *phase* flag (days 22–28), not a season |
| **Pasaran** | `'legi' \| 'pahing' \| 'pon' \| 'wage' \| 'kliwon'`, `(dayIndex) % 5` |
| **Command** | Input intent sent into the sim (`{ type: 'useTool', … }`) |
| **Event** | Fact emitted by the sim (`cropHarvested`, `dayStarted`) |
| **View** | Read-only projection of sim state consumed by render/UI |
| **System** | Pure function updating one slice of state per tick |
| **Content** | Data-driven definitions (crops, items, npcs) in `packages/content` |
| **Key** (i18n) | `namespace:dotted.key`, e.g. `items:crop.cabai.name` |
| **Preset** | Graphics quality level `low \| medium \| high` |
| **Golden test** | Seeded multi-day sim run compared to a snapshot |
| **Slice** | The M2 vertical slice scope (GDD §12) |
