---
paths:
  - "packages/content/**"
  - "apps/client/src/i18n/**"
---
# Rules: content & locales
- EN is the source; ID must have identical keys and placeholders. Run `bun run check:i18n`.
- Content JSON5 holds ids, numbers, and `*Key` references only. No prose.
- Ink: same knots, stitches, choice counts, and tags in every locale.
- ID voice: *kamu*, *santai tapi sopan*. Keep cultural nouns consistent with `glossary.json`.
- Cultural content: add `origin` and follow CULTURE_GUIDE §7 checklist.
