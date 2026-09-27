---
paths:
  - "apps/client/src/ui/**"
---
# Rules: UI (Preact)
- Tokens only (`ui/tokens.ts` = DESIGN §2–4). No raw hex, px, or font values in components.
- No literal copy: `t('ns:key')` for every visible string, `aria-label`, and title. Money/number/date through `format.*`.
- Touch targets ≥ 48 dp. Must fit EN and ID at 150% text scale. Respect safe-area insets.
- UI sends `Command`s; it never mutates sim state or touches Three.js.
- Respect `settings.reduceMotion` (no typewriter, shake, or bounce).
