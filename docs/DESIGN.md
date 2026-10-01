# DESIGN — Visual, Audio & UX System

> Keeps art, UI, and feel consistent across contributors and AI agents.
> **Rule for agents:** never invent new colors, fonts, sizes, or spacing. Use the tokens below (`apps/client/src/ui/tokens.ts` mirrors this file). If a token is missing, propose it in the PR description.

## 1. Art direction: "HD-2D Nusantara"

- **World:** low-poly 3D (flat or vertex-color shading plus one small shared gradient atlas), soft stylized lighting, tilt-shift depth of field **only on the High preset**.
- **Characters, animals, and small props:** 2D pixel-art sprites rendered as camera-facing billboards with alpha-cutout. They cast blob shadows on Low and real shadows on High.
- **Mood references (for feel, not for copying):** Octopath Traveler lighting, the warmth of HM: Back to Nature, the colors of Javanese village mornings, Balinese terraces at golden hour.
- **Readability first:** at phone size, the player, the interaction target, and crop state must be identifiable in < 0.5 s.

### 1.1 Camera
| Param | Value |
|---|---|
| Projection | Perspective, FOV 30° (near-orthographic feel, gives depth) |
| Pitch | 38° down |
| Distance | 14 units (zoom range 10–18) |
| Yaw | 4 fixed angles (0/90/180/270), 250 ms eased rotation |
| Follow | Critically damped, 0.15 s. Dead zone 0.5 units |

### 1.2 Scale & sprites
| Item | Spec |
|---|---|
| Tile | 1 × 1 world unit |
| Pixel density | 32 px per world unit (**PPU = 32**) for all sprites |
| Characters | 32 × 48 px frame. 4 directions (down, up, side, side-mirrored). Walk 6 frames @ 10 fps, idle 4 frames, tool actions 4–6 frames |
| Crops | 32 × 32 px per growth stage (3–5 stages) + withered + watered-soil decal |
| Items and icons | 16 × 16 px (inventory shows them at 3× integer scale) |
| Filtering | `NearestFilter` for sprites, mipmaps off. World textures are linear |
| Outline | 1 px dark outline `ink-900` on characters only |

### 1.3 Lighting per time of day
| Time | Sun color | Ambient | Notes |
|---|---|---|---|
| 05:00 subuh | `#5C6B96` | `#3A4670` 0.4 | Still blue, before the sun. Adzan ambience |
| 06:00 dawn | `#FFB27A` | `#6B7AA8` 0.5 | Mist over the fields (Med/High) |
| 12:00 noon | `#FFF4E0` | `#A8C4E0` 0.7 | Harsh and flat; midday is for staying indoors |
| **17:30 maghrib** | `#FF9A4D` | `#8A6FA0` 0.55 | **The signature hour.** Long shadows, warm haze, adzan. Get this one right before any other |
| 19:00+ night | moon `#9DB4FF` | `#1E2A4A` 0.35 | Warung and teras lamps as point lights, max 4 active |
| Rain | ×0.6 intensity, desaturate 30% | | Rain particles + puddle decals |

Interpolate between keyframes using the game clock. Implemented as data (`content/data/lighting.json5`).

## 2. Color tokens

Palette inspired by *batik*, *sawah*, *kunyit* (turmeric), and *terakota*.

| Token | Hex | Use |
|---|---|---|
| `sawah-500` | `#5E9E3A` | Primary, success, crops healthy |
| `sawah-700` | `#3D6B25` | Primary pressed |
| `kunyit-400` | `#F2B632` | Highlight, currency, selection ring |
| `terakota-500` | `#C3593A` | Warning, roof tiles, accent |
| `indigo-700` | `#27335C` | Panels (batik *tarum* indigo), text on light |
| `indigo-900` | `#161D38` | Deep background, night UI |
| `kapur-50` | `#FBF6EC` | Paper/panel background (lontar-paper feel) |
| `kayu-500` | `#8A5A36` | Wood frames, borders |
| `ink-900` | `#1B1410` | Primary text on paper, sprite outline |
| `ink-500` | `#6B5B4E` | Secondary text |
| `hujan-400` | `#6FA8C9` | Water, info, watered soil tint |
| `bahaya-500` | `#D23C3C` | Error/danger (use sparingly) |

- Text contrast must meet **WCAG AA** (≥ 4.5:1). `ink-900` on `kapur-50` passes.
- **Never** carry meaning with color alone. Crop "needs water" = dry-soil texture + droplet icon. Withered = grey + drooping sprite.

## 3. Typography

| Role | Font | Size (at 100% scale) |
|---|---|---|
| UI body | **Plus Jakarta Sans** (OFL, designed by Indonesian foundry Tokotype) | 16 px, line-height 1.4 |
| UI headings | Plus Jakarta Sans 700 | 20 / 24 px |
| Numbers (money, clock) | Plus Jakarta Sans, tabular figures (`font-variant-numeric: tabular-nums`) | 16–20 px |
| Dialog | Plus Jakarta Sans 500 | 18 px |
| Decorative titles | Pixel/display font (TBD, OFL only) | Title screen only |

- Self-host WOFF2 subsets (Latin + Latin Ext.). **No Google Fonts CDN**, because the game must work offline.
- Text scale setting: 100 / 125 / 150%. Layouts must not break at 150% in **either** EN or ID. Indonesian strings run ~20–30% longer.

## 4. Spacing, radius, elevation

