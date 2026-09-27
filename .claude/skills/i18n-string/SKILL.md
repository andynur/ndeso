---
name: i18n-string
description: Add, rename, or remove player-facing strings correctly in both EN and ID locales. Use whenever UI text, labels, toasts, or content names change.
---
# i18n string workflow

1. Choose the namespace file (`ui`, `items`, `npcs`, `glossary`, `tutorial`) and a semantic key (`area.element.state`, snake_case segments). See docs/I18N.md §2.
2. Add the key to `packages/content/locales/en/<ns>.json` **and** `.../id/<ns>.json` with the same placeholders.
   - ID voice: *kamu*, *santai tapi sopan*. Unsure? Write `[TODO-ID] <best effort>` and note it for the PR (`needs-translation`).
3. Use it: `t('<ns>:<key>', { … })`. Money, numbers, and dates must go through `format.*` before being passed in.
4. Rename = add the new key, replace usages (Serena `search_for_pattern` or Grep for `'<ns>:<old>'`), delete the old key in **all** locales.
5. `bun run check:i18n` (then `check:types`: generated key types catch typos).
