---
name: add-game-content
description: Add or change data-driven game content (crop, item, tool, NPC, schedule, festival, dialog) the right way, with schema, locales, culture check, and tests. Use for any "add a crop/NPC/item/festival" request.
---
# Add game content

1. **Design source:** find the entry in `docs/GDD.md` (numbers and intent). If it isn't there, propose the values in the PR and add them to the GDD in the same PR.
2. **Culture:** check `docs/CULTURE_GUIDE.md` §1–4. Set `origin` (region) on the data entry.
3. **Data:** add the entry to `packages/content/data/<type>.json5`. Ids are `snake_case`; text fields are `*Key` references only.
4. **Schema:** if a new field is needed, extend the Zod schema in `packages/shared/src/content/*.ts`.
5. **Locales:** use the `i18n-string` skill for `nameKey`/`descKey` (EN + ID). New cultural terms go in both `glossary.json` files.
6. **Dialog (NPCs):** `packages/content/dialog/{en,id}/<npc>.ink`, same knots. Schedule entries follow the GDD §8 format.
7. **Assets:** reference a placeholder id (`crop_<id>_stage<n>`, `npc_<id>_walk`). If no final art exists, open an `art-needed` issue using the specs in DESIGN §1.2.
8. **Tests:** `bun run check:content`, plus a sim test when behavior differs (e.g. regrow, special watering). Update golden snapshots if the economy changes.
9. PR checklist: culture checklist from CULTURE_GUIDE §7.
