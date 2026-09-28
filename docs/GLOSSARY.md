# GLOSSARY — project & code terms

> Cultural terms for players are in [CULTURE_GUIDE §2](CULTURE_GUIDE.md#2-glossary-seeds-keep-terms-consistent-also-used-by-the-in-game-kamus) and `locales/*/glossary.json`.
> This file defines **code vocabulary** so humans and agents name things the same way.

| Term | Meaning in code |
|---|---|
| **Area** | A streamed world region/scene (`bale`, `pasar`, `kampung`, …). `AreaId` type. See [PLACES](PLACES.md) |
| **Tile** | 1×1 world-unit cell. `TileKey = "area:x,z"` |
| **Plot type** | `tegalan` (dry), `sawah` (wet paddy), `kebun` (orchard) |
| **Tick** | One fixed sim step (100 ms real time) |
| **Game minute** | Derived from ticks via `time.minutesPerTick`; day = 05:00→01:00 |
| **Day** | The **only** stored time value. The Masehi, Javanese and Hijri dates, musim, pasaran and weton are pure projections of it ([ADR-0009](adr/0009-masehi-jawa-hijri.md)) |
| **Mangsa** | One of the 12 pranata-mangsa seasons. **Lore only** since ADR-0009: characters may mention them; no system uses them |
| **Musim** | Coarse season derived from the Masehi month (`months.json5`): `'hujan' \| 'kemarau' \| 'pancaroba'`. **Crops are tagged by musim** |
| **Pasaran** | `'legi' \| 'pahing' \| 'pon' \| 'wage' \| 'kliwon'`, `(dayIndex) % 5` |
| **Kawasan** | The area-scale game: what the player builds and grows, as opposed to the tile-scale farming (GDD §1.1, §5) |
| **Quality** | `asri \| nyaman \| tenang` — computed **spatially** per area from what is on the ground. Never a counter (GDD §5) |
| **Command** | Input intent sent into the sim (`{ type: 'useTool', … }`) |
| **Event** | Fact emitted by the sim (`cropHarvested`, `dayStarted`) |
| **View** | Read-only projection of sim state consumed by render/UI |
| **System** | Pure function updating one slice of state per tick |
| **Content** | Data-driven definitions (crops, items, npcs) in `packages/content` |
| **Key** (i18n) | `namespace:dotted.key`, e.g. `items:crop.cabai.name` |
| **Preset** | Graphics quality level `low \| medium \| high` |
| **Golden test** | Seeded multi-day sim run compared to a snapshot |
| **Slice** | The M2 vertical slice scope (GDD §13) |