- Spacing scale (px): `4, 8, 12, 16, 24, 32, 48`.
- Radius: `4` (chips), `8` (buttons), `12` (panels).
- Panels: `kapur-50` background, 2 px `kayu-500` border, subtle inner batik *kawung* pattern at 6% opacity (optional, High preset only).
- Shadows: one level only, `0 2px 0 rgba(27,20,16,.35)` (flat, pixel-friendly).

## 5. Layout (mobile landscape first)

```
┌───────────────────────────────────────────────────────────────┐
│ [Clock/Day/Weather]                          [Rp 12.500] [≡]  │
│                                                               │
│                         (game view)                           │
│                                                               │
│  ( joystick )                          [tool]  ( ACTION )     │
│   left 40%                              bar     right thumb   │
│        [1][2][3][4][5][6][7][8]  (hotbar, center bottom)      │
└───────────────────────────────────────────────────────────────┘
```
- Respect `env(safe-area-inset-*)` (notches, gesture bars).
- Touch targets ≥ **48 × 48 dp**. The primary action button is 72 dp.
- Portrait mode: show a friendly "rotate your phone" screen (illustrated, localized). Desktop: the same HUD, scaled.
- HUD must never cover the player sprite. Keep the center 40% of the screen clear.

## 6. Components (Preact, `apps/client/src/ui/`)

| Component | Notes |
|---|---|
| `Panel` | Paper panel with wood border, title slot |
| `Button` | Variants: `primary` (sawah), `secondary` (paper), `danger`. Pressed = 2 px down shift |
| `IconButton` | 48 dp min, requires `aria-label` via i18n key |
| `DialogBox` | Portrait (64 × 64, 2×) + name tag + typewriter text (skippable; instant when reduce-motion is on) |
| `Toast` | Top-center, 2.5 s, max 2 stacked |
| `ItemSlot` | 16 px icon at 3×, quantity bottom-right in tabular nums |
| `Tooltip` | Long-press (touch) / hover (desktop) |
| `PlayerStatus` | Compact stamina bar + sleep action; projects sim state |
| `DayEndSummary` | Modal reason/stamina/penalty recap; acknowledgement starts the next day |

Every component must accept only i18n keys or already-translated strings, never literal copy. See [I18N](I18N.md).

## 7. Motion

- UI transitions: 150–200 ms, `ease-out`. No bounce on panels; bounce is allowed for reward pops.
- The **reduce motion** setting disables screen shake, camera bob, parallax, and typewriter effects.
- Area transitions: 400 ms fade to `indigo-900`.

## 8. Audio direction

| Layer | Direction |
|---|---|
| Music | Lo-fi gamelan (*slendro*/*pelog* scales) blended with acoustic guitar and *keroncong* ukulele (*cak/cuk*). Separate day, night, rain, and festival stems. Loops of 90–150 s |
| Ambience | Frogs and crickets at night, rain on *genteng* (roof tiles), rooster at dawn, distant call to prayer handled respectfully (optional, low volume, no gameplay tie-in, toggle in settings) |
| SFX | Short, soft, earthy: hoe on soil, water splash, coin *cring*, *kentongan* for bedtime warning |
| Format | Music Opus in WebM (fallback AAC m4a), streamed. SFX Opus, preloaded per area. Loudness target −16 LUFS music, −14 LUFS SFX peaks |

## 9. UI copy voice

- **EN:** warm, simple, lightly playful. Keep Indonesian cultural nouns (*sawah*, *warung*, *pasar*) italic in dialog and explained in the glossary.
- **ID:** casual-polite (*santai tapi sopan*). Use *kamu* for the player; NPC elders may say *Nak* or *Mas/Mbak*. Avoid heavy slang and regional-only words in system UI. Regional flavor belongs in NPC dialog.
- Both: sentence case for buttons ("Save game" / "Simpan permainan"). No ALL CAPS except very short labels.

## 10. Cultural motifs in visuals

- Use traditional **public-domain** motifs: *kawung*, *truntum*, *mega mendung*, *ceplok*. Credit the region in the asset metadata.
- **Parang** motifs historically carried royal restrictions in the Yogyakarta and Surakarta courts. Avoid them on commoner NPC clothing and keep them for respectful ceremonial contexts only.
- Architecture references are **Javanese and local**: *joglo* and *limasan*, the open *saung* / pendopo of the starting location, kampung houses with their terraces and pagar, warung fronts, and the Dutch-colonial town plan of Purworejo (alun-alun, masjid agung, pendopo kabupaten). Do not import Balinese or Minang architecture into Baledono — the wrong vernacular reads as fake to anyone from the region.
- Dolalak costume (colonial-style jacket, dark glasses, *sampur*, *kupluk*) is Purworejo's own visual signature. Credit it to the regency.
- See [CULTURE_GUIDE](CULTURE_GUIDE.md) and [PLACES](PLACES.md) before designing any NPC, location, festival, clothing, or religious element.
- ⚠️ **Reference photography is the bottleneck.** Almost nothing of Baledono exists online at usable quality; the art direction has to come from a contributor's own photographs (PLACES §5), not from image search.

## 11. Asset naming

`<area|category>_<name>_<variant>.<ext>`, lowercase snake_case, e.g. `bale_joglo_lvl1.glb`, `crop_cabai_stage2.png`, `npc_mbah_hita_walk.png`, `sfx_hoe_soil_01.ogg`. Every asset has an entry in `assets/CREDITS.md` (author, license, source). Details: [ASSET_PIPELINE](ASSET_PIPELINE.md).
